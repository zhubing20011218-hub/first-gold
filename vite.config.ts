import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// 网站可以放在任何路径下打开（docs/01 第七节）
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
