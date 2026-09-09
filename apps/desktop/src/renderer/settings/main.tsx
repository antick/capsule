import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { settingsRouter } from "./router.tsx";
import "@capsule/ui/styles.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("settings root missing");
}

// The window is backed by the macOS sidebar material, which only shows through
// where the page paints nothing. The content column paints its own background.
document.body.classList.add("shell-vibrant");

// Re-opening settings on a different page raises this window rather than
// making a new one, so the page change arrives here instead of in a URL.
// The router reads hash history, so writing the hash is the navigation.
window.capsule?.onNavigate((hash) => {
  window.location.hash = `#${hash}`;
});

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={settingsRouter} />
  </StrictMode>,
);
