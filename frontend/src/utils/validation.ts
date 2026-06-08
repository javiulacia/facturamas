import { z } from 'zod'

const emptyStringToUndefined = (value: unknown) => {
  if (typeof value === 'string' && value.trim() === '') {
    return undefined
  }

  return value
}

export const InvoiceLineSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().positive('Quantity must be positive'),
  unitPrice: z.number().nonnegative('Unit price cannot be negative'),
  vat: z.number().min(0).max(100, 'VAT must be between 0 and 100'),
  withholding: z.number().min(0).max(100, 'Withholding must be between 0 and 100'),
  subtotal: z.number().optional(),
  vatAmount: z.number().optional(),
  withholdingAmount: z.number().optional(),
  lineTotal: z.number().optional(),
})

export const ClientDataSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Client name is required'),
  taxId: z.string().min(1, 'Tax ID is required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  country: z.string().min(1, 'Country is required'),
  email: z.preprocess(emptyStringToUndefined, z.string().email('Invalid email').optional()),
})

export const ClientSchema = z.object({
  name: z.string().min(1, 'Client name is required'),
  taxId: z.string().min(1, 'Tax ID is required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  country: z.string().min(1, 'Country is required'),
  email: z.preprocess(emptyStringToUndefined, z.string().email('Invalid email').optional()),
})

export const ContactSchema = z.object({
  company: z.string().optional(),
  name: z.string().min(1, 'Contact name is required'),
  role: z.string().optional(),
  phone: z.string().optional(),
  email: z.preprocess(emptyStringToUndefined, z.string().email('Invalid email').optional()),
})

export const InvoiceSchema = z.object({
  issueDate: z.coerce.date(),
  dueDate: z.preprocess(emptyStringToUndefined, z.coerce.date().optional()),
  status: z.enum(['issued', 'paid']).default('issued'),
  billingUnit: z.enum(['hours', 'days', 'service']).default('hours'),
  client: ClientDataSchema,
  lines: z.array(InvoiceLineSchema).min(1, 'At least one line is required'),
  notes: z.string().optional(),
  currency: z.string().default('EUR'),
})

export const BudgetSchema = z.object({
  issueDate: z.coerce.date(),
  validUntil: z.preprocess(emptyStringToUndefined, z.coerce.date().optional()),
  status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'converted']).default('draft'),
  billingUnit: z.enum(['hours', 'days', 'service']).default('hours'),
  client: ClientDataSchema,
  lines: z.array(InvoiceLineSchema).min(1, 'At least one line is required'),
  notes: z.string().optional(),
  currency: z.string().default('EUR'),
})

export const InvoiceScheduleSchema = z.object({
  name: z.string().min(1, 'Schedule name is required'),
  startDate: z.coerce.date(),
  nextRunDate: z.preprocess(emptyStringToUndefined, z.coerce.date().optional()),
  endDate: z.preprocess(emptyStringToUndefined, z.coerce.date().optional()),
  dueDays: z.number().min(0, 'Due days cannot be negative'),
  interval: z.number().int().min(1, 'Interval must be at least 1'),
  frequency: z.enum(['weekly', 'monthly']),
  status: z.enum(['issued', 'paid']).default('issued'),
  billingUnit: z.enum(['hours', 'days', 'service']).default('hours'),
  client: ClientDataSchema,
  lines: z.array(InvoiceLineSchema).min(1, 'At least one line is required'),
  notes: z.string().optional(),
  currency: z.string().default('EUR'),
  active: z.boolean().default(true),
})

export const SettingsSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  taxId: z.string().min(1, 'Tax ID is required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  country: z.string().min(1, 'Country is required'),
  email: z.string().email('Invalid email'),
  phone: z.string().optional(),
  iban: z.string().optional(),
  logoUrl: z.string().refine((value) => {
    if (!value || value.trim() === '') return true
    return value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/api/assets/logos/')
  }, 'Invalid logo URL').optional(),
  defaultCurrency: z.string().default('EUR'),
  defaultVat: z.number().min(0).max(100, 'VAT must be between 0 and 100'),
  defaultWithholding: z.number().min(0).max(100, 'Withholding must be between 0 and 100'),
  defaultSeries: z.string().min(1, 'Series is required'),
})

export type InvoiceLine = z.infer<typeof InvoiceLineSchema>
export type ClientData = z.infer<typeof ClientDataSchema>
export type Client = z.infer<typeof ClientSchema>
export type Contact = z.infer<typeof ContactSchema>
export type Invoice = z.infer<typeof InvoiceSchema>
export type Budget = z.infer<typeof BudgetSchema>
export type InvoiceSchedule = z.infer<typeof InvoiceScheduleSchema>
export type Settings = z.infer<typeof SettingsSchema>
