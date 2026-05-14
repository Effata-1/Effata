'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signup } from '@/app/auth/actions'
import { Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function SignupPage() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await signup(new FormData(e.currentTarget))
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="w-full max-w-sm px-6 space-y-8">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-white">Effata</h1>
            <p className="mt-1 text-sm text-zinc-400">Create your workspace</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">Organisation name</label>
            <input
              name="org_name"
              type="text"
              required
              placeholder="Acme Corp"
              className="w-full rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">Email</label>
            <input
              name="email"
              type="email"
              required
              placeholder="you@company.com"
              className="w-full rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">Password</label>
            <input
              name="password"
              type="password"
              required
              placeholder="Min. 8 characters"
              className="w-full rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 text-white">
            {loading ? 'Creating workspace…' : 'Create workspace'}
          </Button>
        </form>

        <p className="text-center text-xs text-zinc-600">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-zinc-400 hover:text-white transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
