import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { contactsAPI } from '../services/api'
import { Contact, Profile } from '../types'
import { ContactSchema } from '../utils/validation'

const emptyContact: Contact = {
  company: '',
  name: '',
  role: '',
  phone: '',
  email: '',
}

interface ContactsPageProps {
  activeProfile: Profile | null
}

export default function ContactsPage({ activeProfile }: ContactsPageProps) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<Contact>({
    resolver: zodResolver(ContactSchema),
    defaultValues: emptyContact,
  })

  useEffect(() => {
    loadContacts()
  }, [activeProfile?.id])

  const loadContacts = async () => {
    try {
      setLoading(true)
      const response = await contactsAPI.listContacts()
      setContacts(Array.isArray(response.data) ? response.data : [])
    } catch (error) {
      console.error('Failed to load contacts:', error)
      alert('Error al cargar los contactos')
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (data: Contact) => {
    try {
      setSaving(true)

      if (editingId) {
        const response = await contactsAPI.updateContact(editingId, data)
        setContacts((current) => current.map((contact) => contact.id === editingId ? response.data : contact))
      } else {
        const response = await contactsAPI.createContact(data)
        setContacts((current) => [response.data, ...current])
      }

      reset(emptyContact)
      setEditingId(null)
    } catch (error: any) {
      console.error('Failed to save contact:', error)
      alert(`Error: ${error.response?.data?.error || 'Error al guardar el contacto'}`)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (contact: Contact) => {
    setEditingId(contact.id || null)
    reset({
      company: contact.company || '',
      name: contact.name,
      role: contact.role || '',
      phone: contact.phone || '',
      email: contact.email || '',
    })
  }

  const handleDelete = async (contact: Contact) => {
    if (!contact.id) return
    if (!window.confirm(`¿Eliminar el contacto ${contact.name}?`)) return

    try {
      await contactsAPI.deleteContact(contact.id)
      setContacts((current) => current.filter((item) => item.id !== contact.id))
      if (editingId === contact.id) {
        reset(emptyContact)
        setEditingId(null)
      }
    } catch (error) {
      console.error('Failed to delete contact:', error)
      alert('Error al eliminar el contacto')
    }
  }

  const filteredContacts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return contacts

    return contacts.filter((contact) =>
      (contact.company || '').toLowerCase().includes(term) ||
      contact.name.toLowerCase().includes(term) ||
      (contact.role || '').toLowerCase().includes(term) ||
      (contact.phone || '').toLowerCase().includes(term) ||
      (contact.email || '').toLowerCase().includes(term)
    )
  }, [contacts, searchTerm])

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
      <form onSubmit={handleSubmit(onSubmit)} className="rounded-lg bg-white p-4 shadow sm:p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{editingId ? 'Editar contacto' : 'Nuevo contacto'}</h1>
          <p className="mt-2 text-sm text-gray-500">
            Guarda contactos comerciales propios de {activeProfile?.name || 'este perfil'}.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Empresa</label>
            <input
              type="text"
              {...register('company')}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
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
            <label className="block text-sm font-medium text-gray-700">Cargo</label>
            <input
              type="text"
              {...register('role')}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Teléfono</label>
            <input
              type="text"
              {...register('phone')}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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
            {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear contacto'}
          </button>
          <button
            type="button"
            onClick={() => {
              reset(emptyContact)
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
            <h2 className="text-2xl font-bold text-gray-900">Mis contactos</h2>
            <p className="mt-2 text-sm text-gray-500">{contacts.length} contactos guardados para {activeProfile?.name || 'el perfil actual'}</p>
          </div>
          <input
            type="text"
            placeholder="Buscar por empresa, nombre, cargo, teléfono o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:max-w-md"
          />
        </div>

        {loading ? (
          <div className="text-center text-gray-500">Cargando contactos...</div>
        ) : filteredContacts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500">
            {searchTerm ? 'No se encontraron contactos' : 'Todavía no has guardado contactos'}
          </div>
        ) : (
          <>
            <div className="space-y-4 lg:hidden">
              {filteredContacts.map((contact) => (
                <div key={contact.id} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{contact.name}</p>
                      <p className="mt-1 text-sm text-gray-600">{contact.company || 'Sin empresa'}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(contact)}
                        className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(contact)}
                        className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-gray-700">
                    <p>{contact.role || '-'}</p>
                    <p>{contact.phone || '-'}</p>
                    <p>{contact.email || '-'}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Empresa</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Nombre</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Cargo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Teléfono</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredContacts.map((contact) => (
                    <tr key={contact.id}>
                      <td className="px-4 py-3 text-sm text-gray-700">{contact.company || '-'}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{contact.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{contact.role || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{contact.phone || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{contact.email || '-'}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(contact)}
                            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(contact)}
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
