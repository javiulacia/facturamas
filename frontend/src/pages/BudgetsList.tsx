import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { budgetsAPI } from '../services/api'
import { Budget, Profile } from '../types'
import { formatCurrency, formatDate } from '../utils'

type SortKey = 'number' | 'client' | 'issueDate' | 'grandTotal' | 'status'
type SortDirection = 'asc' | 'desc'

interface BudgetsListProps {
  activeProfile: Profile | null
}

function ActionButton({
  children,
  label,
  onClick,
  disabled,
  variant = 'default',
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  variant?: 'default' | 'success' | 'danger'
}) {
  const classes = {
    default: 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
    success: 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300',
    danger: 'border-red-600 bg-red-600 text-white hover:bg-red-700',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      disabled={disabled}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-md border disabled:cursor-not-allowed ${classes[variant]}`}
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

function FileTextIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h5" />
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

function getStatusLabel(status?: Budget['status']) {
  if (status === 'sent') return 'Enviado'
  if (status === 'accepted') return 'Aceptado'
  if (status === 'rejected') return 'Rechazado'
  if (status === 'converted') return 'Convertido'
  return 'Borrador'
}

function getStatusClasses(status?: Budget['status']) {
  if (status === 'converted') return 'bg-emerald-100 text-emerald-800'
  if (status === 'accepted') return 'bg-green-100 text-green-800'
  if (status === 'rejected') return 'bg-red-100 text-red-800'
  if (status === 'sent') return 'bg-blue-100 text-blue-800'
  return 'bg-gray-100 text-gray-800'
}

export default function BudgetsList({ activeProfile }: BudgetsListProps) {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('issueDate')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [convertingId, setConvertingId] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    loadBudgets()
  }, [activeProfile?.id])

  const loadBudgets = async () => {
    try {
      setLoading(true)
      const response = await budgetsAPI.listBudgets()
      setBudgets(Array.isArray(response.data) ? response.data : [])
    } catch (error) {
      console.error('Failed to load budgets:', error)
      setBudgets([])
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (budget: Budget) => {
    if (!budget.id) return
    if (!window.confirm(`¿Eliminar el presupuesto ${budget.number || ''}?`)) return

    try {
      await budgetsAPI.deleteBudget(budget.id)
      setBudgets((current) => current.filter((item) => item.id !== budget.id))
    } catch (error) {
      console.error('Failed to delete budget:', error)
      alert('Error al eliminar el presupuesto')
    }
  }

  const handleDuplicate = async (budget: Budget) => {
    if (!budget.id) return
    try {
      const response = await budgetsAPI.duplicateBudget(budget.id)
      setBudgets((current) => [response.data, ...current])
    } catch (error) {
      console.error('Failed to duplicate budget:', error)
      alert('Error al duplicar el presupuesto')
    }
  }

  const handleConvert = async (budget: Budget) => {
    if (!budget.id) return
    if (!window.confirm(`¿Convertir ${budget.number || 'este presupuesto'} en factura?`)) return

    try {
      setConvertingId(budget.id)
      const response = await budgetsAPI.convertToInvoice(budget.id)
      if (response.data?.id) {
        navigate(`/invoices/${response.data.id}`)
        return
      }
      await loadBudgets()
    } catch (error: any) {
      console.error('Failed to convert budget:', error)
      alert(`Error: ${error.response?.data?.error || 'Error al convertir el presupuesto'}`)
    } finally {
      setConvertingId(null)
    }
  }

  const filteredBudgets = useMemo(() => {
    const normalizedSearch = searchTerm.toLowerCase()
    return budgets.filter((budget) =>
      budget.number?.includes(searchTerm) ||
      budget.client.name.toLowerCase().includes(normalizedSearch)
    )
  }, [budgets, searchTerm])

  const sortedBudgets = useMemo(() => {
    const sorted = [...filteredBudgets]

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
  }, [filteredBudgets, sortDirection, sortKey])

  const filteredTotal = sortedBudgets.reduce((sum, budget) => sum + (budget.grandTotal || 0), 0)
  const totalCurrency = sortedBudgets[0]?.currency || 'EUR'

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
      <button type="button" onClick={() => toggleSort(key)} className="inline-flex items-center gap-2 text-left hover:text-gray-700">
        <span>{label}</span>
        <span className="text-[10px] text-gray-400">{getSortIndicator(key)}</span>
      </button>
    </th>
  )

  if (loading) {
    return <div className="text-center text-gray-500">Cargando presupuestos...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Presupuestos</h1>
          {activeProfile && <p className="mt-2 text-sm text-gray-500">Mostrando los presupuestos de {activeProfile.name}.</p>}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="text"
            placeholder="Buscar"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full rounded-md border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-64"
          />
          <button type="button" onClick={() => navigate('/budgets/new')} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Nuevo Presupuesto
          </button>
        </div>
      </div>

      {filteredBudgets.length === 0 ? (
        <div className="rounded-lg bg-white p-8 text-center text-gray-500 shadow">
          {searchTerm ? 'No se encontraron presupuestos' : 'No hay presupuestos aún. Crea uno nuevo.'}
        </div>
      ) : (
        <>
          <div className="space-y-4 md:hidden">
            {sortedBudgets.map((budget) => (
              <div key={budget.id} className="rounded-lg bg-white p-4 shadow">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{budget.number}</p>
                    <p className="mt-1 text-sm text-gray-600">{budget.client.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(budget.grandTotal || 0, budget.currency)}</p>
                    <p className="mt-1 text-xs text-gray-500">{formatDate(budget.issueDate)}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(budget.status)}`}>
                    {getStatusLabel(budget.status)}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <ActionButton label="Ver" onClick={() => navigate(`/budgets/${budget.id}`)}>
                    <EyeIcon />
                  </ActionButton>
                  <ActionButton label="Editar" onClick={() => navigate(`/budgets/${budget.id}/edit`)}>
                    <EditIcon />
                  </ActionButton>
                  <ActionButton label="Duplicar" onClick={() => handleDuplicate(budget)}>
                    <CopyIcon />
                  </ActionButton>
                  {!budget.convertedInvoiceId && (
                    <ActionButton label="Convertir en factura" variant="success" onClick={() => handleConvert(budget)} disabled={convertingId === budget.id}>
                      <FileTextIcon />
                    </ActionButton>
                  )}
                  <ActionButton label="Eliminar" variant="danger" onClick={() => handleDelete(budget)}>
                    <TrashIcon />
                  </ActionButton>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-lg bg-white shadow md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {renderSortableHeader('Número', 'number')}
                    {renderSortableHeader('Cliente', 'client')}
                    {renderSortableHeader('Fecha', 'issueDate')}
                    {renderSortableHeader('Total', 'grandTotal')}
                    {renderSortableHeader('Estado', 'status')}
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {sortedBudgets.map((budget) => (
                    <tr key={budget.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">{budget.number}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{budget.client.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{formatDate(budget.issueDate)}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{formatCurrency(budget.grandTotal || 0, budget.currency)}</td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(budget.status)}`}>
                          {getStatusLabel(budget.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          <ActionButton label="Ver" onClick={() => navigate(`/budgets/${budget.id}`)}>
                            <EyeIcon />
                          </ActionButton>
                          <ActionButton label="Editar" onClick={() => navigate(`/budgets/${budget.id}/edit`)}>
                            <EditIcon />
                          </ActionButton>
                          <ActionButton label="Duplicar" onClick={() => handleDuplicate(budget)}>
                            <CopyIcon />
                          </ActionButton>
                          {!budget.convertedInvoiceId && (
                            <ActionButton label="Convertir en factura" variant="success" onClick={() => handleConvert(budget)} disabled={convertingId === budget.id}>
                              <FileTextIcon />
                            </ActionButton>
                          )}
                          <ActionButton label="Eliminar" variant="danger" onClick={() => handleDelete(budget)}>
                            <TrashIcon />
                          </ActionButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={3} className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Total del listado</td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">{formatCurrency(filteredTotal, totalCurrency)}</td>
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
