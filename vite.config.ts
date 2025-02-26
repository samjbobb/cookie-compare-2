import pages from "@hono/vite-cloudflare-pages";
import devServer from "@hono/vite-dev-server";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  if (mode === "client") {
    return {
      esbuild: {
        jsxImportSource: "hono/jsx/dom", // Optimized for hono/jsx/dom
      },
      build: {
        rollupOptions: {
          input: "./src/client.tsx",
          output: {
            entryFileNames: "static/client.js",
          },
        },
      },
    };
  } else {
    // Load all .env variables and set them to process.env for backend use
    // loadEnv follows Vite's normal rules for .env file naming
    // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
    // This is only necessary for `vitest` at this point.
    // If we separate test commands for frontend and backend we can combine this vite config
    // into one regardless of command.
    const env = loadEnv(mode, process.cwd(), "");
    process.env = { ...process.env, ...env };
    return {
      plugins: [
        // commonjs({
        //   filter(id) {
        //     // `node_modules` is exclude by default, so we need to include it explicitly
        //     // https://github.com/vite-plugin/vite-plugin-commonjs/blob/v0.7.0/src/index.ts#L125-L127
        //     if (id.includes("whatwg-url")) {
        //       return true;
        //     }
        //     if (id.includes("webidl-conversion")) {
        //       return true;
        //     }
        //   },
        // }), // Transform CommonJS to ES modules
        // pages(),
        devServer({
          entry: "src/index.tsx",
        }),
      ],
    };
  }
});
