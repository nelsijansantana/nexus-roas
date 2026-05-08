// Allows TypeScript to resolve pixel.js as a plain-string text import.
// Wrangler injects it via [[rules]] type = "Text" globs = ["pixel.js"].
declare const content: string;
export default content;
