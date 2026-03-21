import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

// Force Service Worker Unregistration and Cache Clearing
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    // 1. Unregister all Service Workers
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (let registration of registrations) {
        registration.unregister();
      }
    });
    
    // 2. Clear all Caches
    caches.keys().then((names) => {
      for (let name of names) {
        caches.delete(name);
      }
    });
    
    console.log("🧹 Service Workers unregistered and caches cleared. Please reload!");
  });
}
