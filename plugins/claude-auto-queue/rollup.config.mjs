import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";

const isWatching = Boolean(process.env.ROLLUP_WATCH);
const sdPlugin = "com.packrat.claude-auto-queue.sdPlugin";
const outputDir = `${sdPlugin}/bin`;

export default {
  input: "src/plugin.ts",
  output: {
    dir: outputDir,
    entryFileNames: "plugin.js",
    format: "es",
    sourcemap: isWatching
  },
  plugins: [
    typescript({
      tsconfig: "./tsconfig.json",
      include: ["src/**/*.ts", "src/**/*.js"],
      // @rollup/plugin-typescript 12.3 creates an automatic allowJs outDir in the OS temp
      // directory when none is supplied. Its own Rollup path validation rejects that temp
      // directory because it sits outside output.dir, which breaks Rat Dev on Windows.
      // Keep TypeScript's intermediate emit namespace inside Rollup's output tree instead.
      compilerOptions: {
        outDir: `${outputDir}/.typescript`
      }
    }),
    nodeResolve({
      browser: false,
      exportConditions: ["node"],
      preferBuiltins: true,
      extensions: [".ts", ".js", ".mjs", ".json"],
      dedupe: ["@elgato/streamdeck", "@elgato/utils", "ws"]
    }),
    commonjs(),
    !isWatching && terser(),
    {
      name: "emit-module-package-file",
      generateBundle() {
        this.emitFile({
          fileName: "package.json",
          source: "{ \"type\": \"module\" }",
          type: "asset"
        });
      }
    }
  ]
};
