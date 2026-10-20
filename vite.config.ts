import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

function ssrDussehraSceneStub(): Plugin {
  const virtualId = "\0virtual:dussehra-scene-ssr";
  return {
    name: "ssr-dussehra-scene-stub",
    enforce: "pre",
    resolveId(id, _importer, options) {
      const isSsr = Boolean(options?.ssr || this.environment?.name === "ssr");
      if (
        isSsr &&
        (id === "@/components/DussehraScene" ||
          id.endsWith("DussehraScene") ||
          id.includes("components/DussehraScene"))
      ) {
        return virtualId;
      }
      return null;
    },
    load(id) {
      if (id === virtualId) {
        return `
          import React from "react";
          export function DussehraScene() {
            return React.createElement("div", {
              className: "leaf-canvas-fallback",
              "aria-hidden": "true",
            });
          }
        `;
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [
    ssrDussehraSceneStub(),
    tanstackStart({
      server: { entry: "server" },
    }),
    viteReact(),
    tailwindcss(),
    tsconfigPaths(),
  ],
});

