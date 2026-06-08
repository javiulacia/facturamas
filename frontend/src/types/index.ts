export type InvoiceStatus = 'issued' | 'paid'
export type BudgetStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'converted'
export type BillingUnit = 'hours' | 'days' | 'service'
export type ProfileType = 'self_employed' | 'company'
export type InvoiceScheduleFrequency = 'weekly' | 'monthly'

export interface Profile {
  id?: string
  key: string
  type: ProfileType
  isDefault: boolean
  name: string
  taxId: string
  address: string
  city: string
  postalCode: string
  country: string
  email: string
  phone?: string
  iban?: string
  logoUrl?: string
  defaultCurrency: string
  defaultVat: number
  defaultWithholding: number
  defaultSeries: string
  sequenceCounter?: number
  createdAt?: string | Date
  updatedAt?: string | Date
}

export interface InvoiceLine {
  description: string
  quantity: number
  unitPrice: number
  vat: number
  withholding: number
  subtotal: number
  vatAmount: number
  withholdingAmount: number
  lineTotal: number
}

export interface ClientData {
  id?: string
  name: string
  taxId: string
  address: string
  city: string
  postalCode: string
  country: string
  email?: string
}

export interface EmitterData {
  profileId?: string
  profileName?: string
  profileType?: ProfileType
  name: string
  taxId: string
  address: string
  city: string
  postalCode: string
  country: string
  email: string
  phone: string
  iban: string
  logoUrl?: string
  defaultCurrency: string
  defaultVat: number
  defaultWithholding: number
}

export interface Invoice {
  id?: string
  profileId?: string
  number?: string
  series?: string
  sequence?: number
  issueDate: string | Date
  dueDate?: string | Date
  status: InvoiceStatus
  billingUnit: BillingUnit
  emitter?: EmitterData
  client: ClientData
  lines: InvoiceLine[]
  subtotal?: number
  vatAmount?: number
  withholdingAmount?: number
  grandTotal?: number
  notes?: string
  currency: string
  pdfFilename?: string
  createdAt?: string | Date
  updatedAt?: string | Date
}

export interface Budget {
  id?: string
  profileId?: string
  number?: string
  series?: string
  sequence?: number
  issueDate: string | Date
  validUntil?: string | Date
  status: BudgetStatus
  billingUnit: BillingUnit
  emitter?: EmitterData
  client: ClientData
  lines: InvoiceLine[]
  subtotal?: number
  vatAmount?: number
  withholdingAmount?: number
  grandTotal?: number
  notes?: string
  currency: string
  convertedInvoiceId?: string
  convertedAt?: string | Date
  createdAt?: string | Date
  updatedAt?: string | Date
}

export interface InvoiceSchedule {
  id?: string
  profileId?: string
  name: string
  client: ClientData
  billingUnit: BillingUnit
  lines: InvoiceLine[]
  notes?: string
  currency: string
  status: InvoiceStatus
  frequency: InvoiceScheduleFrequency
  interval: number
  startDate: string | Date
  nextRunDate?: string | Date
  endDate?: string | Date
  dueDays: number
  lastRunAt?: string | Date
  active: boolean
  createdAt?: string | Date
  updatedAt?: string | Date
}

export type Settings = Profile

export interface Client {
  id?: string
  profileId?: string
  name: string
  taxId: string
  address: string
  city: string
  postalCode: string
  country: string
  email?: string
  createdAt?: string | Date
  updatedAt?: string | Date
}

export interface Contact {
  id?: string
  profileId?: string
  company?: string
  name: string
  role?: string
  phone?: string
  email?: string
  createdAt?: string | Date
  updatedAt?: string | Date
}
