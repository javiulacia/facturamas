/**
 * Application constants
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'
export const API_TIMEOUT = import.meta.env.VITE_API_TIMEOUT || 30000

export const APP_NAME = import.meta.env.VITE_APP_NAME || 'Facturamas'
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.1'

// Invoice status options
export const INVOICE_STATUSES = {
  DRAFT: 'draft',
  SENT: 'sent',
  PAID: 'paid',
  OVERDUE: 'overdue',
} as const
