import { useEffect, useState } from 'react'
import { apiRequest } from '../../lib/api'

export default function AdminSettings() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiRequest('?action=recovery_email_status')
      .then(result => {
        setStatus(result.data)
        setEmail(result.data.recovery_email || result.data.pending_email || '')
      })
      .catch(requestError => setError(requestError.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage('')
    setError('')
    setSaving(true)
    try {
      await apiRequest('', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recovery_email_request', email: email.trim() }),
      })
      setMessage('A verification link has been sent. Open it to activate this recovery email.')
      setStatus(current => ({ ...current, pending_email: email.trim() }))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Account recovery</h1>
        <p className="mt-1 text-sm text-slate-500">Set and verify the email address used for administrator password resets.</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-semibold text-slate-900">Recovery email</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          We’ll send a verification link to this address. Password-reset links are single-use and expire after 30 minutes.
        </p>

        {loading ? (
          <p className="mt-5 text-sm text-slate-500">Loading recovery settings…</p>
        ) : (
          <>
            <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="font-medium text-slate-700">Current status: </span>
              {status?.verified_at
                ? <span className="text-emerald-700">Verified ({status.recovery_email})</span>
                : <span className="text-amber-700">No verified recovery email</span>}
            </div>
            {status?.pending_email && (
              <p className="mt-2 text-sm text-amber-700">Waiting for verification: {status.pending_email}</p>
            )}
            <form onSubmit={handleSubmit} className="mt-5 space-y-3">
              <label htmlFor="recovery-email" className="block text-sm font-medium text-slate-700">Email address</label>
              <input
                id="recovery-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={event => setEmail(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                placeholder="you@example.com"
              />
              {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
              {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Sending verification…' : 'Send verification link'}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  )
}
