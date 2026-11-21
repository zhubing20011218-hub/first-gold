import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/app/App";
import { NextApp } from "./ui/next/NextApp";
import { ErrorScreen } from "./ui/app/ErrorScreen";
import { useStore } from "./ui/store/store";
import { installSelfcheck } from "./ui/dev/selfcheck";
import "./ui/theme/theme.css";

const root = document.getElementById("root");
if (root) {
  installSelfcheck(location.search);
  // 新版（改版方案第 5 稿）是默认的；?old=1 打开改版之前的季度制版本
  const old = new URLSearchParams(location.search).has("old");
  createRoot(root).render(
    old ? (
      <StrictMode>
        <ErrorScreen seed={() => useStore.getState().seed}>
          <App />
        </ErrorScreen>
      </StrictMode>
    ) : (
      <StrictMode>
        <NextApp />
      </StrictMode>
    ),
  );
}
