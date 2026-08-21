"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface UseScrollAnchorOptions {
  threshold?: number;
}

export function useScrollAnchor(options: UseScrollAnchorOptions = {}) {
  const { threshold = 80 } = options;
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const checkIsAtBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distanceToBottom <= threshold;
  }, [threshold]);

  const handleScroll = useCallback(() => {
    const atBottom = checkIsAtBottom();
    setIsAtBottom(atBottom);
    if (atBottom) {
      setShowScrollButton(false);
    } else {
      setShowScrollButton(true);
    }
  }, [checkIsAtBottom]);

  const scrollToBottom = useCallback((smooth = true) => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
        block: "end",
      });
      setIsAtBottom(true);
      setShowScrollButton(false);
    }
  }, []);

  // Attach scroll listener
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", handleScroll);
    };
  }, [handleScroll]);

  return {
    scrollRef,
    bottomRef,
    isAtBottom,
    showScrollButton,
    scrollToBottom,
  };
}
