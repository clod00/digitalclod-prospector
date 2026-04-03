import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
})

// LEADS
export const getLeads = (params) => api.get('/api/leads', { params })
export const getLead = (id) => api.get(`/api/leads/${id}`)
export const updateLead = (id, data) => api.patch(`/api/leads/${id}`, data)
export const deleteLead = (id) => api.delete(`/api/leads/${id}`)
export const getKpi = () => api.get('/api/leads/meta/kpi')
export const getSettori = () => api.get('/api/leads/meta/settori')

// ENRICH
export const enrichLead = (id) => api.post(`/api/enrich/${id}`)
export const enrichBulk = (ids) => api.post('/api/enrich/bulk', { ids }, {
  responseType: 'stream',
  timeout: 300000,
})

// AI
export const generateAI = (id) => api.post(`/api/ai/${id}`)

// IMPORT
export const previewImport = (file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/api/import/preview', form, { timeout: 30000 })
}

export const confirmImport = (file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/api/import/confirm', form, { timeout: 30000 })
}

// EXPORT
export const exportCSV = (params) => {
  const query = new URLSearchParams(params).toString()
  window.open(`${BASE_URL}/api/export/csv?${query}`, '_blank')
}

export const exportAddresses = (params) => {
  const query = new URLSearchParams(params).toString()
  window.open(`${BASE_URL}/api/export/addresses?${query}`, '_blank')
}

export const exportActiveCampaign = (params) => {
  const query = new URLSearchParams(params).toString()
  window.open(`${BASE_URL}/api/export/activecampaign?${query}`, '_blank')
}

export default api
