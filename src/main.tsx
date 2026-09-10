import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { getDatabase } from "./db";
import "./index.css";
// Initialize PostHog as early as possible
import "./lib/posthog";

getDatabase();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
