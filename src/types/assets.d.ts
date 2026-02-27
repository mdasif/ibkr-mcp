/** Allow importing .md files as raw text (handled by esbuild's text loader). */
declare module '*.md' {
  const content: string;
  export default content;
}
