"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Script from "next/script";
import { useAuth } from "@/context/AuthContext";
import { LogoBadge } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: string;
              size?: string;
              width?: string;
              text?: string;
              shape?: string;
            }
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/";

  const { user, login, register, loginWithGoogle } = useAuth();

  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [googleClientReady, setGoogleClientReady] = useState(false);

  const googleButtonRef = useRef<HTMLDivElement | null>(null);

  // If already authenticated, redirect to next path
  useEffect(() => {
    if (user) {
      router.replace(nextPath);
    }
  }, [user, nextPath, router]);

  // Handle Google OAuth callback
  const handleGoogleCallback = async (response: { credential: string }) => {
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await loginWithGoogle(response.credential);
      router.push(nextPath);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Google authentication failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const initGoogleAuth = () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (typeof window !== "undefined" && window.google && clientId) {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCallback,
      });

      if (googleButtonRef.current) {
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: "outline",
          size: "large",
          width: "340",
          text: "continue_with",
          shape: "rectangular",
        });
      }
      setGoogleClientReady(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email || !password) {
      setErrorMsg("Please provide both email and password.");
      return;
    }

    if (password.length < 8) {
      setErrorMsg("Password must be at least 8 characters long.");
      return;
    }

    try {
      setIsSubmitting(true);
      if (mode === "signin") {
        await login(email, password);
      } else {
        await register(email, password, fullName);
      }
      router.push(nextPath);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.detail || err.message || "Authentication failed. Please verify your credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillDemoAdmin = () => {
    setEmail("admin@graphmind.local");
    setPassword("admin123456");
    setMode("signin");
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-zinc-50/70 bg-[radial-gradient(#e4e4e7_1px,transparent_1px)] [background-size:20px_20px] text-zinc-900 px-4 py-12 relative select-none">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={initGoogleAuth}
      />

      <div className="w-full max-w-[390px] z-10">
        {/* Card Container */}
        <div className="bg-white border border-zinc-200/90 shadow-sm rounded-2xl p-6 sm:p-7 space-y-5">
          {/* Brand Header */}
          <div className="flex flex-col items-center text-center space-y-1.5 pb-1">
            <LogoBadge size="md" className="mb-1.5 shadow-2xs" />
            <h1 className="text-lg font-bold tracking-tight text-zinc-950">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="text-xs text-zinc-500 max-w-[280px] leading-relaxed">
              Branching AI workspace for structured thinking and knowledge maps.
            </p>
          </div>

          {/* Mode Switcher Segmented Tabs */}
          <SegmentedTabs
            value={mode}
            onChange={(val) => {
              setMode(val as "signin" | "register");
              setErrorMsg(null);
            }}
            items={[
              { id: "signin", label: "Sign In" },
              { id: "register", label: "Create Account" },
            ]}
            className="w-full flex [&>button]:flex-1"
          />

          {/* Error Alert Banner */}
          {errorMsg && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs leading-relaxed animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Google Sign-In Section */}
          <div>
            {googleClientReady ? (
              <div ref={googleButtonRef} className="w-full flex justify-center" />
            ) : (
              <Button
                type="button"
                variant="outline"
                size="default"
                onClick={() => {
                  if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
                    setErrorMsg(
                      "Google OAuth is not configured in this environment (NEXT_PUBLIC_GOOGLE_CLIENT_ID). Please use Email / Password or Demo Admin."
                    );
                  } else {
                    initGoogleAuth();
                  }
                }}
                className="w-full h-9 flex items-center justify-center gap-2 cursor-pointer font-medium text-xs text-zinc-700 hover:text-zinc-950 border-zinc-200"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </Button>
            )}

            {/* Symmetrical Centered Divider */}
            <div className="relative flex items-center my-4.5">
              <div className="grow border-t border-zinc-200" />
              <span className="shrink-0 px-3 text-[10px] uppercase tracking-wider text-zinc-400 font-medium">
                or continue with email
              </span>
              <div className="grow border-t border-zinc-200" />
            </div>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === "register" && (
              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-700">
                  Full Name <span className="text-zinc-400 font-normal">(optional)</span>
                </label>
                <Input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ada Lovelace"
                  startIcon={<User className="w-3.5 h-3.5" />}
                  inputSize="default"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-700">
                Email Address
              </label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                startIcon={<Mail className="w-3.5 h-3.5" />}
                inputSize="default"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-zinc-700">
                  Password
                </label>
                {mode === "register" && (
                  <span className="text-[10px] text-zinc-400 font-normal">
                    Min 8 chars
                  </span>
                )}
              </div>
              <Input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                startIcon={<Lock className="w-3.5 h-3.5" />}
                inputSize="default"
                endIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-zinc-400 hover:text-zinc-600 cursor-pointer transition-colors p-1"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                }
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              size="default"
              className="w-full h-9 font-medium cursor-pointer mt-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>{mode === "signin" ? "Sign In" : "Create Account"}</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </>
              )}
            </Button>
          </form>

          {/* Quick Demo Credentials Fill */}
          <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-xs">
            <span className="text-zinc-400 text-[11px]">Need instant access?</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={fillDemoAdmin}
              className="cursor-pointer text-zinc-600 hover:text-zinc-950 font-medium h-auto py-1 px-2 text-xs"
            >
              <Sparkles className="w-3 h-3 text-amber-500 mr-1.5" />
              <span>Fill Admin Demo</span>
            </Button>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center mt-6 text-[11px] text-zinc-400">
          Protected by same-origin encrypted sessions and workspace RBAC.
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-zinc-50 text-zinc-500 text-xs">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          Loading authentication...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
