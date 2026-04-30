import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./App";
import "./styles/globals.css";
import "./styles/feature-foundation.css";
import "./styles/controls-foundation.css";
import "./styles/responsive-foundation.css";
import "./styles/theme-overrides.css";
import "./styles/auth.css";
import "./styles/features.css";
import "./styles/header.css";
import "./styles/auth-premium.css";
import "./styles/auth-canvas.css";
import "./styles/layout.css";
import "./styles/dashboard.css";
import "./styles/teachers.css";
import "./styles/rooms.css";
import "./styles/parents.css";
import "./styles/forms.css";
import "./styles/tables.css";
import "./styles/utilities.css";
import "./styles/responsive.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
