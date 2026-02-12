import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vitest/config";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/utility-tools/",
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
