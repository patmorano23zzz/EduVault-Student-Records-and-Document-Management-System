import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Upload } from 'lucide-react'
import { useStudent } from '../../hooks/useStudents'
import { useMyAssignments, studentMatchesAssignments } from '../../hooks/useAssignments'
import { useDocuments, useDocumentTypes } from '../../hooks/useDocuments'
import { useSubmitTeacherRequest } from '../../hooks/useRequests'
import { useAuth } from '../../context/AuthContext'
import { Badge } from '../../components/ui/index'
import Modal from '../../components/ui/Modal'
import DocumentList from '../../components/DocumentList'
import DocumentUploadForm from '../../components/DocumentUploadForm'
import { Loader2 } from 'lucide-react'
import AlertMessage from '../../components/ui/AlertMessage'

function InfoRow({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-medium text-gray-900">{value || '—'}</p>
    </div>
  )
}

export default function TeacherStudentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [modal, setModal] = useState(false)
  const [uploadModal, setUploadModal] = useState(false)
  const [typeId, setTypeId] = useState('')
  const [purpose, setPurpose] = useState('')
  const [refCode, setRefCode] = useState(null)
  const [error, setError] = useState('')

  const { data: student, isLoading } = useStudent(id)
  const { data: assignments = [], isLoading: assignmentsLoading } = useMyAssignments()
  const { data: documents = [], isLoading: docsLoading } = useDocuments(id)
  const { data: types = [] } = useDocumentTypes()
  const submitRequest = useSubmitTeacherRequest()

  // Only show non-classified docs to teachers (RLS also enforces this)
  const visibleDocs = documents.filter(d => !d.is_classified)

  async function handleRequest(e) {
    e.preventDefault()
    setError('')
    try {
      const result = await submitRequest.mutateAsync({
        requester_name: profile.full_name,
        student_id: id,
        student_lrn: student.lrn,
        student_last_name: student.last_name,
        document_type_id: typeId,
        purpose,
      })
      setRefCode(result.reference_code)
    } catch (err) {
      setError(err.message)
    }
  }

  if (isLoading || assignmentsLoading) return <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
  if (!student) return <div className="p-8 text-center text-sm text-red-500">Student not found.</div>
  if (!studentMatchesAssignments(student, assignments))
    return (
      <div className="p-8 text-center text-sm text-gray-500">
        You are not assigned to this student&apos;s grade level &amp; section, so their records are not visible to you.
      </div>
    )

  return (
    <div>
      <button onClick={() => navigate('/teacher')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors">
        <ArrowLeft size={16} /> Back to Students
      </button>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {student.last_name}, {student.first_name} {student.middle_name ?? ''}
            </h1>
            <p className="text-sm text-gray-400 font-mono mt-0.5">LRN: {student.lrn}</p>
          </div>
          <Badge label={student.status} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <InfoRow label="Grade Level" value={student.grade_level} />
          <InfoRow label="Section" value={student.section} />
          <InfoRow label="Sex" value={student.sex === 'M' ? 'Male' : student.sex === 'F' ? 'Female' : null} />
          <InfoRow label="Birth Date" value={student.birth_date} />
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900">Documents ({visibleDocs.length})</h2>
        <div className="flex flex-wrap justify-end gap-2">
          <button onClick={() => setUploadModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Upload size={15} /> Upload Document
          </button>
          <button onClick={() => { setModal(true); setRefCode(null); setTypeId(''); setPurpose(''); setError('') }}
            className="flex items-center gap-2 border border-emerald-600 text-emerald-700 hover:bg-emerald-50 text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Plus size={15} /> Request a File
          </button>
        </div>
      </div>
      <DocumentList documents={visibleDocs} loading={docsLoading} canDelete={false} />

      {uploadModal && (
        <Modal title="Upload Document" onClose={() => setUploadModal(false)} size="md">
          <DocumentUploadForm
            studentId={id}
            allowClassification={false}
            onSuccess={() => setUploadModal(false)}
            onCancel={() => setUploadModal(false)}
          />
        </Modal>
      )}

      {modal && (
        <Modal title="Request a File" onClose={() => setModal(false)} size="sm">
          {refCode ? (
            <div className="text-center py-4">
              <p className="text-sm text-gray-600 mb-3">Request submitted! Your reference code:</p>
              <p className="text-2xl font-mono font-bold text-emerald-600 tracking-widest">{refCode}</p>
              <button onClick={() => setModal(false)}
                className="mt-5 text-sm text-gray-500 hover:text-gray-800 transition-colors">Close</button>
            </div>
          ) : (
            <form onSubmit={handleRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Document Type *</label>
                <select required value={typeId} onChange={e => setTypeId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="">Select…</option>
                  {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Purpose *</label>
                <textarea required value={purpose} onChange={e => setPurpose(e.target.value)} rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  placeholder="Reason for requesting this document…" />
              </div>
              {error && <AlertMessage>{error}</AlertMessage>}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">Cancel</button>
                <button type="submit" disabled={submitRequest.isPending}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
                  {submitRequest.isPending && <Loader2 size={14} className="animate-spin" />}
                  Submit
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  )
}
