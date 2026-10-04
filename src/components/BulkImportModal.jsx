import { useState } from 'react'
import { Download, FileUp, Loader2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '../lib/api'
import Modal from './ui/Modal'
import AlertMessage from './ui/AlertMessage'

const TEMPLATES = {
  students: {
    fileName: 'students-import-template.csv',
    headers: ['lrn', 'last_name', 'first_name', 'middle_name', 'birth_date', 'sex', 'grade_level', 'section', 'guardian_name', 'status'],
    example: ['REPLACE_WITH_LRN', 'Example', 'Student', '', '2012-04-25', 'F', 'Grade 6', 'Sampaguita', 'Example Guardian', 'enrolled'],
  },
  teachers: {
    fileName: 'teachers-import-template.csv',
    headers: ['staff_id', 'full_name', 'email', 'password'],
    example: ['SAMPLE-REPLACE', 'Example Teacher', 'teacher@example.invalid', 'REPLACE_WITH_SECURE_PASSWORD'],
  },
}

function parseCsv(text) {
  const rows = []
  let row = []
  let value = ''
  let quoted = false
  const source = text.replace(/^\uFEFF/, '')

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        value += '"'
        index += 1
      } else if (char === '"') {
        quoted = false
      } else {
        value += char
      }
    } else if (char === '"') {
      if (value !== '') throw new Error('CSV has a quote in an unquoted field.')
      quoted = true
    } else if (char === ',') {
      row.push(value)
      value = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') index += 1
      row.push(value)
      if (row.some(cell => cell.trim() !== '')) rows.push(row)
      row = []
      value = ''
    } else {
      value += char
    }
  }

  if (quoted) throw new Error('CSV contains an unclosed quoted field.')
  row.push(value)
  if (row.some(cell => cell.trim() !== '')) rows.push(row)
  if (rows.length < 2) throw new Error('Add at least one data row below the header row.')

  const headers = rows[0].map(header => header.trim().toLowerCase())
  if (headers.some(header => !header)) throw new Error('CSV contains an empty column header.')
  if (new Set(headers).size !== headers.length) throw new Error('CSV contains duplicate column headers.')
  return rows.slice(1).map((cells, index) => {
    if (cells.length !== headers.length) throw new Error(`CSV row ${index + 2} has ${cells.length} values; expected ${headers.length}.`)
    return Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex].trim()]))
  })
}

function downloadTemplate(type) {
  const template = TEMPLATES[type]
  const csv = [template.headers, template.example]
    .map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(','))
    .join('\r\n')
    .concat('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = template.fileName
  link.click()
  URL.revokeObjectURL(url)
}

export default function BulkImportModal({ type, onClose }) {
  const queryClient = useQueryClient()
  const [file, setFile] = useState(null)
  const [rows, setRows] = useState([])
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const label = type === 'teachers' ? 'teacher accounts' : 'students'

  async function handleFileChange(event) {
    const selected = event.target.files?.[0]
    setFile(selected || null)
    setResult(null)
    setError('')
    setRows([])
    if (!selected) return
    if (!selected.name.toLowerCase().endsWith('.csv')) {
      setError('Choose a CSV file.')
      return
    }
    if (selected.size > 2 * 1024 * 1024) {
      setError('CSV file must be 2 MB or smaller.')
      return
    }
    try {
      const parsed = parseCsv(await selected.text())
      if (parsed.length > 500) throw new Error('Import is limited to 500 rows per upload.')
      setRows(parsed)
    } catch (parseError) {
      setError(parseError.message)
    }
  }

  async function handleImport() {
    const hasSample = rows.some(row => type === 'students'
      ? row.lrn?.toUpperCase() === 'REPLACE_WITH_LRN'
      : row.staff_id?.toUpperCase() === 'SAMPLE-REPLACE')
    if (hasSample) {
      setError('The template sample row is still present. Replace it with a real record or delete that row before importing.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const response = await apiRequest('', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk_import', type, rows }),
      })
      setResult(response.data)
      if (response.data.imported > 0) {
        await queryClient.invalidateQueries({ queryKey: type === 'students' ? ['students'] : ['teachers'] })
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title={`Bulk import ${label}`} onClose={onClose} size="lg">
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          <p className="font-semibold text-slate-800">Instructions</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            <li>Download the CSV template and open it in a spreadsheet app or text editor.</li>
            <li>Keep the first row (column names) unchanged. Add one record per row, matching the columns.</li>
            <li><strong>Replace or delete the example row</strong> before saving. The importer blocks the untouched sample row.</li>
            <li>Save/export as CSV (UTF-8), choose the file below, review the number of rows, then import.</li>
          </ol>
          {type === 'students' ? (
            <p className="mt-2"><strong>Student fields:</strong> LRN, last name, first name, and grade are required. Grade must be Kinder or Grade 1–6. Birth date uses YYYY-MM-DD; sex is M or F; status is enrolled, transferred, graduated, or dropped. Other columns may be blank.</p>
          ) : (
            <p className="mt-2"><strong>Teacher fields:</strong> All columns are required. Staff ID may contain letters, numbers, and hyphens; use a valid, unique email and a temporary password of at least 8 characters. Share passwords securely and ask teachers to change them.</p>
          )}
          <p className="mt-2">Imports add new records only. Duplicate {type === 'teachers' ? 'staff IDs or emails' : 'LRNs'} are reported as errors. Up to 500 rows per import; each row is processed independently, so valid rows can import even when another row fails.</p>
        </div>

        <button type="button" onClick={() => downloadTemplate(type)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          <Download size={16} /> Download CSV template
        </button>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-700">CSV file</span>
          <input type="file" accept=".csv,text/csv" onChange={handleFileChange}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100" />
        </label>

        {file && rows.length > 0 && (
          <p className="text-sm text-slate-600">{file.name}: {rows.length} data row{rows.length === 1 ? '' : 's'} ready to import.</p>
        )}
        {error && <AlertMessage>{error}</AlertMessage>}

        {result && (
          <section className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 p-3" aria-live="polite">
            <p className="mb-2 text-sm font-semibold text-slate-800">
              Imported {result.imported}; failed {result.failed}.
            </p>
            {result.results.filter(row => !row.ok).length > 0 && (
              <ul className="space-y-1 text-sm text-red-700">
                {result.results.filter(row => !row.ok).map(row => (
                  <li key={row.row}>CSV row {row.row}: {row.error}</li>
                ))}
              </ul>
            )}
          </section>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
            Close
          </button>
          <button type="button" onClick={handleImport} disabled={loading || rows.length === 0 || result !== null}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <FileUp size={15} />}
            {loading ? 'Importing…' : 'Import rows'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
