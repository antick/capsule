import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { overlayRouter } from "./router.tsx";
import "./styles.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("overlay root missing");
}

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={overlayRouter} />
  </StrictMode>,
);
