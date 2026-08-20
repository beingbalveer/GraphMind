"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronUp, Check, Sparkles, Cpu } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface ModelOption {
  id: string;
  name: string;
  provider: "gemini" | "openai" | "mock";
  description: string;
  badge?: string;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "gemini",
    description: "Google's fastest multimodal model for reasoning and coding",
    badge: "Default",
  },
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "gemini",
    description: "High-speed low-latency generation",
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    description: "OpenAI lightweight high-throughput model",
  },
  {
    id: "mock",
    name: "Offline Mock Stream",
    provider: "mock",
    description: "Simulated token stream for offline testing (no API key needed)",
  },
];

interface ModelSelectorProps {
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  disabled?: boolean;
}

export function ModelSelector({
  selectedModel,
  onSelectModel,
  disabled,
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentModel =
    AVAILABLE_MODELS.find((m) => m.id === selectedModel) || AVAILABLE_MODELS[0];

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-zinc-100/90 hover:bg-zinc-200/80 text-zinc-700 font-medium text-xs cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed select-none"
        title="Select Foundation Model"
      >
        <span className="font-medium text-zinc-900">{currentModel.name}</span>
        <ChevronUp
          className={`w-3 h-3 text-zinc-500 transition-transform duration-150 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Floating Popover Menu */}
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-72 sm:w-80 rounded-2xl bg-white border border-zinc-200 shadow-xl p-1.5 z-50 animate-in fade-in-50 zoom-in-95 duration-150 select-none">
          <div className="px-2.5 py-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            Model Selection
          </div>

          <div className="space-y-1">
            {AVAILABLE_MODELS.map((model) => {
              const isSelected = model.id === selectedModel;
              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => {
                    onSelectModel(model.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left p-2.5 rounded-xl flex items-start justify-between space-x-2 transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-zinc-100 text-zinc-950"
                      : "hover:bg-zinc-50 text-zinc-700"
                  }`}
                >
                  <div className="flex items-start space-x-2 min-w-0">
                    <div className="pt-0.5 shrink-0 text-zinc-500">
                      {model.provider === "gemini" ? (
                        <Sparkles className="w-3.5 h-3.5" />
                      ) : (
                        <Cpu className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-xs font-semibold text-zinc-900">
                          {model.name}
                        </span>
                        {model.badge && (
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                            {model.badge}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">
                        {model.description}
                      </p>
                    </div>
                  </div>

                  {isSelected && (
                    <Check className="w-4 h-4 text-zinc-900 shrink-0 mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
