"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { HelpHint } from "@/components/ui/HelpHint";

type AuthMode = "sign-in" | "sign-up";

export default function AuthPage() {
  const router = useRouter();
  const { user, loading } = useAuthUser();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resettingPassword, setResettingPassword] = useState(false);

  const handleSignIn = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setSubmitting(false);
      return;
    }

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        throw signInError;
      }

      setMessage("Signed in successfully.");
      setEmail("");
      setPassword("");
      router.push("/");
      router.refresh();
    } catch (err: any) {
      const signInMessage = err?.message || "Could not sign in.";
      if (typeof signInMessage === "string") {
        const normalized = signInMessage.toLowerCase();
        if (normalized.includes("invalid login credentials")) {
          setError("Invalid email/password. If this account was created before password login, use Forgot password? below.");
        } else if (normalized.includes("email not confirmed")) {
          setError("Email not confirmed yet. Confirm your email first, then sign in.");
        } else {
          setError(signInMessage);
        }
      } else {
        setError("Could not sign in.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignUp = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setSubmitting(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setSubmitting(false);
      return;
    }

    try {
      const signUpRes = await fetch("/api/auth/sign-up", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const signUpJson = await signUpRes.json().catch(() => null);
      if (!signUpRes.ok) {
        throw new Error(signUpJson?.error || "Could not create account.");
      }

      const { error: signInAfterSignUpError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInAfterSignUpError) {
        setMessage("Account created. Please sign in.");
      } else {
        setMessage("Account created and signed in successfully.");
        router.push("/");
        router.refresh();
      }

      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setMode("sign-in");
    } catch (err: any) {
      setError(err?.message || "Could not create account.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      await supabase.auth.signOut();
      setMessage("Signed out successfully.");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Failed to sign out.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    setMessage(null);
    setError(null);

    if (!email.trim()) {
      setError("Enter your email first, then click Reset password.");
      return;
    }

    setResettingPassword(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth/reset-password` : undefined,
      });
      if (resetError) {
        throw resetError;
      }
      setMessage("Password reset email sent. Open the email link to set a new password.");
    } catch (err: any) {
      setError(err?.message || "Could not send password reset email.");
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">Authentication</h1>
        <p className="mt-2 text-gray-600">Sign in directly with your email and password to access account-scoped features.</p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-gray-600">Checking session...</p>
        ) : user ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              Signed in as <span className="font-medium">{user.email || "authenticated user"}</span>
            </p>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={submitting}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              {submitting ? "Signing out..." : "Sign out"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
              <button
                type="button"
                onClick={() => {
                  setMode("sign-in");
                  setMessage(null);
                  setError(null);
                  setPassword("");
                  setConfirmPassword("");
                }}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  mode === "sign-in" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("sign-up");
                  setMessage(null);
                  setError(null);
                  setPassword("");
                  setConfirmPassword("");
                }}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  mode === "sign-up" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Sign up
              </button>
            </div>

            {mode === "sign-in" ? (
              <form className="space-y-4" onSubmit={handleSignIn}>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <label htmlFor="signin-email" className="text-sm font-medium text-gray-900">Email</label>
                    <HelpHint text="Use the email linked to your workspace account." />
                  </div>
                  <input
                    id="signin-email"
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@company.com"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <label htmlFor="signin-password" className="text-sm font-medium text-gray-900">Password</label>
                    <HelpHint text="Use your account password (minimum 8 characters)." />
                  </div>
                  <input
                    id="signin-password"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Your password"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {submitting ? "Signing in..." : "Sign in"}
                </button>
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={resettingPassword || submitting}
                  className="ml-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  {resettingPassword ? "Sending reset..." : "Forgot password?"}
                </button>
              </form>
            ) : (
              <form className="space-y-4" onSubmit={handleSignUp}>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <label htmlFor="signup-email" className="text-sm font-medium text-gray-900">Email</label>
                    <HelpHint text="Used for sign-in and password recovery." />
                  </div>
                  <input
                    id="signup-email"
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@company.com"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <label htmlFor="signup-password" className="text-sm font-medium text-gray-900">Password</label>
                    <HelpHint text="Create a secure password with at least 8 characters." />
                  </div>
                  <input
                    id="signup-password"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <label htmlFor="signup-confirm-password" className="text-sm font-medium text-gray-900">Confirm password</label>
                    <HelpHint text="Re-enter the same password to confirm it." />
                  </div>
                  <input
                    id="signup-confirm-password"
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Re-enter password"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {submitting ? "Creating..." : "Create account"}
                </button>
              </form>
            )}
          </div>
        )}

        {message && <p className="mt-4 text-sm text-green-700">{message}</p>}
        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
      </div>
    </div>
  );
}
