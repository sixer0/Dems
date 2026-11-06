/**
 * The part of `xml2js` 0.6.2 that `probe-answer.ts` uses (blueprint row 131; capture spec §A.6.1a).
 * The package ships no types, and no types package is named by the spec: this is the whole surface
 * the Core relies on, written down, so that a second use of the parser is a visible change here.
 */
declare module 'xml2js' {
  interface ParserOptions {
    readonly strict: boolean;
    readonly explicitArray: boolean;
    readonly explicitRoot: boolean;
    readonly async: boolean;
    readonly ignoreAttrs: boolean;
    readonly normalize: boolean;
    readonly trim: boolean;
    readonly tagNameProcessors: readonly ((name: string) => string)[];
  }
  class Parser {
    constructor(options: ParserOptions);
    parseString(text: string, callback: (error: Error | null, result: unknown) => void): void;
  }
  const xml2js: {
    readonly Parser: typeof Parser;
    readonly processors: { readonly stripPrefix: (name: string) => string };
  };
  export default xml2js;
}
