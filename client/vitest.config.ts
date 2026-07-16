import { defineConfig } from "vitest/config";
import path from "path";

// Standalone Vitest config — no React/Tailwind plugins needed for the pure
// logic tests, just the "@" alias so tests can import from "@/lib/*".
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
