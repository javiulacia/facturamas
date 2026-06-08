import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { invoicesAPI } from '../services/api'
import { Invoice, InvoiceStatus, Profile } from '../types'
import { formatCurrency, formatDate } from '../utils'

type SortKey = 'number' | 'client' | 'issueDate' | 'grandTotal' | 'status'
type SortDirection = 'asc' | 'desc'

function ActionIcon({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode
  label: string
  onClick?: () => void
}) {
  const className = 'inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={className}
    >
      {children}
    </button>
  )
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="m16.5 3.5 4 4L8 20l-5 1 1-5 12.5-12.5Z" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 21h16" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

interface InvoicesListProps {
  activeProfile: Profile | null
}

export default function InvoicesList({ activeProfile }: InvoicesListProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('issueDate')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null)
  const navigate = useNavigate()
  const isSelfEmployedProfile = activeProfile?.type === 'self_employed'

  useEffect(() => {
    loadInvoices()
  }, [activeProfile?.id])

  const loadInvoices = async () => {
    try {
      setLoading(true)
      const response = await invoicesAPI.listInvoices()
      setInvoices(Array.isArray(response.data) ? response.data : [])
    } catch (error) {
      console.error('Failed to load invoices:', error)
      setInvoices([])
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string | undefined) => {
    if (!id) return
    if (!window.confirm('¿Estás seguro de eliminar esta factura?')) return

    try {
      await invoicesAPI.deleteInvoice(id)
      setInvoices(invoices.filter((inv: Invoice) => inv.id !== id))
    } catch (error) {
      console.error('Failed to delete invoice:', error)
      alert('Error al eliminar la factura')
    }
  }

  const handleDuplicate = async (id: string | undefined) => {
    if (!id) return
    try {
      const response = await invoicesAPI.duplicateInvoice(id)
      setInvoices([response.data, ...invoices])
    } catch (error) {
      console.error('Failed to duplicate invoice:', error)
      alert('Error al duplicar la factura')
    }
  }

  const handleDownload = async (invoice: Invoice) => {
    if (!invoice.id) return

    try {
      const response = await invoicesAPI.downloadInvoicePdf(invoice.id)
      const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `invoice_${invoice.number || 'factura'}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.error('Failed to download invoice PDF:', error)
      alert('Error al descargar el PDF')
    }
  }

  const handleStatusChange = async (invoice: Invoice, status: InvoiceStatus) => {
    if (!invoice.id || invoice.status === status) return

    try {
      setUpdatingStatusId(invoice.id)

      const payload = {
        client: invoice.client,
        lines: invoice.lines,
        notes: invoice.notes || '',
        billingUnit: invoice.billingUnit,
        currency: invoice.currency,
        status,
        issueDate: invoice.issueDate instanceof Date ? invoice.issueDate.toISOString() : new Date(invoice.issueDate).toISOString(),
        dueDate: invoice.dueDate
          ? (invoice.dueDate instanceof Date ? invoice.dueDate.toISOString() : new Date(invoice.dueDate).toISOString())
          : undefined,
      }

      await invoicesAPI.updateInvoice(invoice.id, payload)
      setInvoices((current) =>
        current.map((item) => item.id === invoice.id ? { ...item, status } : item)
      )
    } catch (error) {
      console.error('Failed to update invoice status:', error)
      alert('Error al actualizar el estado de la factura')
    } finally {
      setUpdatingStatusId(null)
    }
  }

  const filteredInvoices = useMemo(() => {
    const normalizedSearch = searchTerm.toLowerCase()

    return invoices.filter((inv: Invoice) =>
      inv.number?.includes(searchTerm) ||
      inv.client.name.toLowerCase().includes(normalizedSearch)
    )
  }, [invoices, searchTerm])

  const sortedInvoices = useMemo(() => {
    const sorted = [...filteredInvoices]

    sorted.sort((a, b) => {
      let comparison = 0

      switch (sortKey) {
        case 'number':
          comparison = (a.number || '').localeCompare(b.number || '', 'es', { numeric: true, sensitivity: 'base' })
          break
        case 'client':
          comparison = a.client.name.localeCompare(b.client.name, 'es', { sensitivity: 'base' })
          break
        case 'issueDate':
          comparison = new Date(a.issueDate).getTime() - new Date(b.issueDate).getTime()
          break
        case 'grandTotal':
          comparison = (a.grandTotal || 0) - (b.grandTotal || 0)
          break
        case 'status':
          comparison = getStatusLabel(a.status).localeCompare(getStatusLabel(b.status), 'es', { sensitivity: 'base' })
          break
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })

    return sorted
  }, [filteredInvoices, sortDirection, sortKey])

  const filteredTotal = sortedInvoices.reduce((sum, invoice) => sum + (invoice.grandTotal || 0), 0)
  const filteredVatTotal = sortedInvoices.reduce((sum, invoice) => sum + (invoice.vatAmount || 0), 0)
  const filteredWithholdingTotal = sortedInvoices.reduce((sum, invoice) => sum + (invoice.withholdingAmount || 0), 0)
  const totalCurrency = sortedInvoices[0]?.currency || 'EUR'

  const getStatusLabel = (status: Invoice['status']) => {
    if (status === 'paid') return 'Pagada'
    return 'Emitida'
  }

  const getStatusClasses = (status: Invoice['status']) => {
    if (status === 'paid') return 'bg-green-100 text-green-800'
    return 'bg-blue-100 text-blue-800'
  }

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => current === 'asc' ? 'desc' : 'asc')
      return
    }

    setSortKey(key)
    setSortDirection('asc')
  }

  const getSortIndicator = (key: SortKey) => {
    if (sortKey !== key) return '↑↓'
    return sortDirection === 'asc' ? '↑' : '↓'
  }

  const renderSortableHeader = (label: string, key: SortKey) => (
    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className="inline-flex items-center gap-2 text-left hover:text-gray-700"
      >
        <span>{label}</span>
        <span className="text-[10px] text-gray-400">{getSortIndicator(key)}</span>
      </button>
    </th>
  )

  if (loading) {
    return <div className="text-center text-gray-500">Cargando facturas...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mis Facturas</h1>
          {activeProfile && <p className="mt-2 text-sm text-gray-500">Mostrando las facturas de {activeProfile.name}.</p>}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="text"
            placeholder="Buscar"
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-64"
          />
          <button
            type="button"
            onClick={() => navigate('/invoices/new')}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Nueva Factura
          </button>
          <button
            type="button"
            onClick={() => navigate('/invoice-schedules')}
            className="rounded-md border border-blue-300 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
          >
            Programar
          </button>
        </div>
      </div>

      {filteredInvoices.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          {searchTerm ? 'No se encontraron facturas' : 'No hay facturas aún. ¡Crea una nueva!'}
        </div>
      ) : (
        <>
          <div className="space-y-4 md:hidden">
            {sortedInvoices.map((invoice: Invoice) => (
              <div key={invoice.id} className="rounded-lg bg-white p-4 shadow">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{invoice.number}</p>
                    <p className="mt-1 text-sm text-gray-600">{invoice.client.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(invoice.grandTotal || 0, invoice.currency)}</p>
                    <p className="mt-1 text-xs text-gray-500">IVA: {formatCurrency(invoice.vatAmount || 0, invoice.currency)}</p>
                    {isSelfEmployedProfile && (
                      <p className="mt-1 text-xs text-gray-500">Retención: -{formatCurrency(invoice.withholdingAmount || 0, invoice.currency)}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">{formatDate(invoice.issueDate)}</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="relative inline-flex">
                    <select
                      value={invoice.status}
                      onChange={(event) => handleStatusChange(invoice, event.target.value as InvoiceStatus)}
                      disabled={updatingStatusId === invoice.id}
                      className={`appearance-none rounded-full border-0 py-1 pl-3 pr-8 text-xs font-semibold ${getStatusClasses(invoice.status)} disabled:opacity-60`}
                    >
                      <option value="issued">Emitida</option>
                      <option value="paid">Pagada</option>
                    </select>
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-current">
                      <ChevronDownIcon />
                    </span>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    <ActionIcon label="Ver" onClick={() => navigate(`/invoices/${invoice.id}`)}>
                      <EyeIcon />
                    </ActionIcon>
                    <ActionIcon label="Editar" onClick={() => navigate(`/invoices/${invoice.id}/edit`)}>
                      <EditIcon />
                    </ActionIcon>
                    <ActionIcon label="Descargar PDF" onClick={() => handleDownload(invoice)}>
                      <DownloadIcon />
                    </ActionIcon>
                    <ActionIcon label="Duplicar" onClick={() => handleDuplicate(invoice.id)}>
                      <CopyIcon />
                    </ActionIcon>
                    <ActionIcon label="Eliminar" onClick={() => handleDelete(invoice.id)}>
                      <TrashIcon />
                    </ActionIcon>
                  </div>
                </div>
              </div>
            ))}

            <div className="rounded-lg bg-white p-4 shadow">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-gray-700">Cuota IVA</span>
                  <span className="font-medium text-gray-900">{formatCurrency(filteredVatTotal, totalCurrency)}</span>
                </div>
                {isSelfEmployedProfile && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-gray-700">Retención</span>
                    <span className="font-medium text-gray-900">-{formatCurrency(filteredWithholdingTotal, totalCurrency)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3 border-t border-gray-200 pt-2">
                  <span className="font-semibold text-gray-700">Total del listado</span>
                  <span className="text-base font-bold text-gray-900">{formatCurrency(filteredTotal, totalCurrency)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="hidden overflow-hidden rounded-lg bg-white shadow md:block">
            <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {renderSortableHeader('Número', 'number')}
                  {renderSortableHeader('Cliente', 'client')}
                  {renderSortableHeader('Fecha', 'issueDate')}
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">IVA</th>
                  {isSelfEmployedProfile && <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Retención</th>}
                  {renderSortableHeader('Total', 'grandTotal')}
                  {renderSortableHeader('Estado', 'status')}
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {sortedInvoices.map((invoice: Invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">{invoice.number}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{invoice.client.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatDate(invoice.issueDate)}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-700">
                      {formatCurrency(invoice.vatAmount || 0, invoice.currency)}
                    </td>
                    {isSelfEmployedProfile && (
                      <td className="px-6 py-4 text-sm font-medium text-gray-700">
                        -{formatCurrency(invoice.withholdingAmount || 0, invoice.currency)}
                      </td>
                    )}
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {formatCurrency(invoice.grandTotal || 0, invoice.currency)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="relative inline-flex">
                        <select
                          value={invoice.status}
                          onChange={(event) => handleStatusChange(invoice, event.target.value as InvoiceStatus)}
                          disabled={updatingStatusId === invoice.id}
                          className={`appearance-none rounded-full border-0 py-1 pl-3 pr-8 text-xs font-semibold ${getStatusClasses(invoice.status)} disabled:opacity-60`}
                        >
                          <option value="issued">Emitida</option>
                          <option value="paid">Pagada</option>
                        </select>
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-current">
                          <ChevronDownIcon />
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <ActionIcon label="Ver" onClick={() => navigate(`/invoices/${invoice.id}`)}>
                          <EyeIcon />
                        </ActionIcon>
                        <ActionIcon label="Editar" onClick={() => navigate(`/invoices/${invoice.id}/edit`)}>
                          <EditIcon />
                        </ActionIcon>
                        <ActionIcon
                          label="Descargar PDF"
                          onClick={() => handleDownload(invoice)}
                        >
                          <DownloadIcon />
                        </ActionIcon>
                        <ActionIcon label="Duplicar" onClick={() => handleDuplicate(invoice.id)}>
                          <CopyIcon />
                        </ActionIcon>
                        <ActionIcon label="Eliminar" onClick={() => handleDelete(invoice.id)}>
                          <TrashIcon />
                        </ActionIcon>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-right text-sm font-semibold text-gray-700">
                    Totales del listado
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                    {formatCurrency(filteredVatTotal, totalCurrency)}
                  </td>
                  {isSelfEmployedProfile && (
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      -{formatCurrency(filteredWithholdingTotal, totalCurrency)}
                    </td>
                  )}
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">
                    {formatCurrency(filteredTotal, totalCurrency)}
                  </td>
                  <td colSpan={2} className="px-6 py-4" />
                </tr>
              </tfoot>
            </table>
          </div>
          </div>
        </>
      )}
    </div>
  )
}
