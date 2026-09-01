import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";

const builds = [
  ["src/plugin-pro.ts", "out/com.packrat.cs2-competitive-dashboard-pro.sdPlugin/bin/plugin.js"],
  ["src/plugin-lite.ts", "out/com.packrat.cs2-competitive-dashboard-lite.sdPlugin/bin/plugin.js"]
];

export default builds.map(([input, file]) => ({
  input,
  output: {
    file,
    format: "es",
    sourcemap: false
  },
  plugins: [
    typescript(),
    nodeResolve({ browser: false, exportConditions: ["node"], preferBuiltins: true }),
    commonjs(),
    terser(),
    {
      name: "emit-module-package-file",
      generateBundle() {
        this.emitFile({ fileName: "package.json", source: `{ "type": "module" }`, type: "asset" });
      }
    }
  ]
}));
