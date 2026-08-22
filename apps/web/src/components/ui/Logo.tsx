import React from "react";

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
}

/**
 * GraphMind Vector Glyph — High-precision geometric branching knowledge graph mark.
 * Clean, mathematical, and minimalist.
 */
export function GraphMindIcon({ size = 20, className = "text-zinc-900", ...props }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      {/* Branching Knowledge Lattice */}
      <path
        d="M12 18.5V11.5M12 11.5L6.5 7M12 11.5L17.5 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 7C9.5 4.5 14.5 4.5 17.5 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="2 2"
        strokeLinecap="round"
        opacity="0.45"
      />

      {/* Precision Node Vertices */}
      <circle cx="12" cy="18.5" r="2.25" fill="currentColor" />
      <circle cx="6.5" cy="7" r="2.25" fill="currentColor" />
      <circle cx="17.5" cy="7" r="2.25" fill="currentColor" />
      <circle cx="12" cy="11.5" r="1.5" fill="currentColor" />
    </svg>
  );
}

interface LogoBadgeProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Clean Light Brand Emblem — Clean light container with zero dark background.
 */
export function LogoBadge({ size = "md", className = "" }: LogoBadgeProps) {
  const sizeClasses = {
    sm: "w-6 h-6 rounded-md bg-zinc-100/90 border border-zinc-200/80 text-zinc-900",
    md: "w-8 h-8 rounded-lg bg-zinc-100/90 border border-zinc-200/80 text-zinc-900",
    lg: "w-11 h-11 rounded-xl bg-zinc-100/90 border border-zinc-200/80 text-zinc-900",
  };

  const iconSizes = {
    sm: 15,
    md: 19,
    lg: 25,
  };

  return (
    <div
      className={`flex items-center justify-center shadow-2xs shrink-0 ${sizeClasses[size]} ${className}`}
    >
      <GraphMindIcon size={iconSizes[size]} className="text-zinc-900" />
    </div>
  );
}
