import { useMemo, useState } from 'react'
import { Plus, Loader2, UserCheck, UserX, KeyRound, FileUp } from 'lucide-react'
import { useTeachers, useToggleTeacherActive } from '../../hooks/useTeachers'
import { PageHeader, Badge } from '../../components/ui/index'
import Modal from '../../components/ui/Modal'
import { useToast } from '../../context/ToastContext'
import { supabase } from '../../lib/api'
import { useQueryClient } from '@tanstack/react-query'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import PasswordInput from '../../components/ui/PasswordInput'
import AlertMessage from '../../components/ui/AlertMessage'
import {
  useTeacherAssignments,
  useAddAssignment,
  useRemoveAssignment,
} from '../../hooks/useAssignments'
import { Trash2, FolderPlus } from 'lucide-react'
import SortControl, { sortRecords } from '../../components/SortControl'
import BulkImportModal from '../../components/BulkImportModal'

const GRADE_LEVELS = ['Kinder', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6']

function AssignmentsModal({ teacher }) {
  const toast = useToast()
  const { data: assignments = [], isLoading } = useTeacherAssignments(teacher.id)
  const addAssignment = useAddAssignment()
  const removeAssignment = useRemoveAssignment()
  const [grade, setGrade] = useState('')
  const [section, setSection] = useState('')

  async function handleAdd(e) {
    e.preventDefault()
    try {
      await addAssignment.mutateAsync({ teacher_id: teacher.id, grade_level: grade, section })
      toast(`Assigned ${teacher.full_name} to ${grade}${section ? ` — ${section}` : ''}.`, 'success')
      setGrade('')
      setSection('')
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  async function handleRemove(a) {
    try {
      await removeAssignment.mutateAsync(a.id)
      toast(`Removed ${teacher.full_name} from ${a.grade_level}${a.section ? ` — ${a.section}` : ''}.`, 'success')
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        Grade levels &amp; sections <span className="font-medium text-gray-900">{teacher.full_name}</span> can view:
      </p>

      {isLoading ? (
        <div className="p-6 text-center text-sm text-gray-400">Loading…</div>
      ) : assignments.length === 0 ? (
        <div className="p-6 text-center text-sm text-gray-400 border border-dashed border-gray-300 rounded-xl mb-4">
          No assignments yet — this teacher currently sees no student records.
        </div>
      ) : (
        <ul className="space-y-2 mb-4 max-h-56 overflow-y-auto pr-1">
          {assignments.map(a => (
            <li key={a.id}
              className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <span className="text-sm text-gray-800">
                <span className="font-medium">{a.grade_level}</span>
                {a.section && <span className="text-gray-500"> — {a.section}</span>}
              </span>
              <button onClick={() => handleRemove(a)} disabled={removeAssignment.isPending}
                className="text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors" title="Remove">
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="border-t border-gray-100 pt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Grade Level *</label>
            <select required value={grade} onChange={e => setGrade(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select…</option>
              {GRADE_LEVELS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Section</label>
            <input value={section} onChange={e => setSection(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Sampaguita" />
          </div>
        </div>
        <div className="flex justify-end pt-3">
          <button type="submit" disabled={addAssignment.isPending}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            {addAssignment.isPending ? <Loader2 size={14} className="animate-spin" /> : <FolderPlus size={15} />}
            Add Assignment
          </button>
        </div>
      </form>
    </div>
  )
}

function CreateTeacherForm({ onClose }) {
  const toast = useToast()
  const qc = useQueryClient()
  const [form, setForm] = useState({ staff_id: '', full_name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error } = await supabase.auth.admin.createUser({
        email: form.email,
        password: form.password,
        staff_id: form.staff_id,
        full_name: form.full_name,
        user_metadata: { staff_id: form.staff_id, full_name: form.full_name, role: 'teacher' },
      })
      if (error) throw error
      toast(`Teacher account created for ${form.full_name}.`, 'success')
      qc.invalidateQueries({ queryKey: ['teachers'] })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }

  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Staff ID number *</label>
        <input required value={form.staff_id} onChange={e => set('staff_id', e.target.value.toUpperCase())}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="TCH-001" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
        <input required value={form.full_name} onChange={e => set('full_name', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Maria Santos" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
        <input required type="email" value={form.email} onChange={e => set('email', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="teacher@school.edu.ph" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Temporary Password *</label>
        <PasswordInput required minLength={8} value={form.password} onChange={e => set('password', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Min. 8 characters" />
      </div>
      {error && <AlertMessage>{error}</AlertMessage>}
      <p className="text-xs text-gray-400">The teacher will use this staff ID and password to log in. Ask them to change their password after first login.</p>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">Cancel</button>
        <button type="submit" disabled={loading}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
          {loading && <Loader2 size={14} className="animate-spin" />}
          Create Account
        </button>
      </div>
    </form>
  )
}

function ResetPasswordForm({ teacher, onClose }) {
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirmPassword) return setError('Passwords do not match.')
    setLoading(true)
    try {
      const { error: resetError } = await supabase.functions.invoke('reset_teacher_password', {
        body: { teacher_id: teacher.id, password },
      })
      if (resetError) throw resetError
      toast(`Password reset for ${teacher.full_name}.`, 'success')
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-500">Set a new password for <span className="font-medium text-gray-900">{teacher.full_name}</span>.</p>
      <PasswordInput required minLength={8} value={password} onChange={e => setPassword(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="New password (min. 8 characters)" />
      <PasswordInput required minLength={8} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Confirm new password" />
      {error && <AlertMessage>{error}</AlertMessage>}
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
        <button type="submit" disabled={loading} className="flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-5 py-2 rounded-lg disabled:opacity-60">
          {loading && <Loader2 size={14} className="animate-spin" />} {loading ? 'Saving…' : 'Reset Password'}
        </button>
      </div>
    </form>
  )
}

export default function AdminTeachers() {
  const { data: teachers = [], isLoading, isError, error } = useTeachers()
  const toggle = useToggleTeacherActive()
  const toast = useToast()
  const [modal, setModal] = useState(false)
  const [bulkImport, setBulkImport] = useState(false)
  const [confirmToggle, setConfirmToggle] = useState(null)
  const [assignmentsFor, setAssignmentsFor] = useState(null)
  const [passwordFor, setPasswordFor] = useState(null)
  const [sort, setSort] = useState('full_name:asc')
  const sortedTeachers = useMemo(() => sortRecords(teachers, ...sort.split(':')), [teachers, sort])

  async function handleToggle(teacher) {
    try {
      await toggle.mutateAsync({ id: teacher.id, is_active: !teacher.is_active })
      toast(`${teacher.full_name} ${!teacher.is_active ? 'activated' : 'deactivated'}.`, 'success')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setConfirmToggle(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Teachers"
        subtitle="Manage teacher portal accounts"
        action={<div className="flex flex-wrap gap-2">
          <button onClick={() => setBulkImport(true)}
            className="flex items-center gap-2 border border-blue-300 text-blue-700 hover:bg-blue-50 text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <FileUp size={16} /> Bulk Import
          </button>
          <button onClick={() => setModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Plus size={16} /> Add Teacher
          </button>
        </div>}
      />

      <div className="table-scroll bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex justify-end border-b border-gray-100 p-3">
          <SortControl value={sort} onChange={setSort} options={[
            { value: 'full_name', label: 'Sort by name' },
            { value: 'created_at', label: 'Sort by date added' },
            { value: 'is_active', label: 'Sort by status' },
          ]} />
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
        ) : isError ? (
          <div className="p-8 text-center text-sm text-red-600">
            Unable to load teacher accounts: {error.message}
          </div>
        ) : teachers.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No teacher accounts yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Name', 'Status', 'Created', 'Assignments', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedTeachers.map(t => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{t.full_name}</p>
                    <p className="text-xs text-gray-400 font-mono">{t.staff_id ?? 'No staff ID'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge label={t.is_active ? 'enrolled' : 'dropped'} />
                    <span className="ml-2 text-xs text-gray-400">{t.is_active ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(t.created_at).toLocaleDateString('en-PH')}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setAssignmentsFor(t)}
                      className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors">
                      <FolderPlus size={14} /> Assign Grade &amp; Section
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-2">
                      <button onClick={() => setPasswordFor(t)}
                        className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors">
                        <KeyRound size={14} /> Reset Password
                      </button>
                      <button
                        onClick={() => setConfirmToggle(t)}
                        disabled={toggle.isPending}
                        className={`flex items-center gap-1.5 text-xs font-medium transition-colors disabled:opacity-50
                          ${t.is_active ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}`}
                      >
                        {t.is_active
                          ? <><UserX size={14} /> Deactivate</>
                          : <><UserCheck size={14} /> Activate</>
                        }
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
        <Modal title="Add Teacher Account" onClose={() => setModal(false)} size="sm">
          <CreateTeacherForm onClose={() => setModal(false)} />
        </Modal>
      )}
      {bulkImport && <BulkImportModal type="teachers" onClose={() => setBulkImport(false)} />}
      {assignmentsFor && (
        <Modal title="Assign Grade & Section" onClose={() => setAssignmentsFor(null)} size="sm">
          <AssignmentsModal teacher={assignmentsFor} onClose={() => setAssignmentsFor(null)} />
        </Modal>
      )}
      {passwordFor && (
        <Modal title="Reset Teacher Password" onClose={() => setPasswordFor(null)} size="sm">
          <ResetPasswordForm teacher={passwordFor} onClose={() => setPasswordFor(null)} />
        </Modal>
      )}
      {confirmToggle && (
        <ConfirmDialog
          title={`${confirmToggle.is_active ? 'Deactivate' : 'Activate'} teacher?`}
          message={`${confirmToggle.is_active ? 'This teacher will lose portal access.' : 'This teacher will regain portal access.'} Continue for ${confirmToggle.full_name}?`}
          confirmLabel={confirmToggle.is_active ? 'Deactivate' : 'Activate'}
          onClose={() => setConfirmToggle(null)}
          onConfirm={() => handleToggle(confirmToggle)}
          loading={toggle.isPending}
          danger={confirmToggle.is_active}
        />
      )}
    </div>
  )
}
