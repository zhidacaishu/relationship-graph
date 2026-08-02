import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const isolationHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp"
};

export default defineConfig(({ mode }) => {
  const appsByMode = {
    weighted: "weighted",
    "unweighted-obsidian": "unweighted-obsidian"
  };
  const appName = appsByMode[mode];

  if (!appName) {
    throw new Error(`Unknown mode "${mode}". Valid modes: ${Object.keys(appsByMode).join(", ")}`);
  }

  const appRoot = resolve("apps", appName);
  const dataPath = resolve(appRoot, "graph-data.js");

  if (!existsSync(dataPath)) {
    throw new Error(`Graph data file does not exist: ${dataPath}`);
  }

  const plugins = [
    {
      name: "copy-graph-data",
      closeBundle() {
        if (!existsSync(dataPath)) {
          throw new Error(`Graph data file does not exist: ${dataPath}`);
        }
        copyFileSync(dataPath, resolve(appRoot, "dist", "graph-data.js"));
      }
    }
  ];

  return {
    root: appRoot,
    base: "./",
    cacheDir: resolve("node_modules", ".vite", appName),
    plugins,
    server: {
      headers: isolationHeaders
    },
    preview: {
      headers: isolationHeaders
    },
    build: {
      target: "es2022",
      outDir: resolve(appRoot, "dist"),
      emptyOutDir: true
    }
  };
});
