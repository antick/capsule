import { AGENT_COPY } from "@capsule/config";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AgentPanel } from "./AgentPanel.tsx";
import "./styles.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error(AGENT_COPY.panelRootMissing);
}

createRoot(root).render(
  <StrictMode>
    <AgentPanel />
  </StrictMode>,
);
