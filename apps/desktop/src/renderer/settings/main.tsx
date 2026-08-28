import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { settingsRouter } from "./router.tsx";
import "@capsule/ui/styles.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("settings root missing");
}

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={settingsRouter} />
  </StrictMode>,
);
