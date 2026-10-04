import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/api'
import { useAuth } from '../context/AuthContext'

const KEY = ['documents']

export function useDocuments(studentId) {
  return useQuery({
    queryKey: [...KEY, studentId],
    queryFn: async () => {
      let q = supabase
        .from('documents')
        .select('*, document_types(code, name), profiles(full_name)')
        .order('created_at', { ascending: false })
      if (studentId) q = q.eq('student_id', studentId)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}

export function useAllDocuments(search = '') {
  return useQuery({
    queryKey: [...KEY, 'all', search],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_admin_documents', {
        p_search: search.trim() || null,
      })
      if (error) throw error
      return (data ?? []).map(document => ({
        ...document,
        document_types: document.document_type_code
          ? { code: document.document_type_code, name: document.document_type_name }
          : null,
        students: document.student_id
          ? {
              id: document.student_id,
              last_name: document.student_last_name,
              first_name: document.student_first_name,
              lrn: document.student_lrn,
              grade_level: document.student_grade_level,
              section: document.student_section,
            }
          : null,
        profiles: document.uploader_name ? { full_name: document.uploader_name } : null,
      }))
    },
  })
}

export function useDocumentTypes() {
  return useQuery({
    queryKey: ['document_types'],
    queryFn: async () => {
      const { data, error } = await supabase.from('document_types').select('*').order('name')
      if (error) throw error
      return data
    },
    staleTime: Infinity,
  })
}

export function useUploadDocument() {
  const qc = useQueryClient()
  const { profile } = useAuth()

  return useMutation({
    mutationFn: async ({ file, studentId, typeId, title, schoolYear, gradeLevel, isClassified }) => {
      const path = `${studentId}/${Date.now()}_${file.name}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('student-files')
        .upload(path, file, {
          contentType: file.type,
          metadata: { student_id: studentId, type_id: typeId, school_year: schoolYear },
        })
      if (uploadError) throw uploadError

      try {
        const { error: dbError } = await supabase.from('documents').insert({
          student_id: studentId,
          type_id: typeId,
          title,
          school_year: schoolYear,
          grade_level: gradeLevel,
          storage_path: uploadData.path,
          file_name: file.name,
          mime_type: file.type,
          file_size: file.size,
          uploaded_by: profile?.id,
          is_classified: isClassified,
        })
        if (dbError) throw dbError
      } catch (error) {
        try {
          await supabase.storage.from('student-files').remove([uploadData.path])
        } catch (cleanupError) {
          throw new Error(`${error.message} (Uploaded file cleanup also failed: ${cleanupError.message})`)
        }
        throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, storagePath }) => {
      await supabase.storage.from('student-files').remove([storagePath])
      const { error } = await supabase.from('documents').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export async function getSignedUrl(storagePath) {
  const { data, error } = await supabase.storage
    .from('student-files')
    .createSignedUrl(storagePath, 60) // 60s expiry
  if (error) throw error
  return data.signedUrl
}
