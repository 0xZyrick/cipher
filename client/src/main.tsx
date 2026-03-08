import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// No wallet provider needed — using direct starknet.js signing
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);