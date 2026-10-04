import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiRequest } from '../../lib/api'

export default function VerifyRecoveryEmail() {
  const [searchParams] = useSearchParams()
  const [state, setState] = useState('ready')
  const [error, setError] = useState('')

  async function verify() {
    setState('loading')
    setError('')
    try {
      await apiRequest('', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recovery_email_confirm', token: searchParams.get('token') || '' }),
      })
      setState('complete')
    } catch (requestError) {
      setError(requestError.message)
      setState('error')
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Verify recovery email</h1>
        {state === 'complete' ? (
          <p className="mt-3 text-sm text-emerald-700">Your recovery email is verified. You can now request an administrator password reset.</p>
        ) : (
          <p className="mt-3 text-sm text-slate-600">Confirm this email address as the administrator account’s recovery address.</p>
        )}
        {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
        {state === 'ready' && (
          <button onClick={verify} className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
            Verify email
          </button>
        )}
        {state === 'loading' && <p className="mt-5 text-sm text-slate-500">Verifying…</p>}
        <Link to="/login" className="mt-5 block text-center text-sm font-medium text-blue-600 hover:text-blue-700">Return to sign in</Link>
      </section>
    </main>
  )
}
