import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/*.ts"],
      exclude: ["src/lib/**/*.test.ts", "src/lib/seed.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // server-only throws when imported outside a React server context;
      // tests import server libs intentionally, so stub it in node.
      "server-only": path.resolve(__dirname, "./tests/mocks/server-only.ts"),
    },
  },
});
