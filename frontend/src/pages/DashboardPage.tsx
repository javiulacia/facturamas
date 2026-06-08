import { useEffect, useMemo, useState } from 'react'
import { budgetsAPI, invoicesAPI, invoiceSchedulesAPI } from '../services/api'
import { Budget, Invoice, InvoiceLine, InvoiceSchedule, Profile } from '../types'
import { calculateLineTotal, formatCurrency } from '../utils'

interface DashboardPageProps {
  activeProfile: Profile | null
}

interface MonthSummary {
  month: number
  label: string
  invoiced: number
  budgeted: number
  scheduled: number
}

const monthLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function parseDate(value?: string | Date) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function sameYear(date: Date, year: number) {
  return date.getFullYear() === year
}

function lineTotal(line: InvoiceLine, billingUnit?: InvoiceSchedule['billingUnit']) {
  return calculateLineTotal(
    billingUnit === 'service' ? 1 : line.quantity,
    line.unitPrice,
    line.vat,
    line.withholding
  )
}

function scheduleTotal(schedule: InvoiceSchedule) {
  return schedule.lines.reduce((sum, line) => sum + lineTotal(line, schedule.billingUnit), 0)
}

function advanceScheduleDate(date: Date, frequency: InvoiceSchedule['frequency'], interval: number) {
  const next = new Date(date)
  const safeInterval = interval > 0 ? interval : 1

  if (frequency === 'weekly') {
    next.setDate(next.getDate() + (7 * safeInterval))
    return next
  }

  next.setMonth(next.getMonth() + safeInterval)
  return next
}

function StatCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="rounded-lg bg-white p-5 shadow">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      <p className="mt-2 text-sm text-gray-500">{note}</p>
    </article>
  )
}

export default function DashboardPage({ activeProfile }: DashboardPageProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [schedules, setSchedules] = useState<InvoiceSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const year = new Date().getFullYear()

  useEffect(() => {
    loadDashboard()
  }, [activeProfile?.id])

  const loadDashboard = async () => {
    try {
      setLoading(true)
      const [invoicesResponse, budgetsResponse, schedulesResponse] = await Promise.all([
        invoicesAPI.listInvoices(),
        budgetsAPI.listBudgets(),
        invoiceSchedulesAPI.listSchedules(),
      ])

      setInvoices(Array.isArray(invoicesResponse.data) ? invoicesResponse.data : [])
      setBudgets(Array.isArray(budgetsResponse.data) ? budgetsResponse.data : [])
      setSchedules(Array.isArray(schedulesResponse.data) ? schedulesResponse.data : [])
    } catch (error) {
      console.error('Failed to load dashboard:', error)
      setInvoices([])
      setBudgets([])
      setSchedules([])
    } finally {
      setLoading(false)
    }
  }

  const dashboard = useMemo(() => {
    const months: MonthSummary[] = monthLabels.map((label, month) => ({
      month,
      label,
      invoiced: 0,
      budgeted: 0,
      scheduled: 0,
    }))

    invoices.forEach((invoice) => {
      const issueDate = parseDate(invoice.issueDate)
      if (!issueDate || !sameYear(issueDate, year)) return
      months[issueDate.getMonth()].invoiced += invoice.grandTotal || 0
    })

    budgets.forEach((budget) => {
      if (budget.status === 'rejected' || budget.status === 'converted') return
      const budgetDate = parseDate(budget.validUntil) || parseDate(budget.issueDate)
      if (!budgetDate || !sameYear(budgetDate, year)) return
      months[budgetDate.getMonth()].budgeted += budget.grandTotal || 0
    })

    const today = startOfDay(new Date())
    const yearEnd = new Date(year, 11, 31, 23, 59, 59)

    schedules.forEach((schedule) => {
      if (!schedule.active) return

      let nextRunDate = parseDate(schedule.nextRunDate) || parseDate(schedule.startDate)
      if (!nextRunDate) return

      const endDate = parseDate(schedule.endDate)
      const scheduleAmount = scheduleTotal(schedule)

      while (nextRunDate <= yearEnd) {
        if (endDate && nextRunDate > endDate) break

        if (nextRunDate >= today && sameYear(nextRunDate, year)) {
          months[nextRunDate.getMonth()].scheduled += scheduleAmount
        }

        const advancedDate = advanceScheduleDate(nextRunDate, schedule.frequency, schedule.interval)
        if (advancedDate <= nextRunDate) break
        nextRunDate = advancedDate
      }
    })

    const totalInvoiced = months.reduce((sum, month) => sum + month.invoiced, 0)
    const totalBudgeted = months.reduce((sum, month) => sum + month.budgeted, 0)
    const totalScheduled = months.reduce((sum, month) => sum + month.scheduled, 0)
    const annualProjection = months.reduce((sum, month) => sum + month.invoiced + month.budgeted + month.scheduled, 0)

    return {
      months,
      totalInvoiced,
      totalBudgeted,
      totalScheduled,
      annualProjection,
    }
  }, [budgets, invoices, schedules, year])

  const currency = invoices[0]?.currency || budgets[0]?.currency || schedules[0]?.currency || activeProfile?.defaultCurrency || 'EUR'
  const maxMonthTotal = Math.max(
    ...dashboard.months.map((month) => month.invoiced + month.budgeted + month.scheduled),
    1
  )

  if (loading) {
    return <div className="text-center text-gray-500">Cargando dashboard...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        {activeProfile && <p className="mt-2 text-sm text-gray-500">Resumen anual de {activeProfile.name} para {year}.</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total facturado"
          value={formatCurrency(dashboard.totalInvoiced, currency)}
          note="Facturas emitidas y pagadas del año actual."
        />
        <StatCard
          label="Total presupuestado"
          value={formatCurrency(dashboard.totalBudgeted, currency)}
          note="Presupuestos abiertos, enviados o aceptados."
        />
        <StatCard
          label="Total programado"
          value={formatCurrency(dashboard.totalScheduled, currency)}
          note="Facturas recurrentes previstas hasta fin de año."
        />
        <StatCard
          label="Proyección anual"
          value={formatCurrency(dashboard.annualProjection, currency)}
          note="Facturado + presupuestado + programado."
        />
      </div>

      <section className="rounded-lg bg-white p-4 shadow sm:p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Previsión de facturación por meses</h2>
          <p className="mt-2 text-sm text-gray-500">Distribución mensual de facturas emitidas, presupuestos vigentes y facturas programadas.</p>
        </div>

        <div className="space-y-4">
          {dashboard.months.map((month) => {
            const monthTotal = month.invoiced + month.budgeted + month.scheduled
            const invoicedWidth = `${(month.invoiced / maxMonthTotal) * 100}%`
            const budgetedWidth = `${(month.budgeted / maxMonthTotal) * 100}%`
            const scheduledWidth = `${(month.scheduled / maxMonthTotal) * 100}%`

            return (
              <div key={month.label} className="grid gap-3 lg:grid-cols-[64px_minmax(0,1fr)_160px] lg:items-center">
                <div className="text-sm font-semibold text-gray-700">{month.label}</div>
                <div className="h-8 overflow-hidden rounded-md bg-gray-100">
                  <div className="flex h-full">
                    <div className="bg-blue-600" style={{ width: invoicedWidth }} title={`Facturado: ${formatCurrency(month.invoiced, currency)}`} />
                    <div className="bg-amber-500" style={{ width: budgetedWidth }} title={`Presupuestado: ${formatCurrency(month.budgeted, currency)}`} />
                    <div className="bg-emerald-500" style={{ width: scheduledWidth }} title={`Programado: ${formatCurrency(month.scheduled, currency)}`} />
                  </div>
                </div>
                <div className="text-sm font-semibold text-gray-900 lg:text-right">{formatCurrency(monthTotal, currency)}</div>
                <div className="text-xs text-gray-500 lg:col-start-2">
                  Facturado {formatCurrency(month.invoiced, currency)} · Presupuestado {formatCurrency(month.budgeted, currency)} · Programado {formatCurrency(month.scheduled, currency)}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-6 flex flex-wrap gap-3 text-xs text-gray-600">
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-blue-600" />Facturado</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-amber-500" />Presupuestado</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-emerald-500" />Programado</span>
        </div>
      </section>
    </div>
  )
}
