"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!isMounted) return;

      if (sessionError) {
        setError(sessionError.message);
      }

      if (data.session) {
        setHasRecoverySession(true);
      }
      setLoadingSession(false);
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasRecoverySession(true);
      }
      if (event === "SIGNED_OUT") {
        setHasRecoverySession(false);
      }
      setLoadingSession(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (!hasRecoverySession) {
      setError("Your reset link is invalid or expired. Request a new one.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        throw updateError;
      }

      setMessage("Password updated successfully. Redirecting to sign in...");
      setPassword("");
      setConfirmPassword("");
      await supabase.auth.signOut();
      setTimeout(() => {
        router.push("/auth");
      }, 900);
    } catch (err: any) {
      setError(err?.message || "Could not update password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">Set a new password</h1>
        <p className="mt-2 text-gray-600">
          Opened this page from your reset email? Enter your new password below.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        {loadingSession ? (
          <p className="text-sm text-gray-600">Verifying reset link...</p>
        ) : hasRecoverySession ? (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-gray-900">New password</span>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-gray-900">Confirm new password</span>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Re-enter your new password"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? "Saving..." : "Save new password"}
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-red-700">This reset link is invalid or has expired.</p>
            <p className="text-sm text-gray-600">Go back to auth and request a fresh reset email.</p>
            <Link
              href="/auth"
              className="inline-flex rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Back to authentication
            </Link>
          </div>
        )}

        {message && <p className="mt-4 text-sm text-green-700">{message}</p>}
        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
      </div>
    </div>
  );
}
