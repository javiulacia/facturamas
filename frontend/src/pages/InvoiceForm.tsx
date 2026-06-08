import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { clientsAPI, invoicesAPI } from '../services/api'
import { BillingUnit, Client, Invoice, InvoiceLine, Profile } from '../types'
import { InvoiceSchema } from '../utils/validation'
import { calculateLineTotal, formatCurrency, formatDate } from '../utils'

interface InvoiceFormProps {
  activeProfile: Profile | null
  settings: Profile | null
  mode: 'create' | 'view' | 'edit'
}

function FieldValue({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-base text-gray-900 whitespace-pre-wrap">{value || 'Sin datos'}</p>
    </div>
  )
}

function getDefaultInvoice(settings: Profile | null): Invoice {
  return {
    issueDate: new Date().toISOString().split('T')[0],
    status: 'issued',
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

function findMatchingClient(clients: Client[], client?: Partial<Client>) {
  if (!client) return undefined

  if (client.id) {
    return clients.find((item) => item.id === client.id)
  }

  if (client.taxId) {
    const normalizedTaxId = client.taxId.trim().toLowerCase()
    const taxIdMatch = clients.find((item) => item.taxId.trim().toLowerCase() === normalizedTaxId)
    if (taxIdMatch) return taxIdMatch
  }

  if (client.name) {
    const normalizedName = client.name.trim().toLowerCase()
    return clients.find((item) => item.name.trim().toLowerCase() === normalizedName)
  }

  return undefined
}

export default function InvoiceForm({ activeProfile, settings, mode }: InvoiceFormProps) {
  const { id } = useParams()
  const navigate = useNavigate()
  const isReadOnly = mode === 'view'
  const isEditing = mode === 'edit'
  const [loading, setLoading] = useState(mode !== 'create')
  const [saving, setSaving] = useState(false)
  const [pdfUrl, setPdfUrl] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [clientSearch, setClientSearch] = useState('')
  const [showClientResults, setShowClientResults] = useState(false)
  const [clientSelectionError, setClientSelectionError] = useState('')
  const isCompanyProfile = activeProfile?.type === 'company'

  const refreshPdf = () => {
    if (!id) return
    const nextPdfUrl = invoicesAPI.getInvoicePdfUrl(id, activeProfile?.id)
    const separator = nextPdfUrl.includes('?') ? '&' : '?'
    setPdfUrl(`${nextPdfUrl}${separator}t=${Date.now()}`)
  }

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
  } = useForm<Invoice>({
    resolver: zodResolver(InvoiceSchema),
    defaultValues: getDefaultInvoice(settings),
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
      reset(getDefaultInvoice(settings))
      setLoading(false)
      setPdfUrl('')
      setClientSearch('')
      setClientSelectionError('')
      return
    }

    if (id) {
      loadInvoice(id)
      refreshPdf()
    }
  }, [id, mode, settings, reset])

  useEffect(() => {
    if (lines.length === 0) return

    lines.forEach((line, index) => {
      if (typeof line.vat !== 'number') {
        setValue(`lines.${index}.vat`, defaultVat)
      }
      if (typeof line.withholding !== 'number') {
        setValue(`lines.${index}.withholding`, defaultWithholding)
      }
    })
  }, [defaultVat, defaultWithholding, lines, setValue])

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

  useEffect(() => {
    const matchingClient = findMatchingClient(clients, values.client)
    if (!matchingClient?.id || values.client?.id === matchingClient.id) {
      return
    }

    setValue('client.id', matchingClient.id, { shouldValidate: true })
  }, [clients, values.client?.id, values.client?.taxId, values.client?.name, setValue])

  const loadClients = async () => {
    try {
      const response = await clientsAPI.listClients()
      setClients(Array.isArray(response.data) ? response.data : [])
    } catch (error) {
      console.error('Failed to load clients:', error)
    }
  }

  const loadInvoice = async (invoiceId: string) => {
    try {
      const response = await invoicesAPI.getInvoice(invoiceId)
      const invoice = response.data
      reset({
        ...invoice,
        status: invoice.status === 'paid' ? 'paid' : 'issued',
        issueDate: invoice.issueDate ? new Date(invoice.issueDate).toISOString().split('T')[0] : '',
        dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString().split('T')[0] : '',
        notes: invoice.notes || '',
      })
      setClientSearch(invoice.client?.name || '')
      setClientSelectionError('')
    } catch (error) {
      console.error('Failed to load invoice:', error)
      alert('Error al cargar la factura')
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (data: Invoice) => {
    try {
      setSaving(true)

      if (!data.client?.id) {
        setClientSelectionError('Debes seleccionar un cliente guardado antes de crear la factura.')
        setSaving(false)
        return
      }

      const invoiceData = {
        ...data,
        lines: data.lines.map((line) => ({
          ...line,
          quantity: data.billingUnit === 'service' ? 1 : line.quantity,
          vat: line.vat,
          withholding: isCompanyProfile ? 0 : line.withholding,
        })),
        issueDate: data.issueDate instanceof Date ? data.issueDate.toISOString() : new Date(data.issueDate).toISOString(),
        dueDate: data.dueDate ? (data.dueDate instanceof Date ? data.dueDate.toISOString() : new Date(data.dueDate).toISOString()) : undefined,
      }

      if (isEditing && id) {
        await invoicesAPI.updateInvoice(id, invoiceData)
        navigate(`/invoices/${id}`)
        return
      }

      const response = await invoicesAPI.createInvoice(invoiceData)
      if (response.data?.id) {
        navigate(`/invoices/${response.data.id}`)
      } else {
        navigate('/invoices')
      }
    } catch (error: any) {
      console.error('Failed to save invoice:', error)
      const errorMsg = error.response?.data?.error || error.message || 'Error al guardar la factura'
      alert(`Error: ${errorMsg}`)
    } finally {
      setSaving(false)
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

  if (loading) {
    return <div className="text-center text-gray-500">Cargando factura...</div>
  }

  if (isReadOnly) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-lg bg-white p-4 shadow sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-blue-600">Detalle de factura</p>
            <h1 className="mt-1 text-3xl font-bold text-gray-900">{values.number || 'Factura'}</h1>
            <p className="mt-2 text-sm text-gray-500">
              Emitida el {values.issueDate ? formatDate(values.issueDate) : '-'}
            </p>
            {activeProfile && <p className="mt-1 text-sm text-gray-500">Entidad emisora: {activeProfile.name}</p>}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate('/invoices')}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={() => navigate(`/invoices/${id}/edit`)}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Editar
            </button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_520px]">
          <div className="space-y-6">
            <div className="rounded-lg bg-white p-4 shadow sm:p-6">
              <h2 className="mb-4 text-xl font-semibold text-gray-900">Cliente</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FieldValue label="Nombre" value={values.client?.name} />
                <FieldValue label="NIF/CIF" value={values.client?.taxId} />
                <FieldValue label="Dirección" value={values.client?.address} />
                <FieldValue label="Email" value={values.client?.email} />
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 shadow sm:p-6">
              <h2 className="mb-4 text-xl font-semibold text-gray-900">Detalles de la factura</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FieldValue label="Número" value={values.number} />
                <FieldValue label="Estado" value={values.status === 'paid' ? 'Pagada' : 'Emitida'} />
                <FieldValue label="Fecha de emisión" value={values.issueDate ? formatDate(values.issueDate) : ''} />
                <FieldValue label="Fecha de vencimiento" value={values.dueDate ? formatDate(values.dueDate) : 'Sin vencimiento'} />
                <FieldValue label="Moneda" value={values.currency} />
                <FieldValue label="Facturación por" value={getBillingUnitLabel(values.billingUnit)} />
                <FieldValue label="Notas" value={values.notes || 'Sin notas'} />
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 shadow sm:p-6">
              <h2 className="mb-4 text-xl font-semibold text-gray-900">Líneas de factura</h2>
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
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">{formatCurrency(totals.subtotal, values.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">IVA:</span>
                  <span className="font-medium">{formatCurrency(totals.vatAmount, values.currency)}</span>
                </div>
                {!isCompanyProfile && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">IRPF:</span>
                    <span className="font-medium">-{formatCurrency(totals.withholdingAmount, values.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-2 text-lg font-bold">
                  <span>Total:</span>
                  <span>{formatCurrency(grandTotal, values.currency)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-white p-4 shadow">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Vista PDF</h2>
              {id && (
                <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={refreshPdf}
                    className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Regenerar PDF
                  </button>
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    Abrir PDF
                  </a>
                </div>
              )}
            </div>
            {id ? (
              <iframe
                title={`PDF de ${values.number || 'factura'}`}
                src={pdfUrl}
                className="h-[70vh] min-h-[480px] w-full rounded-md border border-gray-200 sm:h-[900px]"
              />
            ) : (
              <div className="flex h-[900px] items-center justify-center rounded-md border border-dashed border-gray-300 text-sm text-gray-500">
                El PDF estará disponible cuando la factura exista.
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full space-y-8">
      <div className="flex flex-col gap-4 rounded-lg bg-white p-4 shadow sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-blue-600">
            {isEditing ? 'Editar factura' : 'Nueva factura'}
          </p>
          <h1 className="mt-1 text-3xl font-bold text-gray-900">
            {isEditing ? values.number || 'Factura' : 'Crear factura'}
          </h1>
        </div>
        {isEditing && id && (
          <button
            type="button"
            onClick={() => navigate(`/invoices/${id}`)}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
        )}
      </div>

      <div className="rounded-lg bg-white p-4 shadow sm:p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Cliente</h2>
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
              onChange={(e) => {
                setClientSearch(e.target.value)
                setShowClientResults(true)
                setClientSelectionError('')
                if (!e.target.value.trim()) {
                  setValue('client.id', '')
                  setValue('client.name', '')
                  setValue('client.taxId', '')
                  setValue('client.address', '')
                  setValue('client.email', '')
                }
              }}
              onFocus={() => setShowClientResults(true)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Escribe nombre, NIF o dirección..."
            />
            {showClientResults && filteredClients.length > 0 && (
              <div className="absolute z-10 mt-2 max-h-64 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
                {filteredClients.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => selectClient(client)}
                    className="block w-full border-b border-gray-100 px-4 py-3 text-left last:border-b-0 hover:bg-gray-50"
                  >
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
          <div>
            <p className="text-sm font-medium text-gray-500">Nombre</p>
            <p className="mt-1 text-base text-gray-900">{values.client?.name || 'Selecciona un cliente guardado'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">NIF/CIF</p>
            <p className="mt-1 text-base text-gray-900">{values.client?.taxId || '-'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Dirección</p>
            <p className="mt-1 whitespace-pre-wrap text-base text-gray-900">{formatClientAddress(values.client) || '-'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Email</p>
            <p className="mt-1 text-base text-gray-900">{values.client?.email || '-'}</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-white p-4 shadow sm:p-6">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">Detalles de la Factura</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Fecha de Emisión *</label>
            <input
              type="date"
              {...register('issueDate')}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Fecha de Vencimiento</label>
            <input
              type="date"
              {...register('dueDate')}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Estado</label>
            <select
              {...register('status')}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="issued">Emitida</option>
              <option value="paid">Pagada</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Facturar por</label>
            <select
              {...register('billingUnit')}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="hours">Horas</option>
              <option value="days">Días</option>
              <option value="service">Servicio</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-white p-4 shadow sm:p-6">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">Líneas de Factura</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-900">Descripción</th>
                {!isServiceBilling && <th className="px-4 py-2 text-right font-medium text-gray-900 w-20">{getBillingUnitLabel(values.billingUnit)}</th>}
                <th className="px-4 py-2 text-right font-medium text-gray-900 w-40">Precio</th>
                <th className="px-4 py-2 text-right font-medium text-gray-900 w-28">IVA</th>
                {!isCompanyProfile && <th className="px-4 py-2 text-right font-medium text-gray-900 w-28">IRPF</th>}
                <th className="px-4 py-2 text-right font-medium text-gray-900 w-28">Total</th>
                <th className="px-4 py-2 text-center w-12">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {fields.map((field, index) => (
                <tr key={field.id}>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      {...register(`lines.${index}.description`)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      placeholder="Descripción"
                    />
                    {isCompanyProfile && (
                      <input type="hidden" {...register(`lines.${index}.withholding`, { valueAsNumber: true })} />
                    )}
                  </td>
                  {!isServiceBilling && (
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        step="0.01"
                        {...register(`lines.${index}.quantity`, { valueAsNumber: true })}
                        className="no-spinner w-full px-2 py-1 border border-gray-300 rounded text-right text-sm"
                      />
                    </td>
                  )}
                  <td className="px-4 py-2">
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        {...register(`lines.${index}.unitPrice`, { valueAsNumber: true })}
                        className="no-spinner w-full rounded border border-gray-300 py-1 pl-2 pr-10 text-right text-sm"
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-gray-500">
                        {getCurrencySuffix(values.currency)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <select
                      {...register(`lines.${index}.vat`, { valueAsNumber: true })}
                      className="w-full rounded border border-gray-300 px-2 py-1 text-right text-sm"
                    >
                      <option value={21}>21%</option>
                      <option value={10}>10%</option>
                      <option value={4}>4%</option>
                      <option value={0}>0%</option>
                    </select>
                  </td>
                  {!isCompanyProfile && (
                    <td className="px-4 py-2">
                      <select
                        {...register(`lines.${index}.withholding`, { valueAsNumber: true })}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-right text-sm"
                      >
                        <option value={15}>15%</option>
                        <option value={7}>7%</option>
                        <option value={0}>0%</option>
                      </select>
                    </td>
                  )}
                  <td className="px-4 py-2 text-right text-sm font-medium text-gray-900">
                    {formatCurrency(
                      calculateLineTotal(
                        isServiceBilling ? 1 : (lines[index]?.quantity || 0),
                        lines[index]?.unitPrice || 0,
                        lines[index]?.vat ?? defaultVat,
                        isCompanyProfile ? 0 : (lines[index]?.withholding ?? defaultWithholding)
                      ),
                      values.currency
                    )}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="text-red-600 hover:text-red-900 font-medium text-sm"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={() => append({
            description: '',
            quantity: 1,
            unitPrice: 0,
            vat: defaultVat,
            withholding: isCompanyProfile ? 0 : defaultWithholding,
            subtotal: 0,
            vatAmount: 0,
            withholdingAmount: 0,
            lineTotal: 0,
          })}
          className="mt-4 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100"
        >
          + Añadir línea
        </button>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <label className="block text-sm font-medium text-gray-700">Notas</label>
        <textarea
          {...register('notes')}
          rows={4}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Añade observaciones para la factura"
        />
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-end max-w-sm ml-auto">
          <div className="w-full space-y-2 border-t pt-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-medium">{formatCurrency(totals.subtotal, values.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">IVA:</span>
              <span className="font-medium">{formatCurrency(totals.vatAmount, values.currency)}</span>
            </div>
            {!isCompanyProfile && (
              <div className="flex justify-between">
                <span className="text-gray-600">IRPF:</span>
                <span className="font-medium">-{formatCurrency(totals.withholdingAmount, values.currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>Total:</span>
              <span>{formatCurrency(grandTotal, values.currency)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pb-8">
        <button
          type="button"
          onClick={() => navigate(isEditing && id ? `/invoices/${id}` : '/invoices')}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {saving ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear factura'}
        </button>
      </div>
    </form>
  )
}
