import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiRequest } from '../../lib/api'
import PasswordInput from '../../components/ui/PasswordInput'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [complete, setComplete] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }
    setLoading(true)
    try {
      await apiRequest('', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'password_reset_complete',
          token: searchParams.get('token') || '',
          password,
        }),
      })
      setComplete(true)
      setPassword('')
      setConfirmPassword('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Set a new password</h1>
        {complete ? (
          <>
            <p className="mt-3 text-sm text-emerald-700">Password updated. Sign in using your new password.</p>
            <Link to="/login" className="mt-5 block rounded-lg bg-blue-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-blue-700">Return to sign in</Link>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-600">Choose a password with at least 12 characters.</p>
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <PasswordInput required minLength={12} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="New password" />
              <PasswordInput required minLength={12} autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} placeholder="Confirm new password" />
              {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
              <button disabled={loading} className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                {loading ? 'Updating password…' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  )
}
