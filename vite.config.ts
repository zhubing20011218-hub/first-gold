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
    // 整局的测试一条要 3 到 4 秒，电脑忙的时候会超过默认的 5 秒
    testTimeout: 20000,
  },
});
