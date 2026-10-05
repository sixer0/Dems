/**
 * Request bodies (API-4; spec §2.3 stage 7): a body is a JSON object of at most 65,536 bytes.
 *
 * Fastify's default parsers are removed, so that `application/json` is the only accepted
 * content type (a `text/plain` body would otherwise reach a handler as a string). The JSON
 * parser is Fastify's own, with its prototype-poisoning checks, wrapped with two rules:
 *   - valid JSON that is not an object (an array, a string, a number, null) is refused with
 *     400 `INVALID_JSON`;
 *   - an empty body counts as `{}`, as it does in the simulator's REST layer. The `preValidation`
 *     hook gives the same to a POST that sent no body and no content type.
 * The size limit is the server option `bodyLimit`.
 */
import type { FastifyInstance } from 'fastify';
import { invalidJson } from './api-failure';

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function installJsonBodyParser(app: FastifyInstance): void {
  const parseJson = app.getDefaultJsonParser('error', 'error');

  app.removeAllContentTypeParsers();
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (request, body, done) => {
    if (body === '') {
      done(null, {});
      return;
    }
    parseJson(request, body as string, (error, value) => {
      if (error) {
        done(error);
        return;
      }
      if (!isJsonObject(value)) {
        done(invalidJson());
        return;
      }
      done(null, value);
    });
  });

  app.addHook('preValidation', async (request) => {
    if (request.method === 'POST' && request.body === undefined) request.body = {};
  });
}
