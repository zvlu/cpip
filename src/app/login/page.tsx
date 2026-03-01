'use client'

import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      router.push('/')
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-zinc-900 p-12 border-r border-zinc-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-500 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <span className="text-xl font-bold text-zinc-50 tracking-tight">CreatorPulse</span>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <h1 className="text-4xl font-bold text-zinc-50 leading-tight text-balance">
            Track creator performance.<br />
            Maximize affiliate revenue.
          </h1>
          <p className="text-lg text-zinc-400 max-w-md leading-relaxed">
            The intelligence platform for brands managing TikTok Shop affiliate programs. Real-time analytics, creator insights, and revenue tracking in one place.
          </p>
          <div className="flex gap-8 pt-4">
            <div>
              <div className="text-2xl font-bold text-zinc-50">10K+</div>
              <div className="text-sm text-zinc-500">Creators tracked</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-zinc-50">$2.4M</div>
              <div className="text-sm text-zinc-500">Revenue monitored</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-zinc-50">98%</div>
              <div className="text-sm text-zinc-500">Uptime</div>
            </div>
          </div>
        </div>

        <p className="text-sm text-zinc-600">
          CreatorPulse by CPIP Inc.
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 flex-col items-center justify-center bg-zinc-950 px-6 py-12">
        {/* Mobile logo */}
        <div className="flex lg:hidden items-center gap-3 mb-10">
          <div className="h-9 w-9 rounded-lg bg-blue-500 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <span className="text-xl font-bold text-zinc-50 tracking-tight">CreatorPulse</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="flex flex-col gap-2 mb-8">
            <h2 className="text-2xl font-bold text-zinc-50">Welcome back</h2>
            <p className="text-sm text-zinc-400">Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-medium text-zinc-300">
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@company.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 rounded-lg border border-zinc-800 bg-zinc-900 px-4 text-sm text-zinc-50 placeholder-zinc-500 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-sm font-medium text-zinc-300">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 rounded-lg border border-zinc-800 bg-zinc-900 px-4 text-sm text-zinc-50 placeholder-zinc-500 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="h-11 rounded-lg bg-blue-500 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-500">
            {"Don't have an account? "}
            <Link href="/sign-up" className="text-blue-400 hover:text-blue-300 transition">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
