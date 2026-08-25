"use client";

import React, { forwardRef } from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", startIcon, endIcon, disabled, type = "text", ...props }, ref) => {
    return (
      <div className="relative flex items-center w-full">
        {startIcon && (
          <div className="absolute left-2.5 flex items-center pointer-events-none text-zinc-400">
            {startIcon}
          </div>
        )}
        <input
          ref={ref}
          type={type}
          disabled={disabled}
          className={`w-full h-8.5 rounded-lg border border-zinc-200/90 bg-zinc-50/50 px-3 text-xs text-zinc-900 placeholder-zinc-400 transition-all focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50 ${
            startIcon ? "pl-8" : ""
          } ${endIcon ? "pr-8" : ""} ${className}`}
          {...props}
        />
        {endIcon && (
          <div className="absolute right-2 flex items-center text-zinc-400">
            {endIcon}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
