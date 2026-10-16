"use client";

/**
 * AuthIntentResumer — executes one stored guest intent after sign-in (LSI-032).
 *
 * Mounted once in the root layout (inside `AuthProvider`). It consumes at most one
 * pending intent per stored value and resumes it exactly once:
 *
 * - on authentication (the guest → login → return journey), and
 * - when a new intent is stored while already signed in (e.g. the public lesson
 *   gate is used by a learner who is already authenticated).
 *
 * `consumePendingIntent` clears the intent before the async resume runs, so a
 * duplicate auth callback (or a React re-run of the effect) finds nothing and is
 * a no-op. Dismissal simply drops the intent without executing it.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  consumePendingIntent,
  subscribePendingIntentStored,
} from "@/lib/authIntent";
import { resumePendingIntent } from "@/lib/intentResume";

export function AuthIntentResumer() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [nonce, setNonce] = useState(0);

  // A store while already signed in should resume without a full reload.
  useEffect(
    () => subscribePendingIntentStored(() => setNonce((value) => value + 1)),
    [],
  );

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    const intent = consumePendingIntent();
    if (!intent) return;
    void resumePendingIntent(intent).then((outcome) =>
      router.push(outcome.destination),
    );
  }, [isAuthenticated, isLoading, router, nonce]);

  return null;
}
