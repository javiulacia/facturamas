import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { clientsAPI } from '../services/api'
import { Client, Profile } from '../types'
import { ClientSchema } from '../utils/validation'

const emptyClient: Client = {
  name: '',
  taxId: '',
  address: '',
  city: '',
  postalCode: '',
  country: '',
  email: '',
}

interface ClientsPageProps {
  activeProfile: Profile | null
}

export default function ClientsPage({ activeProfile }: ClientsPageProps) {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<Client>({
    resolver: zodResolver(ClientSchema),
    defaultValues: emptyClient,
  })

  useEffect(() => {
    loadClients()
  }, [activeProfile?.id])

  const loadClients = async () => {
    try {
      setLoading(true)
      const response = await clientsAPI.listClients()
      setClients(Array.isArray(response.data) ? response.data : [])
    } catch (error) {
      console.error('Failed to load clients:', error)
      alert('Error al cargar los clientes')
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (data: Client) => {
    try {
      setSaving(true)

      if (editingId) {
        const response = await clientsAPI.updateClient(editingId, data)
        setClients((current) => current.map((client) => client.id === editingId ? response.data : client))
      } else {
        const response = await clientsAPI.createClient(data)
        setClients((current) => [response.data, ...current])
      }

      reset(emptyClient)
      setEditingId(null)
    } catch (error: any) {
      console.error('Failed to save client:', error)
      alert(`Error: ${error.response?.data?.error || 'Error al guardar el cliente'}`)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (client: Client) => {
    setEditingId(client.id || null)
    reset({
      name: client.name,
      taxId: client.taxId,
      address: client.address,
      city: client.city,
      postalCode: client.postalCode,
      country: client.country,
      email: client.email || '',
    })
  }

  const handleDelete = async (client: Client) => {
    if (!client.id) return
    if (!window.confirm(`¿Eliminar el cliente ${client.name}?`)) return

    try {
      await clientsAPI.deleteClient(client.id)
      setClients((current) => current.filter((item) => item.id !== client.id))
      if (editingId === client.id) {
        reset(emptyClient)
        setEditingId(null)
      }
    } catch (error) {
      console.error('Failed to delete client:', error)
      alert('Error al eliminar el cliente')
    }
  }

  const filteredClients = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return clients

    return clients.filter((client) =>
      client.name.toLowerCase().includes(term) ||
      client.taxId.toLowerCase().includes(term) ||
      client.address.toLowerCase().includes(term) ||
      client.city.toLowerCase().includes(term) ||
      client.postalCode.toLowerCase().includes(term) ||
      client.country.toLowerCase().includes(term)
    )
  }, [clients, searchTerm])

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
      <form onSubmit={handleSubmit(onSubmit)} className="rounded-lg bg-white p-4 shadow sm:p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{editingId ? 'Editar cliente' : 'Nuevo cliente'}</h1>
          <p className="mt-2 text-sm text-gray-500">
            Guarda clientes para reutilizarlos al crear facturas de {activeProfile?.name || 'este perfil'}.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nombre *</label>
            <input
              type="text"
              {...register('name')}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.name?.message && <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">NIF/CIF *</label>
            <input
              type="text"
              {...register('taxId')}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.taxId?.message && <p className="mt-1 text-sm text-red-500">{errors.taxId.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Dirección *</label>
            <input
              {...register('address')}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.address?.message && <p className="mt-1 text-sm text-red-500">{errors.address.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Ciudad *</label>
            <input
              type="text"
              {...register('city')}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.city?.message && <p className="mt-1 text-sm text-red-500">{errors.city.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Código Postal *</label>
            <input
              type="text"
              {...register('postalCode')}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.postalCode?.message && <p className="mt-1 text-sm text-red-500">{errors.postalCode.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">País *</label>
            <input
              type="text"
              {...register('country')}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.country?.message && <p className="mt-1 text-sm text-red-500">{errors.country.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              {...register('email')}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.email?.message && <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
          >
            {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear cliente'}
          </button>
          <button
            type="button"
            onClick={() => {
              reset(emptyClient)
              setEditingId(null)
            }}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Limpiar
          </button>
        </div>
      </form>

      <div className="rounded-lg bg-white p-4 shadow sm:p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Mis Clientes</h2>
            <p className="mt-2 text-sm text-gray-500">{clients.length} clientes guardados para {activeProfile?.name || 'el perfil actual'}</p>
          </div>
          <input
            type="text"
            placeholder="Buscar por nombre, NIF o dirección..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:max-w-sm"
          />
        </div>

        {loading ? (
          <div className="text-center text-gray-500">Cargando clientes...</div>
        ) : filteredClients.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500">
            {searchTerm ? 'No se encontraron clientes' : 'Todavía no has guardado clientes'}
          </div>
        ) : (
          <>
            <div className="space-y-4 lg:hidden">
              {filteredClients.map((client) => (
                <div key={client.id} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{client.name}</p>
                      <p className="mt-1 text-sm text-gray-600">{client.taxId}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(client)}
                        className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(client)}
                        className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-gray-700">
                    <p>{client.address}</p>
                    <p>{client.postalCode} {client.city}</p>
                    <p>{client.country}</p>
                    <p>{client.email || '-'}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto lg:block">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Nombre</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">NIF/CIF</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Dirección</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Ciudad</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Cód. Postal</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">País</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 text-sm font-medium text-gray-900">{client.name}</td>
                    <td className="px-4 py-4 text-sm text-gray-700">{client.taxId}</td>
                    <td className="px-4 py-4 text-sm text-gray-700">{client.address}</td>
                    <td className="px-4 py-4 text-sm text-gray-700">{client.city}</td>
                    <td className="px-4 py-4 text-sm text-gray-700">{client.postalCode}</td>
                    <td className="px-4 py-4 text-sm text-gray-700">{client.country}</td>
                    <td className="px-4 py-4 text-sm text-gray-700">{client.email || '-'}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(client)}
                          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(client)}
                          className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </div>
  )
}
