import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, ChevronRight, FileUp } from 'lucide-react'
import { useStudents, useUpsertStudent } from '../../hooks/useStudents'
import { PageHeader, Badge } from '../../components/ui/index'
import Modal from '../../components/ui/Modal'
import StudentForm from '../../components/StudentForm'
import SortControl, { sortRecords } from '../../components/SortControl'
import BulkImportModal from '../../components/BulkImportModal'

export default function AdminStudents() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null) // null | { mode: 'add' | 'edit', student? }
  const [bulkImport, setBulkImport] = useState(false)
  const [sort, setSort] = useState('last_name:asc')

  const { data: students = [], isLoading, error } = useStudents(search)
  const upsert = useUpsertStudent()
  const sortedStudents = useMemo(() => sortRecords(students, ...sort.split(':')), [students, sort])

  async function handleSave(form) {
    await upsert.mutateAsync(form)
    setModal(null)
  }

  return (
    <div>
      <PageHeader
        title="Students"
        subtitle={`${students.length} record${students.length !== 1 ? 's' : ''}`}
        action={<div className="flex flex-wrap gap-2">
          <button
            onClick={() => setBulkImport(true)}
            className="flex items-center gap-2 border border-blue-300 text-blue-700 hover:bg-blue-50 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <FileUp size={16} /> Bulk Import
          </button>
          <button
            onClick={() => setModal({ mode: 'add' })}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} /> Add Student
          </button>
        </div>}
      />

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name or LRN…"
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="mb-4 flex justify-end">
        <SortControl value={sort} onChange={setSort} options={[
          { value: 'last_name', label: 'Sort by name' },
          { value: 'grade_level', label: 'Sort by grade' },
          { value: 'status', label: 'Sort by status' },
          { value: 'created_at', label: 'Sort by date added' },
        ]} />
      </div>

      {/* Table */}
      <div className="table-scroll bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-red-500">{error.message}</div>
        ) : students.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No students found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['LRN', 'Name', 'Grade & Section', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedStudents.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.lrn}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {s.last_name}, {s.first_name} {s.middle_name ?? ''}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.grade_level}{s.section ? ` — ${s.section}` : ''}</td>
                  <td className="px-4 py-3"><Badge label={s.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setModal({ mode: 'edit', student: s })}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => navigate(`/admin/students/${s.id}`)}
                        className="text-gray-400 hover:text-gray-700 transition-colors"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <Modal
          title={modal.mode === 'add' ? 'Add Student' : 'Edit Student'}
          onClose={() => setModal(null)}
          size="lg"
        >
          <StudentForm
            initial={modal.student}
            onSubmit={handleSave}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
      {bulkImport && <BulkImportModal type="students" onClose={() => setBulkImport(false)} />}
    </div>
  )
}
