import { useEffect, useMemo, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { clientsAPI, invoiceSchedulesAPI } from '../services/api'
import { Client, InvoiceSchedule, Profile } from '../types'
import { InvoiceScheduleSchema } from '../utils/validation'
import { calculateLineTotal, formatCurrency, formatDate } from '../utils'

interface InvoiceSchedulesPageProps {
  activeProfile: Profile | null
}

const emptyClient = { id: '', name: '', taxId: '', address: '', city: '', postalCode: '', country: '', email: '' }

function getBillingUnitLabel(unit?: InvoiceSchedule['billingUnit']) {
  if (unit === 'service') return 'Servicio'
  return unit === 'days' ? 'Días' : 'Horas'
}

function buildDefaultSchedule(profile: Profile | null): InvoiceSchedule {
  return {
    name: '',
    client: emptyClient,
    billingUnit: 'hours',
    lines: [
      {
        description: '',
        quantity: 1,
        unitPrice: 0,
        vat: profile?.defaultVat || 21,
        withholding: profile?.type === 'company' ? 0 : (profile?.defaultWithholding || 15),
        subtotal: 0,
        vatAmount: 0,
        withholdingAmount: 0,
        lineTotal: 0,
      },
    ],
    notes: '',
    currency: profile?.defaultCurrency || 'EUR',
    status: 'issued',
    frequency: 'monthly',
    interval: 1,
    startDate: new Date().toISOString().split('T')[0],
    dueDays: 30,
    active: true,
  }
}

export default function InvoiceSchedulesPage({ activeProfile }: InvoiceSchedulesPageProps) {
  const [schedules, setSchedules] = useState<InvoiceSchedule[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [clientSearch, setClientSearch] = useState('')

  const isCompanyProfile = activeProfile?.type === 'company'
  const defaultVat = activeProfile?.defaultVat || 21
  const defaultWithholding = isCompanyProfile ? 0 : (activeProfile?.defaultWithholding || 15)

  const { control, register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<InvoiceSchedule>({
    resolver: zodResolver(InvoiceScheduleSchema),
    defaultValues: buildDefaultSchedule(activeProfile),
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'lines',
  })

  const values = watch()
  const isServiceBilling = values.billingUnit === 'service'

  useEffect(() => {
    reset(buildDefaultSchedule(activeProfile))
    setEditingId(null)
    setClientSearch('')
    loadData()
  }, [activeProfile?.id])

  useEffect(() => {
    if (!isCompanyProfile) return
    fields.forEach((_, index) => {
      setValue(`lines.${index}.withholding`, 0)
    })
  }, [fields, isCompanyProfile, setValue])

  useEffect(() => {
    if (!isServiceBilling) return
    fields.forEach((_, index) => {
      setValue(`lines.${index}.quantity`, 1)
    })
  }, [fields, isServiceBilling, setValue])

  const loadData = async () => {
    try {
      setLoading(true)
      const [schedulesResponse, clientsResponse] = await Promise.all([
        invoiceSchedulesAPI.listSchedules(),
        clientsAPI.listClients(),
      ])
      setSchedules(Array.isArray(schedulesResponse.data) ? schedulesResponse.data : [])
      setClients(Array.isArray(clientsResponse.data) ? clientsResponse.data : [])
    } catch (error) {
      console.error('Failed to load schedules:', error)
      alert('Error al cargar las programaciones')
    } finally {
      setLoading(false)
    }
  }

  const filteredClients = useMemo(() => {
    const term = clientSearch.trim().toLowerCase()
    if (!term) return clients.slice(0, 8)
    return clients.filter((client) =>
      client.name.toLowerCase().includes(term) ||
      client.taxId.toLowerCase().includes(term) ||
      client.address.toLowerCase().includes(term)
    ).slice(0, 8)
  }, [clientSearch, clients])

  const onSubmit = async (data: InvoiceSchedule) => {
    try {
      setSaving(true)
      const payload = {
        ...data,
        lines: data.lines.map((line) => ({
          ...line,
          quantity: data.billingUnit === 'service' ? 1 : line.quantity,
          withholding: isCompanyProfile ? 0 : line.withholding,
        })),
        startDate: data.startDate instanceof Date ? data.startDate.toISOString() : new Date(data.startDate).toISOString(),
        nextRunDate: data.nextRunDate ? (data.nextRunDate instanceof Date ? data.nextRunDate.toISOString() : new Date(data.nextRunDate).toISOString()) : undefined,
        endDate: data.endDate ? (data.endDate instanceof Date ? data.endDate.toISOString() : new Date(data.endDate).toISOString()) : undefined,
      }

      if (editingId) {
        await invoiceSchedulesAPI.updateSchedule(editingId, payload)
      } else {
        await invoiceSchedulesAPI.createSchedule(payload)
      }

      reset(buildDefaultSchedule(activeProfile))
      setEditingId(null)
      setClientSearch('')
      await loadData()
    } catch (error: any) {
      console.error('Failed to save schedule:', error)
      alert(`Error: ${error.response?.data?.error || 'Error al guardar la programación'}`)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (schedule: InvoiceSchedule) => {
    setEditingId(schedule.id || null)
    setClientSearch(schedule.client.name)
    reset({
      ...schedule,
      startDate: schedule.startDate ? new Date(schedule.startDate).toISOString().split('T')[0] : '',
      nextRunDate: schedule.nextRunDate ? new Date(schedule.nextRunDate).toISOString().split('T')[0] : '',
      endDate: schedule.endDate ? new Date(schedule.endDate).toISOString().split('T')[0] : '',
    })
  }

  const handleDelete = async (schedule: InvoiceSchedule) => {
    if (!schedule.id) return
    if (!window.confirm(`¿Eliminar la programación ${schedule.name}?`)) return
    try {
      await invoiceSchedulesAPI.deleteSchedule(schedule.id)
      await loadData()
      if (editingId === schedule.id) {
        reset(buildDefaultSchedule(activeProfile))
        setEditingId(null)
        setClientSearch('')
      }
    } catch (error) {
      console.error('Failed to delete schedule:', error)
      alert('Error al eliminar la programación')
    }
  }

  const handleGenerateDue = async (schedule: InvoiceSchedule) => {
    if (!schedule.id) return

    try {
      setGeneratingId(schedule.id)
      const response = await invoiceSchedulesAPI.generateDueInvoices(schedule.id)
      const generatedCount = Number(response.data?.generatedCount || 0)
      await loadData()

      if (generatedCount === 0) {
        alert('No hay facturas pendientes para esta programación.')
        return
      }

      alert(`${generatedCount} factura${generatedCount === 1 ? '' : 's'} creada${generatedCount === 1 ? '' : 's'} correctamente.`)
    } catch (error: any) {
      console.error('Failed to generate due invoices:', error)
      alert(`Error: ${error.response?.data?.error || 'Error al crear las facturas pendientes'}`)
    } finally {
      setGeneratingId(null)
    }
  }

  const selectClient = (client: Client) => {
    setValue('client.id', client.id || '')
    setValue('client.name', client.name)
    setValue('client.taxId', client.taxId)
    setValue('client.address', client.address)
    setValue('client.city', client.city)
    setValue('client.postalCode', client.postalCode)
    setValue('client.country', client.country)
    setValue('client.email', client.email || '')
    setClientSearch(client.name)
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[460px_minmax(0,1fr)]">
      <form onSubmit={handleSubmit(onSubmit)} className="rounded-lg bg-white p-4 shadow sm:p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{editingId ? 'Editar programación' : 'Programar facturas'}</h1>
          <p className="mt-2 text-sm text-gray-500">Crea facturas recurrentes semanales o mensuales para el perfil activo.</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nombre de la programación *</label>
            <input {...register('name')} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
            {errors.name?.message && <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Cliente *</label>
            <input type="hidden" {...register('client.id')} />
            <input type="hidden" {...register('client.name')} />
            <input type="hidden" {...register('client.taxId')} />
            <input type="hidden" {...register('client.address')} />
            <input type="hidden" {...register('client.city')} />
            <input type="hidden" {...register('client.postalCode')} />
            <input type="hidden" {...register('client.country')} />
            <input type="hidden" {...register('client.email')} />
            <input
              value={clientSearch}
              onChange={(event) => setClientSearch(event.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              placeholder="Busca un cliente guardado"
            />
            {filteredClients.length > 0 && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-gray-200">
                {filteredClients.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => selectClient(client)}
                    className="block w-full border-b border-gray-100 px-3 py-3 text-left last:border-b-0 hover:bg-gray-50"
                  >
                    <p className="text-sm font-medium text-gray-900">{client.name}</p>
                    <p className="text-xs text-gray-500">{client.taxId}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Frecuencia *</label>
              <select {...register('frequency')} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2">
                <option value="monthly">Mensual</option>
                <option value="weekly">Semanal</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Cada cuánto *</label>
              <input type="number" {...register('interval', { valueAsNumber: true })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Primera emisión *</label>
              <input type="date" {...register('startDate')} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
            </div>
            {editingId && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Próxima emisión *</label>
                <input type="date" {...register('nextRunDate')} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700">Vencimiento en días</label>
              <input type="number" {...register('dueDays', { valueAsNumber: true })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Fin de la programación</label>
              <input type="date" {...register('endDate')} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Estado inicial</label>
              <select {...register('status')} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2">
                <option value="issued">Emitida</option>
                <option value="paid">Pagada</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Facturar por</label>
              <select {...register('billingUnit')} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2">
                <option value="hours">Horas</option>
                <option value="days">Días</option>
                <option value="service">Servicio</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Moneda</label>
              <input {...register('currency')} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">Líneas</p>
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-1 gap-3 rounded-md border border-gray-200 p-3">
                <input {...register(`lines.${index}.description`)} placeholder="Descripción" className="rounded-md border border-gray-300 px-3 py-2" />
                <div className={`grid gap-3 ${isCompanyProfile ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-4'}`}>
                  {!isServiceBilling && (
                    <input
                      type="number"
                      step="0.01"
                      {...register(`lines.${index}.quantity`, { valueAsNumber: true })}
                      placeholder={getBillingUnitLabel(values.billingUnit)}
                      className="rounded-md border border-gray-300 px-3 py-2"
                    />
                  )}
                  {isServiceBilling && (
                    <input type="hidden" {...register(`lines.${index}.quantity`, { valueAsNumber: true })} />
                  )}
                  <input type="number" step="0.01" {...register(`lines.${index}.unitPrice`, { valueAsNumber: true })} placeholder="Precio" className="rounded-md border border-gray-300 px-3 py-2" />
                  <select {...register(`lines.${index}.vat`, { valueAsNumber: true })} className="rounded-md border border-gray-300 px-3 py-2">
                    <option value={21}>IVA 21%</option>
                    <option value={10}>IVA 10%</option>
                    <option value={4}>IVA 4%</option>
                    <option value={0}>IVA 0%</option>
                  </select>
                  {!isCompanyProfile ? (
                    <select {...register(`lines.${index}.withholding`, { valueAsNumber: true })} className="rounded-md border border-gray-300 px-3 py-2">
                      <option value={15}>IRPF 15%</option>
                      <option value={7}>IRPF 7%</option>
                      <option value={0}>IRPF 0%</option>
                    </select>
                  ) : (
                    <input type="hidden" {...register(`lines.${index}.withholding`, { valueAsNumber: true })} />
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  Total estimado: {formatCurrency(
                    calculateLineTotal(
                      isServiceBilling ? 1 : Number(values.lines?.[index]?.quantity || 0),
                      Number(values.lines?.[index]?.unitPrice || 0),
                      Number.isFinite(Number(values.lines?.[index]?.vat)) ? Number(values.lines?.[index]?.vat) : defaultVat,
                      isCompanyProfile ? 0 : (Number.isFinite(Number(values.lines?.[index]?.withholding)) ? Number(values.lines?.[index]?.withholding) : defaultWithholding)
                    ),
                    values.currency
                  )}
                </p>
                <button type="button" onClick={() => remove(index)} className="text-left text-sm font-medium text-red-600 hover:text-red-700">Eliminar línea</button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => append({
                description: '',
                quantity: 1,
                unitPrice: 0,
                vat: defaultVat,
                withholding: defaultWithholding,
                subtotal: 0,
                vatAmount: 0,
                withholdingAmount: 0,
                lineTotal: 0,
              })}
              className="rounded-md bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
            >
              + Añadir línea
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Notas</label>
            <textarea {...register('notes')} rows={3} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button type="submit" disabled={saving} className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300">
            {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear programación'}
          </button>
          <button
            type="button"
            onClick={() => {
              reset(buildDefaultSchedule(activeProfile))
              setEditingId(null)
              setClientSearch('')
            }}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Limpiar
          </button>
        </div>
      </form>

      <div className="rounded-lg bg-white p-4 shadow sm:p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Programaciones</h2>
          <p className="mt-2 text-sm text-gray-500">{schedules.length} programaciones en este perfil</p>
        </div>

        {loading ? (
          <div className="text-center text-gray-500">Cargando programaciones...</div>
        ) : schedules.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500">
            Todavía no hay programaciones automáticas.
          </div>
        ) : (
          <div className="space-y-4">
            {schedules.map((schedule) => (
              <div key={schedule.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-gray-900">{schedule.name}</h3>
                    <p className="text-sm text-gray-600">{schedule.client.name}</p>
                    <p className="text-sm text-gray-500">
                      {schedule.frequency === 'monthly' ? 'Mensual' : 'Semanal'} cada {schedule.interval} · próxima emisión {schedule.nextRunDate ? formatDate(schedule.nextRunDate) : formatDate(schedule.startDate)}
                    </p>
                    <p className="text-sm text-gray-500">Facturar por {getBillingUnitLabel(schedule.billingUnit)}</p>
                    <p className="text-sm text-gray-500">
                      {schedule.lines.length} líneas · total estimado {formatCurrency(schedule.lines.reduce((sum, line) => {
                        return sum + calculateLineTotal(
                          schedule.billingUnit === 'service' ? 1 : line.quantity,
                          line.unitPrice,
                          line.vat,
                          isCompanyProfile ? 0 : line.withholding
                        )
                      }, 0), schedule.currency)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleGenerateDue(schedule)}
                      disabled={generatingId === schedule.id}
                      className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-emerald-300"
                    >
                      {generatingId === schedule.id ? 'Creando...' : 'Crear pendientes'}
                    </button>
                    <button type="button" onClick={() => handleEdit(schedule)} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">Editar</button>
                    <button type="button" onClick={() => handleDelete(schedule)} className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700">Eliminar</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
