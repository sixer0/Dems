/*
 * dems-speaker-embed — one speaker embedding per span of a raw PCM file (blueprint row 78 / M6-W3;
 * transcript spec A.4; controller ruling D90: speaker labelling WITHOUT a segmentation model).
 *
 * A thin caller of the sherpa-onnx C API (Apache-2.0): it creates one speaker-embedding extractor
 * on the CPU provider and, for every span, feeds the samples of that span and prints the vector.
 * It decides nothing: no clustering, no label, no threshold. All of that is in
 * apps/transcriber/src/pipeline/diarization.ts, where it is tested without a model.
 *
 * Usage:
 *   dems-speaker-embed --model <file.onnx> --rate <hz> --pcm <raw s16le mono file> --spans <file>
 *
 * The spans file holds one span per line: "<fromSample> <toSample>" (toSample exclusive), in
 * samples of the PCM file. Output, on the standard output, exactly:
 *
 *   dems-speaker-embed 1
 *   dim <D>
 *   <index> ok <D numbers>        one line per span, in the order of the spans file
 *   <index> short                 the extractor had too little audio for a vector
 *   end <number of spans>
 *
 * Any error: a message on the standard error and a non-zero exit code; the output is then not
 * used by the caller. The engine resamples to the rate of its model itself. Nothing here measures
 * or prints how long anything took.
 *
 * Build (no Homebrew, nothing outside .cache/): see apps/transcriber/native/README.md.
 */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "sherpa-onnx/c-api/c-api.h"

static int fail(const char *message) {
  fprintf(stderr, "dems-speaker-embed: %s\n", message);
  return 2;
}

int main(int argc, char **argv) {
  const char *model = NULL, *pcm = NULL, *spans = NULL;
  long rate = 0;
  for (int i = 1; i + 1 < argc; i += 2) {
    if (strcmp(argv[i], "--model") == 0) model = argv[i + 1];
    else if (strcmp(argv[i], "--pcm") == 0) pcm = argv[i + 1];
    else if (strcmp(argv[i], "--spans") == 0) spans = argv[i + 1];
    else if (strcmp(argv[i], "--rate") == 0) rate = strtol(argv[i + 1], NULL, 10);
    else return fail("unknown argument");
  }
  if (model == NULL || pcm == NULL || spans == NULL || rate < 8000 || rate > 192000 || (argc % 2) != 1) return fail("usage: --model F --rate HZ --pcm F --spans F");

  FILE *audio = fopen(pcm, "rb");
  if (audio == NULL) return fail("the PCM file cannot be opened");
  if (fseek(audio, 0, SEEK_END) != 0) return fail("the PCM file cannot be measured");
  long total = ftell(audio) / 2;
  FILE *list = fopen(spans, "r");
  if (list == NULL) return fail("the spans file cannot be opened");

  SherpaOnnxSpeakerEmbeddingExtractorConfig config;
  memset(&config, 0, sizeof(config));
  config.model = model;
  config.num_threads = 1;
  config.debug = 0;
  config.provider = "cpu"; /* CPU only, by decision (D229 / R-7). Never another provider. */
  const SherpaOnnxSpeakerEmbeddingExtractor *extractor = SherpaOnnxCreateSpeakerEmbeddingExtractor(&config);
  if (extractor == NULL) return fail("the embedding model could not be loaded");
  int32_t dim = SherpaOnnxSpeakerEmbeddingExtractorDim(extractor);
  if (dim < 1) return fail("the embedding model states no dimension");

  printf("dems-speaker-embed 1\ndim %d\n", (int)dim);
  long from = 0, to = 0, count = 0;
  int read;
  while ((read = fscanf(list, "%ld %ld", &from, &to)) == 2) {
    if (from < 0 || to <= from || to > total) return fail("a span lies outside the PCM file");
    long n = to - from;
    int16_t *raw = (int16_t *)malloc((size_t)n * sizeof(int16_t));
    float *samples = (float *)malloc((size_t)n * sizeof(float));
    if (raw == NULL || samples == NULL) return fail("out of memory");
    if (fseek(audio, from * 2, SEEK_SET) != 0 || fread(raw, sizeof(int16_t), (size_t)n, audio) != (size_t)n) return fail("a span could not be read");
    for (long k = 0; k < n; k += 1) samples[k] = (float)raw[k] / 32768.0f; /* little-endian host assumed (arm64, x86_64) */
    const SherpaOnnxOnlineStream *stream = SherpaOnnxSpeakerEmbeddingExtractorCreateStream(extractor);
    if (stream == NULL) return fail("no stream");
    SherpaOnnxOnlineStreamAcceptWaveform(stream, (int32_t)rate, samples, (int32_t)n);
    SherpaOnnxOnlineStreamInputFinished(stream);
    if (!SherpaOnnxSpeakerEmbeddingExtractorIsReady(extractor, stream)) {
      printf("%ld short\n", count);
    } else {
      const float *vector = SherpaOnnxSpeakerEmbeddingExtractorComputeEmbedding(extractor, stream);
      if (vector == NULL) return fail("the engine returned no vector");
      printf("%ld ok", count);
      for (int32_t d = 0; d < dim; d += 1) printf(" %.9g", (double)vector[d]);
      printf("\n");
      SherpaOnnxSpeakerEmbeddingExtractorDestroyEmbedding(vector);
    }
    SherpaOnnxDestroyOnlineStream(stream);
    free(raw);
    free(samples);
    count += 1;
  }
  if (read != EOF) return fail("the spans file holds a line that is not two numbers");
  printf("end %ld\n", count);
  SherpaOnnxDestroySpeakerEmbeddingExtractor(extractor);
  fclose(list);
  fclose(audio);
  return fflush(stdout) == 0 ? 0 : fail("the output could not be written");
}
