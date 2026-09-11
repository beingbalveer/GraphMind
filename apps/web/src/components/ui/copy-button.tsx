"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { Copy, Check } from "lucide-react";
import { IconButton } from "./icon-button";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  text: string;
  className?: string;
  title?: string;
  copiedTitle?: string;
}

export function CopyButton({
  text,
  className,
  title = "Copy message",
  copiedTitle = "Copied!",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const resetTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (resetTimeout.current !== null) clearTimeout(resetTimeout.current);
  }, []);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        if (resetTimeout.current !== null) clearTimeout(resetTimeout.current);
        resetTimeout.current = setTimeout(() => {
          setCopied(false);
          resetTimeout.current = null;
        }, 2000);
      } catch (err) {
        console.error("Failed to copy text: ", err);
      }
    },
    [text]
  );

  return (
    <IconButton
      label={copied ? copiedTitle : title}
      title={copied ? copiedTitle : title}
      variant="ghost"
      className={cn("text-foreground-subtle hover:text-foreground shadow-none", className)}
      onClick={handleCopy}
    >
      {copied ? (
        <Check aria-hidden="true" className="size-3.5 stroke-[1.75] text-success" />
      ) : (
        <Copy aria-hidden="true" className="size-3.5 stroke-[1.75]" />
      )}
    </IconButton>
  );
}
