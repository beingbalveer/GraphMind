import React from "react";

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
}

/**
 * GraphMind Vector Glyph — High-precision geometric branching knowledge graph mark.
 * Clean, mathematical, and minimalist.
 */
export function GraphMindIcon({ size = 20, className = "text-current", ...props }: LogoProps) {
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
      <circle cx="12" cy="18.5" r="2.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="6.5" cy="7" r="2.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="17.5" cy="7" r="2.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="11.5" r="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

interface LogoBadgeProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * GraphMind brand emblem.
 */
export function LogoBadge({ size = "md", className = "" }: LogoBadgeProps) {
  const sizeClasses = {
    sm: "h-6 w-6 rounded-lg",
    md: "h-8 w-8 rounded-lg",
    lg: "h-11 w-11 rounded-xl",
  };

  const iconSizes = {
    sm: 15,
    md: 19,
    lg: 25,
  };

  return (
    <div
      className={`flex shrink-0 items-center justify-center border border-foreground bg-transparent text-foreground ${sizeClasses[size]} ${className}`}
    >
      <GraphMindIcon size={iconSizes[size]} className="text-current" />
    </div>
  );
}
