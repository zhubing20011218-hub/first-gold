import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/app/App";
import { ErrorScreen } from "./ui/app/ErrorScreen";
import { installSelfcheck } from "./ui/dev/selfcheck";
import "./ui/theme/theme.css";

const root = document.getElementById("root");
if (root) {
  installSelfcheck(location.search);
  createRoot(root).render(
    <StrictMode>
      <ErrorScreen>
        <App />
      </ErrorScreen>
    </StrictMode>,
  );
}
