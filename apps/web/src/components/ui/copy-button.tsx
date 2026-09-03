"use client";

import React, { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";

interface CopyButtonProps {
  text: string;
  className?: string;
  title?: string;
  copiedTitle?: string;
}

export function CopyButton({
  text,
  className = "",
  title = "Copy message",
  copiedTitle = "Copied!",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy text: ", err);
      }
    },
    [text]
  );

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`w-7 h-7 rounded-xl text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors cursor-pointer flex items-center justify-center shrink-0 select-none ${className}`}
      title={copied ? copiedTitle : title}
      aria-label={copied ? copiedTitle : title}
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-emerald-600 animate-in zoom-in-75 duration-150" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}
