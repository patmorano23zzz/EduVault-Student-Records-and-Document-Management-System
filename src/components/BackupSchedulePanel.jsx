import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CalendarClock, ChevronDown, ChevronUp, Download, Loader2, Save } from 'lucide-react'
import { apiRequest, downloadScheduledBackup } from '../lib/api'
import { useToast } from '../context/ToastContext'

const WEEKDAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' },
]

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10'

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(new Date(value))
}

export default function BackupSchedulePanel() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { data: schedule, isLoading, isError, error } = useQuery({
    queryKey: ['backup-schedule'],
    queryFn: async () => (await apiRequest('?action=backup_schedule_status')).data,
    refetchInterval: 5 * 60 * 1000,
  })
  const [draft, setDraft] = useState(null)
  const [clock, setClock] = useState(0)
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [formError, setFormError] = useState('')
  const defaults = useMemo(() => schedule ? {
    enabled: Boolean(Number(schedule.enabled)),
    frequency: schedule.frequency,
    run_time: schedule.run_time.slice(0, 5),
    day_of_week: Number(schedule.day_of_week),
    day_of_month: Number(schedule.day_of_month),
  } : {
    enabled: false,
    frequency: 'weekly',
    run_time: '02:00',
    day_of_week: 1,
    day_of_month: 1,
  }, [schedule])
  const form = draft ?? defaults
  const reminder = useMemo(() => {
    if (!schedule?.enabled || !schedule.next_run_at) return false
    const remaining = new Date(schedule.next_run_at).getTime() - clock
    return remaining >= 0 && remaining <= 24 * 60 * 60 * 1000
  }, [clock, schedule])

  useEffect(() => {
    const interval = window.setInterval(() => setClock(Date.now()), 60 * 1000)
    return () => window.clearInterval(interval)
  }, [])

  async function saveSchedule(event) {
    event.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      await apiRequest('', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'backup_schedule_save', ...form }),
      })
      setDraft(null)
      await queryClient.invalidateQueries({ queryKey: ['backup-schedule'] })
      toast(form.enabled ? 'Backup schedule saved.' : 'Automatic backups paused.', 'success')
    } catch (saveError) {
      setFormError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  async function downloadLatest() {
    setDownloading(true)
    try {
      await downloadScheduledBackup()
    } catch (downloadError) {
      toast(downloadError.message, 'error')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="shrink-0 rounded-xl bg-blue-50 p-2 text-blue-700"><CalendarClock size={18} /></span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900">Scheduled backups</h2>
            {isLoading ? (
              <p className="mt-0.5 text-xs text-slate-500">Loading schedule…</p>
            ) : isError ? (
              <p className="mt-0.5 truncate text-xs text-red-600">Could not load schedule: {error.message}</p>
            ) : (
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {schedule.enabled
                  ? `Next: ${formatDate(schedule.next_run_at)}`
                  : 'Automatic backups paused'}
                {schedule.last_run_at ? ` · Last: ${formatDate(schedule.last_run_at)}` : ''}
              </p>
            )}
          </div>
          {reminder && (
            <span role="status" className="hidden shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 sm:inline-flex">
              <AlertTriangle size={13} /> Due within 24 hours
            </span>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {reminder && (
            <span role="status" className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 sm:hidden">
              <AlertTriangle size={13} /> Due within 24 hours
            </span>
          )}
          <button type="button" onClick={downloadLatest} disabled={downloading || !schedule?.last_file || isError}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
            {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            <span className="hidden sm:inline">Download latest</span>
            <span className="sm:hidden">Download ZIP</span>
          </button>
          <button type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}
            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700">
            {expanded ? 'Close settings' : 'Configure'}
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {expanded && (
      <div className="space-y-4 border-t border-slate-100 p-4 sm:p-5">
        {reminder && (
          <div role="status" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle size={17} className="mt-0.5 shrink-0" />
            <p>Reminder: your next backup is scheduled for {formatDate(schedule.next_run_at)}.</p>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-slate-500">Loading backup schedule…</p>
        ) : isError ? (
          <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            Could not load backup schedule: {error.message}. For an existing database, import `database/backup-schedule-migration.sql` once.
          </div>
        ) : (
          <>
            <form onSubmit={saveSchedule} className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={form.enabled}
                  onChange={event => setDraft(current => ({ ...(current ?? defaults), enabled: event.target.checked }))}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                Enable automatic backups
              </label>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-xs font-medium text-slate-600">
                  Repeat
                  <select value={form.frequency} onChange={event => setDraft(current => ({ ...(current ?? defaults), frequency: event.target.value }))} className={`${inputClass} mt-1`}>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </label>

                {form.frequency === 'weekly' && (
                  <label className="text-xs font-medium text-slate-600">
                    Day of week
                    <select value={form.day_of_week} onChange={event => setDraft(current => ({ ...(current ?? defaults), day_of_week: Number(event.target.value) }))} className={`${inputClass} mt-1`}>
                      {WEEKDAYS.map(day => <option key={day.value} value={day.value}>{day.label}</option>)}
                    </select>
                  </label>
                )}

                {form.frequency === 'monthly' && (
                  <label className="text-xs font-medium text-slate-600">
                    Day of month
                    <select value={form.day_of_month} onChange={event => setDraft(current => ({ ...(current ?? defaults), day_of_month: Number(event.target.value) }))} className={`${inputClass} mt-1`}>
                      {Array.from({ length: 31 }, (_, index) => index + 1).map(day => <option key={day} value={day}>{day}</option>)}
                    </select>
                  </label>
                )}

                <label className="text-xs font-medium text-slate-600">
                  Time (Philippines)
                  <input type="time" required value={form.run_time} onChange={event => setDraft(current => ({ ...(current ?? defaults), run_time: event.target.value }))} className={`${inputClass} mt-1`} />
                </label>
              </div>

              <p className="text-xs text-slate-500">The dashboard reminder appears during the 24 hours before the next backup. Hostinger Cron Jobs must run `api/backup_cron.php` at least every 5 minutes for the schedule to execute.</p>
              {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
              {schedule.last_error && <p role="alert" className="text-sm text-red-600">Last backup failed: {schedule.last_error}</p>}

              <button type="submit" disabled={saving || isLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                {saving ? 'Saving…' : 'Save schedule'}
              </button>
            </form>

          </>
        )}
      </div>
      )}
    </section>
  )
}
