import { useState } from 'react'
import { Loader2, UploadCloud } from 'lucide-react'
import { useDocumentTypes, useUploadDocument } from '../hooks/useDocuments'
import AlertMessage from './ui/AlertMessage'

const MAX_MB = 10

export default function DocumentUploadForm({ studentId, onSuccess, onCancel, allowClassification = true }) {
  const { data: types = [] } = useDocumentTypes()
  const upload = useUploadDocument()

  const [file, setFile] = useState(null)
  const [typeId, setTypeId] = useState('')
  const [title, setTitle] = useState('')
  const [schoolYear, setSchoolYear] = useState('')
  const [gradeLevel, setGradeLevel] = useState('')
  const [isClassified, setIsClassified] = useState(false)
  const [error, setError] = useState('')

  function handleFile(e) {
    const f = e.target.files[0]
    if (!f) return
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`File must be under ${MAX_MB} MB.`)
      return
    }
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(f.type)) {
      setError('Only PDF, JPG, PNG, or WEBP files are allowed.')
      return
    }
    setError('')
    setFile(f)
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!file) return setError('Please select a file.')
    if (!typeId) return setError('Please select a document type.')
    setError('')
    try {
      await upload.mutateAsync({ file, studentId, typeId, title, schoolYear, gradeLevel, isClassified })
      onSuccess?.()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* File drop zone */}
      <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-6 cursor-pointer hover:border-blue-400 transition-colors">
        <UploadCloud size={28} className="text-gray-400 mb-2" />
        <span className="text-sm text-gray-500">
          {file ? file.name : 'Click to select a file (PDF, JPG, PNG — max 20 MB)'}
        </span>
        <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleFile} />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="col-span-full sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Document Type *</label>
          <select required value={typeId} onChange={e => setTypeId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Select type…</option>
            {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        <div className="col-span-full sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
          <input required value={title} onChange={e => setTitle(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. Form 137 — Grade 6" />
        </div>

        <div className="sm:col-span-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">School Year</label>
          <input value={schoolYear} onChange={e => setSchoolYear(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="2024-2025" />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Grade Level</label>
          <input value={gradeLevel} onChange={e => setGradeLevel(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Grade 6" />
        </div>
      </div>

      {allowClassification && (
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={isClassified} onChange={e => setIsClassified(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
          Mark as classified (hidden from teachers)
        </label>
      )}

      {error && <AlertMessage>{error}</AlertMessage>}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-2">
        <button type="button" onClick={onCancel}
          className="w-full sm:w-auto px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={upload.isPending}
          className="w-full sm:w-auto justify-center flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
          {upload.isPending && <Loader2 size={14} className="animate-spin" />}
          Upload
        </button>
      </div>
    </form>
  )
}
