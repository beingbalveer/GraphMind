import React from "react";

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
}

/**
 * GraphMind Vector Icon — High-precision geometric branching knowledge graph mark.
 * Clean, mathematical, and minimalist.
 */
export function GraphMindIcon({ size = 20, className = "", ...props }: LogoProps) {
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
      {/* Branching Knowledge Lattice Arcs */}
      <path
        d="M12 18V12M12 12L6.5 7.5M12 12L17.5 7.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 7.5C9.5 5 14.5 5 17.5 7.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="2 2"
        strokeLinecap="round"
        opacity="0.6"
      />

      {/* Precision Node Vertices */}
      <circle cx="12" cy="18" r="2.25" fill="currentColor" />
      <circle cx="6.5" cy="7.5" r="2.25" fill="currentColor" />
      <circle cx="17.5" cy="7.5" r="2.25" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

interface LogoBadgeProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Premium Brand Emblem — Matte black precision squircle badge with crisp white icon.
 */
export function LogoBadge({ size = "md", className = "" }: LogoBadgeProps) {
  const sizeClasses = {
    sm: "w-6 h-6 rounded-[7px]",
    md: "w-8 h-8 rounded-xl",
    lg: "w-11 h-11 rounded-2xl",
  };

  const iconSizes = {
    sm: 14,
    md: 18,
    lg: 24,
  };

  return (
    <div
      className={`bg-zinc-950 text-white flex items-center justify-center shadow-xs border border-zinc-800/80 shrink-0 ${sizeClasses[size]} ${className}`}
    >
      <GraphMindIcon size={iconSizes[size]} className="text-white" />
    </div>
  );
}
