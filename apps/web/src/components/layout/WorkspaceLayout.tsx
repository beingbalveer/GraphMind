"use client";

import React, { useState } from "react";
import { HeaderToolbar } from "./HeaderToolbar";
import { Sidebar } from "./Sidebar";
import { GraphCanvas } from "../canvas/GraphCanvas";
import { PromptBar } from "../canvas/PromptBar";

export function WorkspaceLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden bg-slate-50 font-sans">
      <HeaderToolbar
        sidebarOpen={sidebarOpen}
        toggleSidebar={() => setSidebarOpen((prev) => !prev)}
      />

      <div className="flex-1 flex overflow-hidden relative">
        <Sidebar isOpen={sidebarOpen} />
        <main className="flex-1 h-full relative">
          <GraphCanvas />
          <PromptBar />
        </main>
      </div>
    </div>
  );
}
