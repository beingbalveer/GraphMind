import React from "react";
import { createRoot } from "react-dom/client";
import "@/app/globals.css";
import { LearningStudio } from "./studio";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LearningStudio />
  </React.StrictMode>,
);
import "./prototype.css";
