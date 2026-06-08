import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { settingsAPI } from '../services/api'
import { Profile } from '../types'
import { SettingsSchema, type Settings } from '../utils/validation'

interface SettingsProps {
  activeProfile: Profile | null
  onProfileUpdated: () => void
  onSettingsUpdated: () => void
}

export default function Settings({ activeProfile, onProfileUpdated, onSettingsUpdated }: SettingsProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exportingBackup, setExportingBackup] = useState(false)
  const [importingBackup, setImportingBackup] = useState(false)
  const [syncingProfiles, setSyncingProfiles] = useState(false)
  const [resettingInvoices, setResettingInvoices] = useState(false)
  const [resettingClients, setResettingClients] = useState(false)
  const [resettingContacts, setResettingContacts] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<Settings>({
    resolver: zodResolver(SettingsSchema),
  })
  const isCompanyProfile = activeProfile?.type === 'company'

  useEffect(() => {
    loadSettings()
  }, [activeProfile?.id])

  const loadSettings = async () => {
    try {
      const response = await settingsAPI.getSettings()
      reset(response.data)
    } catch (error) {
      console.error('Failed to load settings:', error)
      alert('Error al cargar la configuración')
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (data: any) => {
    try {
      setSaving(true)
      await settingsAPI.updateSettings({
        ...data,
        defaultWithholding: isCompanyProfile ? 0 : data.defaultWithholding,
      })
      alert('Configuración guardada correctamente')
      onProfileUpdated()
      onSettingsUpdated()
    } catch (error: any) {
      console.error('Failed to save settings:', error)
      alert(`Error: ${error.response?.data?.error || 'Error al guardar la configuración'}`)
    } finally {
      setSaving(false)
    }
  }

  const handleResetInvoices = async () => {
    const confirmed = window.confirm(
      'Esto eliminará todas las facturas guardadas y reiniciará la numeración. La configuración y los clientes se mantendrán. ¿Quieres continuar?'
    )
    if (!confirmed) return

    try {
      setResettingInvoices(true)
      await settingsAPI.resetInvoices()
      alert('Facturas eliminadas correctamente')
    } catch (error: any) {
      console.error('Failed to reset invoices:', error)
      alert(`Error: ${error.response?.data?.error || 'Error al resetear las facturas'}`)
    } finally {
      setResettingInvoices(false)
    }
  }

  const handleResetClients = async () => {
    const confirmed = window.confirm(
      'Esto eliminará todos los clientes guardados. La configuración y las facturas se mantendrán. ¿Quieres continuar?'
    )
    if (!confirmed) return

    try {
      setResettingClients(true)
      await settingsAPI.resetClients()
      alert('Clientes eliminados correctamente')
    } catch (error: any) {
      console.error('Failed to reset clients:', error)
      alert(`Error: ${error.response?.data?.error || 'Error al resetear los clientes'}`)
    } finally {
      setResettingClients(false)
    }
  }

  const handleResetContacts = async () => {
    const confirmed = window.confirm(
      'Esto eliminará todos los contactos guardados. La configuración, los clientes y las facturas se mantendrán. ¿Quieres continuar?'
    )
    if (!confirmed) return

    try {
      setResettingContacts(true)
      await settingsAPI.resetContacts()
      alert('Contactos eliminados correctamente')
    } catch (error: any) {
      console.error('Failed to reset contacts:', error)
      alert(`Error: ${error.response?.data?.error || 'Error al resetear los contactos'}`)
    } finally {
      setResettingContacts(false)
    }
  }

  const handleExportBackup = async () => {
    try {
      setExportingBackup(true)
      const response = await settingsAPI.exportBackup()
      const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: 'application/json' }))
      const link = document.createElement('a')
      const today = new Date().toISOString().split('T')[0]
      link.href = blobUrl
      link.download = `facturamas-backup-${today}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(blobUrl)
    } catch (error: any) {
      console.error('Failed to export backup:', error)
      alert(`Error: ${error.response?.data?.error || 'Error al exportar la copia de seguridad'}`)
    } finally {
      setExportingBackup(false)
    }
  }

  const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const confirmed = window.confirm(
      'Esto reemplazará la configuración, los clientes, los contactos, las facturas y los presupuestos actuales por el contenido del backup. ¿Quieres continuar?'
    )

    if (!confirmed) {
      event.target.value = ''
      return
    }

    try {
      setImportingBackup(true)
      const raw = await file.text()
      const backup = JSON.parse(raw)
      await settingsAPI.importBackup(backup)
      await loadSettings()
      alert('Copia de seguridad importada correctamente')
      onProfileUpdated()
      onSettingsUpdated()
    } catch (error: any) {
      console.error('Failed to import backup:', error)
      alert(`Error: ${error.response?.data?.error || 'Error al importar la copia de seguridad'}`)
    } finally {
      setImportingBackup(false)
      event.target.value = ''
    }
  }

  const handleSyncProfiles = async () => {
    const confirmed = window.confirm(
      'Esto copiará y unificará los clientes y contactos entre ambos perfiles, evitando duplicados básicos. ¿Quieres continuar?'
    )
    if (!confirmed) return

    try {
      setSyncingProfiles(true)
      await settingsAPI.syncProfiles()
      alert('Clientes y contactos sincronizados entre perfiles')
    } catch (error: any) {
      console.error('Failed to sync profiles:', error)
      alert(`Error: ${error.response?.data?.error || 'Error al sincronizar perfiles'}`)
    } finally {
      setSyncingProfiles(false)
    }
  }

  if (loading) {
    return <div className="text-center text-gray-500">Cargando configuración...</div>
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-8">
      <div className="rounded-lg bg-white p-4 shadow sm:p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Configuración</h1>
        {activeProfile && (
          <p className="mb-6 text-sm text-gray-500">
            Editando los datos fiscales y valores por defecto de {activeProfile.type === 'company' ? 'la sociedad' : 'tu perfil de autónomo'}: {activeProfile.name}
          </p>
        )}

        {/* Personal Data */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Datos Personales</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nombre o Razón Social *</label>
              <input
                type="text"
                {...register('name')}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.name?.message && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">NIF/CIF *</label>
              <input
                type="text"
                {...register('taxId')}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.taxId?.message && <p className="text-red-500 text-sm mt-1">{errors.taxId.message}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Dirección *</label>
              <input
                type="text"
                {...register('address')}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.address?.message && <p className="text-red-500 text-sm mt-1">{errors.address.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">CP *</label>
              <input
                type="text"
                {...register('postalCode')}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.postalCode?.message && <p className="text-red-500 text-sm mt-1">{errors.postalCode.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Ciudad *</label>
              <input
                type="text"
                {...register('city')}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.city?.message && <p className="text-red-500 text-sm mt-1">{errors.city.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">País *</label>
              <input
                type="text"
                {...register('country')}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.country?.message && <p className="text-red-500 text-sm mt-1">{errors.country.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email *</label>
              <input
                type="email"
                {...register('email')}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.email?.message && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Teléfono</label>
              <input
                type="tel"
                {...register('phone')}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">IBAN</label>
              <input
                type="text"
                {...register('iban')}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">URL de la imagen del logo</label>
              <input
                type="url"
                {...register('logoUrl')}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://.../logo.png"
              />
            </div>
          </div>
        </div>

        {/* Default Values */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Valores por Defecto</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Moneda *</label>
              <select
                {...register('defaultCurrency')}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">IVA por Defecto (%) *</label>
              <input
                type="number"
                step="0.1"
                {...register('defaultVat', { valueAsNumber: true })}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.defaultVat?.message && <p className="text-red-500 text-sm mt-1">{errors.defaultVat.message}</p>}
            </div>
            {!isCompanyProfile && (
              <div>
                <label className="block text-sm font-medium text-gray-700">IRPF por Defecto (%) *</label>
                <input
                  type="number"
                  step="0.1"
                  {...register('defaultWithholding', { valueAsNumber: true })}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.defaultWithholding?.message && <p className="text-red-500 text-sm mt-1">{errors.defaultWithholding.message}</p>}
              </div>
            )}
            <div className="sm:col-span-3">
              <label className="block text-sm font-medium text-gray-700">Serie de Facturas *</label>
              <input
                type="text"
                {...register('defaultSeries')}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="2026"
              />
              {errors.defaultSeries?.message && <p className="text-red-500 text-sm mt-1">{errors.defaultSeries.message}</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-white p-4 shadow sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900">Copias de seguridad</h2>
        <p className="mt-2 text-sm text-gray-500">
          Exporta o restaura configuración, clientes, contactos y facturas desde un único fichero JSON.
        </p>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row">
          <button
            type="button"
            onClick={handleExportBackup}
            disabled={exportingBackup}
            className="rounded-md bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
          >
            {exportingBackup ? 'Exportando...' : 'Exportar backup'}
          </button>
          <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-gray-300 px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
            {importingBackup ? 'Importando...' : 'Importar backup'}
            <input
              type="file"
              accept="application/json,.json"
              onChange={handleImportBackup}
              disabled={importingBackup}
              className="hidden"
            />
          </label>
          <button
            type="button"
            onClick={handleSyncProfiles}
            disabled={syncingProfiles}
            className="rounded-md border border-blue-300 px-5 py-3 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:border-blue-200 disabled:text-blue-300"
          >
            {syncingProfiles ? 'Sincronizando...' : 'Sincronizar clientes y contactos'}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-red-200 bg-red-50 p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-red-800">Danger Zone</h2>
        <p className="mt-2 text-sm text-red-700">
          Elige qué datos quieres eliminar. La configuración no se borrará.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-md border border-red-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-red-800">Resetear facturas</h3>
            <p className="mt-2 text-sm text-red-700">
              Borra todas las facturas y reinicia la numeración para empezar desde cero.
            </p>
            <button
              type="button"
              onClick={handleResetInvoices}
              disabled={resettingInvoices}
              className="mt-4 rounded-md bg-red-600 px-5 py-3 text-sm font-medium text-white hover:bg-red-700 disabled:bg-red-300"
            >
              {resettingInvoices ? 'Reseteando...' : 'Resetear facturas'}
            </button>
          </div>

          <div className="rounded-md border border-red-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-red-800">Resetear clientes</h3>
            <p className="mt-2 text-sm text-red-700">
              Borra todos los clientes guardados sin tocar las facturas ni la configuración.
            </p>
            <button
              type="button"
              onClick={handleResetClients}
              disabled={resettingClients}
              className="mt-4 rounded-md bg-red-600 px-5 py-3 text-sm font-medium text-white hover:bg-red-700 disabled:bg-red-300"
            >
              {resettingClients ? 'Reseteando...' : 'Resetear clientes'}
            </button>
          </div>
          <div className="rounded-md border border-red-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-red-800">Resetear contactos</h3>
            <p className="mt-2 text-sm text-red-700">
              Borra todos los contactos guardados. La configuración, los clientes y las facturas no se tocarán.
            </p>
            <button
              type="button"
              onClick={handleResetContacts}
              disabled={resettingContacts}
              className="mt-4 rounded-md bg-red-600 px-5 py-3 text-sm font-medium text-white hover:bg-red-700 disabled:bg-red-300"
            >
              {resettingContacts ? 'Reseteando...' : 'Resetear contactos'}
            </button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </button>
        <button
          type="button"
          onClick={() => loadSettings()}
          className="flex-1 px-6 py-3 bg-gray-200 text-gray-800 font-medium rounded-md hover:bg-gray-300"
        >
          Restaurar
        </button>
      </div>
    </form>
  )
}
