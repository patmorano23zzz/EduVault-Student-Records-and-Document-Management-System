/* Compatibility facade: the UI keeps its familiar data-access calls while all
 * traffic is handled by the Hostinger PHP API. */
const API = import.meta.env.VITE_API_URL || '/api/index.php'
export const apiRequest = async (path, options = {}) => {
  let csrf = document.cookie.split('; ').find(value => value.startsWith('csrf='))?.split('=')[1]
  if ((options.method || 'GET').toUpperCase() === 'POST' && !csrf) {
    await fetch(`${API}?action=session`, { credentials: 'include' })
    csrf = document.cookie.split('; ').find(value => value.startsWith('csrf='))?.split('=')[1]
  }
  const headers = { ...(options.headers || {}) }
  if (csrf) headers['X-CSRF-Token'] = csrf
  const response = await fetch(`${API}${path}`, { credentials: 'include', ...options, headers })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || body.error) throw new Error(body.error || 'Request failed')
  return body
}

const request = apiRequest

class Query {
  constructor(table) { this.table = table; this.params = {}; this.action = 'select' }
  select(columns = '*', options = {}) { this.params.select = columns; this.params.head = options.head ? '1' : ''; return this }
  eq(column, value) { this.params[`eq[${column}]`] = value; return this }
  or(value) { this.params.or = value; return this }
  order(column, { ascending = true } = {}) { this.params.order = column; this.params.direction = ascending ? 'asc' : 'desc'; return this }
  insert(row) { this.action = 'insert'; this.payload = row; return this }
  upsert(row) { this.action = 'upsert'; this.payload = row; return this }
  update(row) { this.action = 'update'; this.payload = row; return this }
  delete() { this.action = 'delete'; return this }
  single() { this.params.single = '1'; return this }
  maybeSingle() { this.params.single = 'maybe'; return this }
  then(resolve, reject) {
    const method = this.action === 'select' ? 'GET' : 'POST'
    const body = this.action === 'select' ? undefined : JSON.stringify({ table: this.table, action: this.action, data: this.payload, filters: this.params })
    const query = this.action === 'select' ? `?table=${encodeURIComponent(this.table)}&${new URLSearchParams(this.params)}` : ''
    return request(query, { method, headers: { 'Content-Type': 'application/json' }, body }).then(result => {
      const data = result.data ?? null
      return resolve({ data, error: null, count: result.count })
    }).catch(error => resolve({ data: null, error }))
  }
}

export const supabase = {
  from: table => new Query(table),
  rpc: (fn, args = {}) => request('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rpc: fn, args }) }).then(r => ({ data: r.data, error: null })).catch(error => ({ data: null, error })),
  auth: {
    getSession: () => request('?action=session').then(r => ({ data: { session: r.session }, error: null })).catch(error => ({ data: { session: null }, error })),
    getUser: () => request('?action=session').then(r => ({ data: { user: r.user }, error: null })),
    signInWithPassword: ({ email, password }) => request('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'login', email, password }) }).then(r => ({ data: r, error: null })).catch(error => ({ data: null, error })),
    signOut: () => request('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    admin: { createUser: payload => request('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create_teacher', ...payload }) }).then(data => ({ data, error: null })) },
  },
  storage: {
    from: () => ({
      upload: async (_path, file, options = {}) => { const form = new FormData(); form.append('file', file); form.append('path', _path); Object.entries(options.metadata || {}).forEach(([key, value]) => form.append(key, value ?? '')); const r = await request('?action=upload', { method: 'POST', body: form }); return { data: r.data, error: null } },
      remove: paths => request('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete_file', paths }) }),
      createSignedUrl: path => Promise.resolve({ data: { signedUrl: `${API}?action=download&path=${encodeURIComponent(path)}` }, error: null }),
    }),
  },
  channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
  removeChannel: () => {},
  functions: { invoke: (name, options) => request('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: name, ...(options?.body || {}) }) }) },
}

export async function downloadBackup() {
  const response = await fetch(`${API}?action=backup_download`, { credentials: 'include' })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || 'Backup download failed')
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `e-records-backup-${new Date().toISOString().slice(0, 10)}.zip`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
