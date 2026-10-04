import { useMemo, useState } from 'react'
import {
  Users, FileText, ClipboardList, CheckCircle, Upload, UserPlus,
  ArrowUpRight, Clock3, ShieldCheck, LockKeyhole, FileCheck2,
} from 'lucide-react'
import { useDashboardStats } from '../../hooks/useStats'
import { useRequests } from '../../hooks/useRequests'
import { useAllDocuments } from '../../hooks/useDocuments'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import SortControl, { sortRecords } from '../../components/SortControl'
import BackupSchedulePanel from '../../components/BackupSchedulePanel'

function StatCard({ icon: Icon, label, value, detail, color }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-start gap-4 shadow-sm">
      <div className={`${color} text-white rounded-xl p-3 shadow-sm`}>
        <Icon size={22} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold tracking-tight text-slate-900">{value ?? '—'}</p>
        <p className="text-sm text-slate-500">{label}</p>
        {detail && <p className="text-xs text-slate-400 mt-1">{detail}</p>}
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [activityFilter, setActivityFilter] = useState('all')
  const [requestSort, setRequestSort] = useState('created_at:desc')
  const [documentSort, setDocumentSort] = useState('created_at:desc')
  const { data: stats } = useDashboardStats()
  const { data: pending = [], isLoading: requestsLoading } = useRequests({ status: 'pending' })
  const { data: documents = [], isLoading: documentsLoading } = useAllDocuments()
  const recentDocuments = useMemo(
    () => sortRecords(documents, ...documentSort.split(':')).slice(0, 5),
    [documents, documentSort],
  )
  const filteredRequests = useMemo(() => {
    if (activityFilter === 'web') return pending.filter(request => request.source === 'web')
    if (activityFilter === 'teacher') return pending.filter(request => request.source === 'teacher')
    return pending
  }, [activityFilter, pending])
  const sortedRequests = useMemo(
    () => sortRecords(filteredRequests, ...requestSort.split(':')),
    [filteredRequests, requestSort],
  )
  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'
  const today = new Intl.DateTimeFormat('en-PH', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }).format(new Date())

  return (
    <div className="page-enter max-w-[1400px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-7">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 mb-2">Registrar workspace</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Good morning, {firstName}</h1>
          <p className="text-sm text-slate-500 mt-1">{today} · Here’s your records overview.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/admin/students')} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-300">
            <UserPlus size={16} /> Add student
          </button>
          <button onClick={() => navigate('/admin/documents')} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
            <Upload size={16} /> Upload file
          </button>
        </div>
      </div>

      <BackupSchedulePanel />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Users} label="Total students" value={stats?.students} detail="Active learner profiles" color="bg-blue-600" />
        <StatCard icon={FileText} label="Files in inventory" value={stats?.documents} detail="Across all school years" color="bg-indigo-600" />
        <StatCard icon={ClipboardList} label="Needs review" value={stats?.pendingRequests} detail="Requests waiting for action" color="bg-amber-500" />
        <StatCard icon={CheckCircle} label="Requests processed" value={stats?.totalRequests} detail="All-time request volume" color="bg-emerald-600" />
      </div>

      <div className="grid xl:grid-cols-[1.45fr_1fr] gap-5">
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">Request queue</h2>
              <p className="text-xs text-slate-400 mt-0.5">Live intake from teachers and guardians</p>
            </div>
            <button onClick={() => navigate('/admin/requests')} className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700">
              View queue <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="px-5 pt-4 flex items-center gap-2">
            {['all', 'web', 'teacher'].map(filter => (
              <button key={filter} onClick={() => setActivityFilter(filter)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${activityFilter === filter ? 'bg-blue-50 text-blue-700' : 'text-slate-400 hover:bg-slate-50'}`}>
                {filter === 'all' ? 'All requests' : `${filter} requests`}
              </button>
            ))}
          </div>
          <div className="px-5 pt-3 flex justify-end">
            <SortControl value={requestSort} onChange={setRequestSort} options={[
              { value: 'created_at', label: 'Sort requests by date' },
              { value: 'requester_name', label: 'Sort requests by name' },
              { value: 'source', label: 'Sort requests by source' },
            ]} />
          </div>
          <div className="p-5">
            {requestsLoading ? <div className="py-10 text-center text-sm text-slate-400">Loading queue…</div> : filteredRequests.length === 0 ? (
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-7 text-center">
                <ShieldCheck className="mx-auto text-emerald-600 mb-2" size={25} />
                <p className="text-sm font-semibold text-emerald-900">All caught up</p>
                <p className="text-xs text-emerald-700 mt-1">There are no requests waiting for review.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedRequests.slice(0, 5).map(request => (
                  <button key={request.id} onClick={() => navigate('/admin/requests')} className="w-full text-left flex items-center gap-3 rounded-xl border border-slate-100 px-3.5 py-3 hover:border-blue-200 hover:bg-blue-50/40 transition-colors">
                    <div className="h-9 w-9 shrink-0 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center"><Clock3 size={17} /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 truncate">{request.requester_name}</p>
                      <p className="text-xs text-slate-400 truncate">{request.document_types?.name ?? 'File request'} · {request.reference_code}</p>
                    </div>
                    <span className="text-[11px] text-slate-400 whitespace-nowrap">{new Date(request.created_at).toLocaleDateString('en-PH')}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="bg-slate-900 rounded-2xl p-5 text-white shadow-sm">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-300">Security center</p>
              <h2 className="font-semibold mt-1">Records protection</h2>
            </div>
            <div className="rounded-xl bg-white/10 p-2.5"><LockKeyhole size={19} className="text-blue-200" /></div>
          </div>
          <div className="space-y-4">
            {[
              ['Classified files', documents.filter(document => document.is_classified).length, 'Need verified access'],
              ['Files indexed', documents.length, 'Searchable in inventory'],
              ['Audit coverage', '100%', 'Actions are logged'],
            ].map(([label, value, detail]) => (
              <div key={label} className="flex items-center justify-between border-b border-white/10 pb-3 last:border-0 last:pb-0">
                <div><p className="text-sm text-slate-200">{label}</p><p className="text-xs text-slate-400 mt-0.5">{detail}</p></div>
                <p className="text-lg font-bold">{documentsLoading ? '—' : value}</p>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/admin/audit-logs')} className="mt-5 w-full rounded-xl bg-white/10 px-3 py-2.5 text-sm font-semibold text-blue-100 hover:bg-white/15">Review audit logs</button>
        </section>
      </div>

      <section className="mt-5 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Recently added files</h2>
            <p className="text-xs text-slate-400 mt-0.5">Latest documents secured in the inventory</p>
          </div>
          <button onClick={() => navigate('/admin/documents')} className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600">Browse inventory <ArrowUpRight size={15} /></button>
        </div>
        <div className="px-5 pt-3 flex justify-end">
          <SortControl value={documentSort} onChange={setDocumentSort} options={[
            { value: 'created_at', label: 'Sort files by date' },
            { value: 'title', label: 'Sort files by title' },
            { value: 'school_year', label: 'Sort files by school year' },
          ]} />
        </div>
        {documentsLoading ? <div className="p-8 text-center text-sm text-slate-400">Loading inventory…</div> : recentDocuments.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400"><FileCheck2 className="mx-auto mb-2 text-slate-300" size={23} />No files uploaded yet.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentDocuments.map(document => (
              <div key={document.id} className="flex items-center gap-3 px-5 py-3">
                <div className="h-9 w-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center"><FileText size={17} /></div>
                <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-slate-800 truncate">{document.title}</p><p className="text-xs text-slate-400 truncate">{document.students?.last_name}, {document.students?.first_name} · {document.document_types?.name ?? 'Document'}</p></div>
                {document.is_classified && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 bg-rose-50 rounded-full px-2 py-1"><LockKeyhole size={11} /> Classified</span>}
                <span className="hidden sm:block text-xs text-slate-400">{new Date(document.created_at).toLocaleDateString('en-PH')}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
