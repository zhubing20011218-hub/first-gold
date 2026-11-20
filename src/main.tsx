import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/app/App";
import { ErrorScreen } from "./ui/app/ErrorScreen";
import { useStore } from "./ui/store/store";
import { installSelfcheck } from "./ui/dev/selfcheck";
import "./ui/theme/theme.css";

const root = document.getElementById("root");
if (root) {
  installSelfcheck(location.search);
  createRoot(root).render(
    <StrictMode>
      <ErrorScreen seed={() => useStore.getState().seed}>
        <App />
      </ErrorScreen>
    </StrictMode>,
  );
}
