import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { budgetsAPI, clientsAPI } from '../services/api'
import { BillingUnit, Budget, Client, InvoiceLine, Profile } from '../types'
import { BudgetSchema } from '../utils/validation'
import { calculateLineTotal, formatCurrency, formatDate } from '../utils'

interface BudgetFormProps {
  activeProfile: Profile | null
  settings: Profile | null
  mode: 'create' | 'view' | 'edit'
}

function FieldValue({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-base text-gray-900">{value || 'Sin datos'}</p>
    </div>
  )
}

function getDefaultBudget(settings: Profile | null): Budget {
  return {
    issueDate: new Date().toISOString().split('T')[0],
    validUntil: '',
    status: 'draft',
    billingUnit: 'hours',
    lines: [{
      description: '',
      quantity: 1,
      unitPrice: 0,
      vat: settings?.defaultVat || 21,
      withholding: settings?.defaultWithholding || 15,
      subtotal: 0,
      vatAmount: 0,
      withholdingAmount: 0,
      lineTotal: 0,
    }],
    currency: settings?.defaultCurrency || 'EUR',
    client: { name: '', taxId: '', address: '', city: '', postalCode: '', country: '', email: '' },
    notes: '',
  }
}

function formatClientAddress(client?: Partial<Client>) {
  if (!client) return ''
  const location = [client.postalCode, client.city].filter(Boolean).join(' ')
  return [client.address, location, client.country].filter(Boolean).join(', ')
}

function getBillingUnitLabel(unit?: BillingUnit) {
  if (unit === 'service') return 'Servicio'
  return unit === 'days' ? 'Días' : 'Horas'
}

function getCurrencySuffix(currency?: string) {
  if (currency === 'EUR' || !currency) return '€'
  return currency
}

function getStatusLabel(status?: Budget['status']) {
  if (status === 'sent') return 'Enviado'
  if (status === 'accepted') return 'Aceptado'
  if (status === 'rejected') return 'Rechazado'
  if (status === 'converted') return 'Convertido'
  return 'Borrador'
}

export default function BudgetForm({ activeProfile, settings, mode }: BudgetFormProps) {
  const { id } = useParams()
  const navigate = useNavigate()
  const isReadOnly = mode === 'view'
  const isEditing = mode === 'edit'
  const [loading, setLoading] = useState(mode !== 'create')
  const [saving, setSaving] = useState(false)
  const [converting, setConverting] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [clientSearch, setClientSearch] = useState('')
  const [showClientResults, setShowClientResults] = useState(false)
  const [clientSelectionError, setClientSelectionError] = useState('')
  const isCompanyProfile = activeProfile?.type === 'company'

  const { control, register, handleSubmit, reset, setValue, watch } = useForm<Budget>({
    resolver: zodResolver(BudgetSchema),
    defaultValues: getDefaultBudget(settings),
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'lines',
  })

  const values = watch()
  const isServiceBilling = values.billingUnit === 'service'
  const defaultVat = settings?.defaultVat || 21
  const defaultWithholding = isCompanyProfile ? 0 : (settings?.defaultWithholding || 15)
  const lines = fields.map((field, index) => ({
    ...field,
    description: watch(`lines.${index}.description`) || '',
    quantity: isServiceBilling ? 1 : Number(watch(`lines.${index}.quantity`) || 0),
    unitPrice: Number(watch(`lines.${index}.unitPrice`) || 0),
    vat: Number.isFinite(Number(watch(`lines.${index}.vat`))) ? Number(watch(`lines.${index}.vat`)) : defaultVat,
    withholding: Number.isFinite(Number(watch(`lines.${index}.withholding`))) ? Number(watch(`lines.${index}.withholding`)) : defaultWithholding,
  }))

  const filteredClients = useMemo(() => {
    const term = clientSearch.trim().toLowerCase()
    if (!term) return clients.slice(0, 8)

    return clients
      .filter((client) =>
        client.name.toLowerCase().includes(term) ||
        client.taxId.toLowerCase().includes(term) ||
        client.address.toLowerCase().includes(term)
      )
      .slice(0, 8)
  }, [clients, clientSearch])

  useEffect(() => {
    loadClients()
  }, [activeProfile?.id])

  useEffect(() => {
    if (mode === 'create') {
      reset(getDefaultBudget(settings))
      setLoading(false)
      setClientSearch('')
      setClientSelectionError('')
      return
    }

    if (id) {
      loadBudget(id)
    }
  }, [id, mode, settings, reset])

  useEffect(() => {
    if (!isCompanyProfile) return
    lines.forEach((_, index) => {
      setValue(`lines.${index}.withholding`, 0, { shouldDirty: false })
    })
  }, [isCompanyProfile, lines, setValue])

  useEffect(() => {
    if (!isServiceBilling) return
    lines.forEach((_, index) => {
      setValue(`lines.${index}.quantity`, 1, { shouldDirty: false })
    })
  }, [isServiceBilling, lines, setValue])

  const loadClients = async () => {
    try {
      const response = await clientsAPI.listClients()
      setClients(Array.isArray(response.data) ? response.data : [])
    } catch (error) {
      console.error('Failed to load clients:', error)
    }
  }

  const loadBudget = async (budgetId: string) => {
    try {
      const response = await budgetsAPI.getBudget(budgetId)
      const budget = response.data
      reset({
        ...budget,
        status: budget.status || 'draft',
        issueDate: budget.issueDate ? new Date(budget.issueDate).toISOString().split('T')[0] : '',
        validUntil: budget.validUntil ? new Date(budget.validUntil).toISOString().split('T')[0] : '',
        notes: budget.notes || '',
      })
      setClientSearch(budget.client?.name || '')
      setClientSelectionError('')
    } catch (error) {
      console.error('Failed to load budget:', error)
      alert('Error al cargar el presupuesto')
    } finally {
      setLoading(false)
    }
  }

  const selectClient = (client: Client) => {
    setValue('client.id', client.id)
    setValue('client.name', client.name, { shouldValidate: true })
    setValue('client.taxId', client.taxId, { shouldValidate: true })
    setValue('client.address', client.address, { shouldValidate: true })
    setValue('client.city', client.city, { shouldValidate: true })
    setValue('client.postalCode', client.postalCode, { shouldValidate: true })
    setValue('client.country', client.country, { shouldValidate: true })
    setValue('client.email', client.email || '', { shouldValidate: true })
    setClientSearch(client.name)
    setShowClientResults(false)
    setClientSelectionError('')
  }

  const onSubmit = async (data: Budget) => {
    try {
      setSaving(true)

      if (!data.client?.id) {
        setClientSelectionError('Debes seleccionar un cliente guardado antes de crear el presupuesto.')
        setSaving(false)
        return
      }

      const budgetData = {
        ...data,
        lines: data.lines.map((line) => ({
          ...line,
          quantity: data.billingUnit === 'service' ? 1 : line.quantity,
          withholding: isCompanyProfile ? 0 : line.withholding,
        })),
        issueDate: data.issueDate instanceof Date ? data.issueDate.toISOString() : new Date(data.issueDate).toISOString(),
        validUntil: data.validUntil ? (data.validUntil instanceof Date ? data.validUntil.toISOString() : new Date(data.validUntil).toISOString()) : undefined,
      }

      if (isEditing && id) {
        await budgetsAPI.updateBudget(id, budgetData)
        navigate(`/budgets/${id}`)
        return
      }

      const response = await budgetsAPI.createBudget(budgetData)
      navigate(response.data?.id ? `/budgets/${response.data.id}` : '/budgets')
    } catch (error: any) {
      console.error('Failed to save budget:', error)
      alert(`Error: ${error.response?.data?.error || 'Error al guardar el presupuesto'}`)
    } finally {
      setSaving(false)
    }
  }

  const handleConvert = async () => {
    if (!id) return
    if (!window.confirm('¿Convertir este presupuesto en factura?')) return

    try {
      setConverting(true)
      const response = await budgetsAPI.convertToInvoice(id)
      if (response.data?.id) {
        navigate(`/invoices/${response.data.id}`)
        return
      }
      navigate('/invoices')
    } catch (error: any) {
      console.error('Failed to convert budget:', error)
      alert(`Error: ${error.response?.data?.error || 'Error al convertir el presupuesto'}`)
    } finally {
      setConverting(false)
    }
  }

  const totals = useMemo(() => {
    return lines.reduce((acc, line: InvoiceLine) => {
      const subtotal = (line.quantity || 0) * (line.unitPrice || 0)
      const vatAmount = subtotal * (((typeof line.vat === 'number' ? line.vat : defaultVat) || 0) / 100)
      const withholdingAmount = subtotal * (((typeof line.withholding === 'number' ? line.withholding : defaultWithholding) || 0) / 100)

      return {
        subtotal: acc.subtotal + subtotal,
        vatAmount: acc.vatAmount + vatAmount,
        withholdingAmount: acc.withholdingAmount + (isCompanyProfile ? 0 : withholdingAmount),
      }
    }, { subtotal: 0, vatAmount: 0, withholdingAmount: 0 })
  }, [defaultVat, defaultWithholding, isCompanyProfile, lines])

  const grandTotal = totals.subtotal + totals.vatAmount - totals.withholdingAmount

  if (loading) {
    return <div className="text-center text-gray-500">Cargando presupuesto...</div>
  }

  if (isReadOnly) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-lg bg-white p-4 shadow sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-blue-600">Detalle de presupuesto</p>
            <h1 className="mt-1 text-3xl font-bold text-gray-900">{values.number || 'Presupuesto'}</h1>
            <p className="mt-2 text-sm text-gray-500">Emitido el {values.issueDate ? formatDate(values.issueDate) : '-'}</p>
            {values.convertedInvoiceId && <p className="mt-1 text-sm text-emerald-600">Convertido en factura</p>}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={() => navigate('/budgets')} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Volver
            </button>
            {!values.convertedInvoiceId && (
              <button type="button" onClick={handleConvert} disabled={converting} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-emerald-300">
                {converting ? 'Convirtiendo...' : 'Convertir en factura'}
              </button>
            )}
            <button type="button" onClick={() => navigate(`/budgets/${id}/edit`)} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Editar
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg bg-white p-4 shadow sm:p-6">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">Cliente</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FieldValue label="Nombre" value={values.client?.name} />
              <FieldValue label="NIF/CIF" value={values.client?.taxId} />
              <FieldValue label="Dirección" value={formatClientAddress(values.client)} />
              <FieldValue label="Email" value={values.client?.email} />
            </div>
          </div>

          <div className="rounded-lg bg-white p-4 shadow sm:p-6">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">Detalles</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FieldValue label="Número" value={values.number} />
              <FieldValue label="Estado" value={getStatusLabel(values.status)} />
              <FieldValue label="Fecha de emisión" value={values.issueDate ? formatDate(values.issueDate) : ''} />
              <FieldValue label="Válido hasta" value={values.validUntil ? formatDate(values.validUntil) : 'Sin fecha'} />
              <FieldValue label="Moneda" value={values.currency} />
              <FieldValue label="Presupuestar por" value={getBillingUnitLabel(values.billingUnit)} />
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-4 shadow sm:p-6">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">Líneas</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-900">Descripción</th>
                  {values.billingUnit !== 'service' && <th className="px-4 py-2 text-right font-medium text-gray-900">{getBillingUnitLabel(values.billingUnit)}</th>}
                  <th className="px-4 py-2 text-right font-medium text-gray-900">Precio</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-900">IVA</th>
                  {!isCompanyProfile && <th className="px-4 py-2 text-right font-medium text-gray-900">IRPF</th>}
                  <th className="px-4 py-2 text-right font-medium text-gray-900">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {lines.map((line, index) => (
                  <tr key={`${line.description}-${index}`}>
                    <td className="px-4 py-3 text-gray-900">{line.description}</td>
                    {values.billingUnit !== 'service' && <td className="px-4 py-3 text-right text-gray-700">{line.quantity}</td>}
                    <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(line.unitPrice, values.currency)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{line.vat}%</td>
                    {!isCompanyProfile && <td className="px-4 py-3 text-right text-gray-700">{line.withholding}%</td>}
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {formatCurrency(calculateLineTotal(values.billingUnit === 'service' ? 1 : line.quantity, line.unitPrice, line.vat, isCompanyProfile ? 0 : line.withholding), values.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg bg-white p-4 shadow sm:p-6">
          <div className="ml-auto max-w-sm space-y-2 border-t pt-4">
            <div className="flex justify-between"><span className="text-gray-600">Subtotal:</span><span className="font-medium">{formatCurrency(totals.subtotal, values.currency)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">IVA:</span><span className="font-medium">{formatCurrency(totals.vatAmount, values.currency)}</span></div>
            {!isCompanyProfile && <div className="flex justify-between"><span className="text-gray-600">IRPF:</span><span className="font-medium">-{formatCurrency(totals.withholdingAmount, values.currency)}</span></div>}
            <div className="flex justify-between border-t pt-2 text-lg font-bold"><span>Total:</span><span>{formatCurrency(grandTotal, values.currency)}</span></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full space-y-8">
      <div className="flex flex-col gap-4 rounded-lg bg-white p-4 shadow sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-blue-600">{isEditing ? 'Editar presupuesto' : 'Nuevo presupuesto'}</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-900">{isEditing ? values.number || 'Presupuesto' : 'Crear presupuesto'}</h1>
        </div>
        {isEditing && id && (
          <button type="button" onClick={() => navigate(`/budgets/${id}`)} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
        )}
      </div>

      <div className="rounded-lg bg-white p-4 shadow sm:p-6">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">Cliente</h2>
        <input type="hidden" {...register('client.id')} />
        <input type="hidden" {...register('client.name')} />
        <input type="hidden" {...register('client.taxId')} />
        <input type="hidden" {...register('client.address')} />
        <input type="hidden" {...register('client.city')} />
        <input type="hidden" {...register('client.postalCode')} />
        <input type="hidden" {...register('client.country')} />
        <input type="hidden" {...register('client.email')} />

        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700">Buscar cliente guardado</label>
          <div className="relative mt-1">
            <input
              type="text"
              value={clientSearch}
              onChange={(event) => {
                setClientSearch(event.target.value)
                setShowClientResults(true)
                setClientSelectionError('')
              }}
              onFocus={() => setShowClientResults(true)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Escribe nombre, NIF o dirección..."
            />
            {showClientResults && filteredClients.length > 0 && (
              <div className="absolute z-10 mt-2 max-h-64 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
                {filteredClients.map((client) => (
                  <button key={client.id} type="button" onClick={() => selectClient(client)} className="block w-full border-b border-gray-100 px-4 py-3 text-left last:border-b-0 hover:bg-gray-50">
                    <p className="text-sm font-medium text-gray-900">{client.name}</p>
                    <p className="text-xs text-gray-500">{client.taxId}</p>
                    <p className="text-xs text-gray-500">{formatClientAddress(client)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
          {clientSelectionError && <p className="mt-2 text-sm text-red-500">{clientSelectionError}</p>}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldValue label="Nombre" value={values.client?.name || 'Selecciona un cliente guardado'} />
          <FieldValue label="NIF/CIF" value={values.client?.taxId || '-'} />
          <FieldValue label="Dirección" value={formatClientAddress(values.client) || '-'} />
          <FieldValue label="Email" value={values.client?.email || '-'} />
        </div>
      </div>

      <div className="rounded-lg bg-white p-4 shadow sm:p-6">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">Detalles del Presupuesto</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Fecha de emisión *</label>
            <input type="date" {...register('issueDate')} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Válido hasta</label>
            <input type="date" {...register('validUntil')} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Estado</label>
            <select {...register('status')} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="draft">Borrador</option>
              <option value="sent">Enviado</option>
              <option value="accepted">Aceptado</option>
              <option value="rejected">Rechazado</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Presupuestar por</label>
            <select {...register('billingUnit')} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="hours">Horas</option>
              <option value="days">Días</option>
              <option value="service">Servicio</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-white p-4 shadow sm:p-6">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">Líneas de Presupuesto</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-900">Descripción</th>
                {!isServiceBilling && <th className="w-20 px-4 py-2 text-right font-medium text-gray-900">{getBillingUnitLabel(values.billingUnit)}</th>}
                <th className="w-40 px-4 py-2 text-right font-medium text-gray-900">Precio</th>
                <th className="w-28 px-4 py-2 text-right font-medium text-gray-900">IVA</th>
                {!isCompanyProfile && <th className="w-28 px-4 py-2 text-right font-medium text-gray-900">IRPF</th>}
                <th className="w-28 px-4 py-2 text-right font-medium text-gray-900">Total</th>
                <th className="w-12 px-4 py-2 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {fields.map((field, index) => (
                <tr key={field.id}>
                  <td className="px-4 py-2">
                    <input type="text" {...register(`lines.${index}.description`)} className="w-full rounded border border-gray-300 px-2 py-1 text-sm" placeholder="Descripción" />
                    {isCompanyProfile && <input type="hidden" {...register(`lines.${index}.withholding`, { valueAsNumber: true })} />}
                  </td>
                  {!isServiceBilling && (
                    <td className="px-4 py-2">
                      <input type="number" step="0.01" {...register(`lines.${index}.quantity`, { valueAsNumber: true })} className="no-spinner w-full rounded border border-gray-300 px-2 py-1 text-right text-sm" />
                    </td>
                  )}
                  <td className="px-4 py-2">
                    <div className="relative">
                      <input type="number" step="0.01" {...register(`lines.${index}.unitPrice`, { valueAsNumber: true })} className="no-spinner w-full rounded border border-gray-300 py-1 pl-2 pr-10 text-right text-sm" />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-gray-500">{getCurrencySuffix(values.currency)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <select {...register(`lines.${index}.vat`, { valueAsNumber: true })} className="w-full rounded border border-gray-300 px-2 py-1 text-right text-sm">
                      <option value={21}>21%</option>
                      <option value={10}>10%</option>
                      <option value={4}>4%</option>
                      <option value={0}>0%</option>
                    </select>
                  </td>
                  {!isCompanyProfile && (
                    <td className="px-4 py-2">
                      <select {...register(`lines.${index}.withholding`, { valueAsNumber: true })} className="w-full rounded border border-gray-300 px-2 py-1 text-right text-sm">
                        <option value={15}>15%</option>
                        <option value={7}>7%</option>
                        <option value={0}>0%</option>
                      </select>
                    </td>
                  )}
                  <td className="px-4 py-2 text-right text-sm font-medium text-gray-900">
                    {formatCurrency(calculateLineTotal(isServiceBilling ? 1 : (lines[index]?.quantity || 0), lines[index]?.unitPrice || 0, lines[index]?.vat ?? defaultVat, isCompanyProfile ? 0 : (lines[index]?.withholding ?? defaultWithholding)), values.currency)}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button type="button" onClick={() => remove(index)} className="text-sm font-medium text-red-600 hover:text-red-900">x</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={() => append({ description: '', quantity: 1, unitPrice: 0, vat: defaultVat, withholding: isCompanyProfile ? 0 : defaultWithholding, subtotal: 0, vatAmount: 0, withholdingAmount: 0, lineTotal: 0 })}
          className="mt-4 rounded-md bg-blue-50 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-100"
        >
          + Añadir línea
        </button>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <label className="block text-sm font-medium text-gray-700">Notas</label>
        <textarea {...register('notes')} rows={4} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Añade observaciones para el presupuesto" />
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <div className="ml-auto flex max-w-sm justify-end">
          <div className="w-full space-y-2 border-t pt-4">
            <div className="flex justify-between"><span className="text-gray-600">Subtotal:</span><span className="font-medium">{formatCurrency(totals.subtotal, values.currency)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">IVA:</span><span className="font-medium">{formatCurrency(totals.vatAmount, values.currency)}</span></div>
            {!isCompanyProfile && <div className="flex justify-between"><span className="text-gray-600">IRPF:</span><span className="font-medium">-{formatCurrency(totals.withholdingAmount, values.currency)}</span></div>}
            <div className="flex justify-between border-t pt-2 text-lg font-bold"><span>Total:</span><span>{formatCurrency(grandTotal, values.currency)}</span></div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pb-8">
        <button type="button" onClick={() => navigate(isEditing && id ? `/budgets/${id}` : '/budgets')} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Cancelar
        </button>
        <button type="submit" disabled={saving} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300">
          {saving ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear presupuesto'}
        </button>
      </div>
    </form>
  )
}
