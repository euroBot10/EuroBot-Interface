import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
 import { registerSW } from "virtual:pwa-register";
 


registerSW({ immediate: true });
 

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
  })
} 

