import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
export const ACTIVE_PROFILE_STORAGE_KEY = 'invoices.activeProfileId'

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

const apiOrigin = API_BASE_URL.replace(/\/api$/, '')

export function resolveAssetUrl(url?: string) {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/')) return `${apiOrigin}${url}`
  return url
}

export function getStoredActiveProfileId() {
  return window.localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY) || ''
}

export function setStoredActiveProfileId(profileId: string) {
  if (profileId) {
    window.localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, profileId)
    apiClient.defaults.headers.common['X-Profile-Id'] = profileId
    return
  }

  window.localStorage.removeItem(ACTIVE_PROFILE_STORAGE_KEY)
  delete apiClient.defaults.headers.common['X-Profile-Id']
}

apiClient.interceptors.request.use((config) => {
  const profileId = getStoredActiveProfileId()
  if (profileId) {
    config.headers['X-Profile-Id'] = profileId
  }
  return config
})

export const settingsAPI = {
  getSettings: () => apiClient.get('/settings'),
  exportBackup: () => apiClient.get('/settings/backup', { responseType: 'blob' }),
  importBackup: (backup: any) => apiClient.post('/settings/import-backup', backup),
  syncProfiles: () => apiClient.post('/settings/sync-profiles'),
  updateSettings: (settings: any) => apiClient.put('/settings', settings),
  resetInvoices: () => apiClient.post('/settings/reset-invoices'),
  resetClients: () => apiClient.post('/settings/reset-clients'),
  resetContacts: () => apiClient.post('/settings/reset-contacts'),
}

export const profilesAPI = {
  listProfiles: () => apiClient.get('/profiles'),
  getProfile: (id: string) => apiClient.get(`/profiles/${id}`),
  updateProfile: (id: string, profile: any) => apiClient.put(`/profiles/${id}`, profile),
}

export const clientsAPI = {
  listClients: () => apiClient.get('/clients'),
  getClient: (id: string) => apiClient.get(`/clients/${id}`),
  createClient: (client: any) => apiClient.post('/clients', client),
  updateClient: (id: string, client: any) => apiClient.put(`/clients/${id}`, client),
  deleteClient: (id: string) => apiClient.delete(`/clients/${id}`),
}

export const contactsAPI = {
  listContacts: () => apiClient.get('/contacts'),
  getContact: (id: string) => apiClient.get(`/contacts/${id}`),
  createContact: (contact: any) => apiClient.post('/contacts', contact),
  updateContact: (id: string, contact: any) => apiClient.put(`/contacts/${id}`, contact),
  deleteContact: (id: string) => apiClient.delete(`/contacts/${id}`),
}

const withProfileQuery = (path: string, profileId?: string) => {
  if (!profileId) return `${apiOrigin}${path}`
  return `${apiOrigin}${path}?profileId=${encodeURIComponent(profileId)}`
}

export const invoicesAPI = {
  listInvoices: () => apiClient.get('/invoices'),
  getInvoice: (id: string) => apiClient.get(`/invoices/${id}`),
  getInvoicePdfUrl: (id: string, profileId?: string) => withProfileQuery(`/api/invoices/${id}/pdf`, profileId),
  getInvoicePdfDownloadUrl: (id: string, profileId?: string) => withProfileQuery(`/api/invoices/${id}/pdf/download`, profileId),
  downloadInvoicePdf: (id: string) => apiClient.get(`/invoices/${id}/pdf/download`, { responseType: 'blob' }),
  createInvoice: (invoice: any) => apiClient.post('/invoices', invoice),
  updateInvoice: (id: string, invoice: any) => apiClient.put(`/invoices/${id}`, invoice),
  deleteInvoice: (id: string) => apiClient.delete(`/invoices/${id}`),
  duplicateInvoice: (id: string) => apiClient.post(`/invoices/${id}/duplicate`),
}

export const budgetsAPI = {
  listBudgets: () => apiClient.get('/budgets'),
  getBudget: (id: string) => apiClient.get(`/budgets/${id}`),
  createBudget: (budget: any) => apiClient.post('/budgets', budget),
  updateBudget: (id: string, budget: any) => apiClient.put(`/budgets/${id}`, budget),
  deleteBudget: (id: string) => apiClient.delete(`/budgets/${id}`),
  duplicateBudget: (id: string) => apiClient.post(`/budgets/${id}/duplicate`),
  convertToInvoice: (id: string) => apiClient.post(`/budgets/${id}/convert-to-invoice`),
}

export const invoiceSchedulesAPI = {
  listSchedules: () => apiClient.get('/invoice-schedules'),
  getSchedule: (id: string) => apiClient.get(`/invoice-schedules/${id}`),
  createSchedule: (schedule: any) => apiClient.post('/invoice-schedules', schedule),
  updateSchedule: (id: string, schedule: any) => apiClient.put(`/invoice-schedules/${id}`, schedule),
  deleteSchedule: (id: string) => apiClient.delete(`/invoice-schedules/${id}`),
  generateDueInvoices: (id: string) => apiClient.post(`/invoice-schedules/${id}/generate-due`),
}

export default apiClient
