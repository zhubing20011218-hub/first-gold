import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Home } from "./ui/Home";
import "./ui/theme.css";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Home />
    </StrictMode>,
  );
}
