// Allows TypeScript to resolve *.txt imports (loaded as plain strings by Wrangler [[rules]])
declare module '*.txt' {
  const content: string;
  export default content;
}
