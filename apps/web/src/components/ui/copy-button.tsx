"use client";

import React, { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import { IconButton } from "./icon-button";

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
    <IconButton
      label={copied ? copiedTitle : title}
      title={copied ? copiedTitle : title}
      variant="ghost"
      className={className}
      onClick={handleCopy}
    >
      {copied ? (
        <Check aria-hidden="true" className="size-4 text-success" />
      ) : (
        <Copy aria-hidden="true" className="size-4" />
      )}
    </IconButton>
  );
}
