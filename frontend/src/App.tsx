import { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import InvoicesList from './pages/InvoicesList'
import InvoiceForm from './pages/InvoiceForm'
import BudgetsList from './pages/BudgetsList'
import BudgetForm from './pages/BudgetForm'
import DashboardPage from './pages/DashboardPage'
import InvoiceSchedulesPage from './pages/InvoiceSchedulesPage'
import Settings from './pages/Settings'
import ClientsPage from './pages/ClientsPage'
import ContactsPage from './pages/ContactsPage'
import FiscalCalendarPage from './pages/FiscalCalendarPage'
import { profilesAPI, settingsAPI, getStoredActiveProfileId, setStoredActiveProfileId } from './services/api'
import { Profile } from './types'

function App() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [activeProfileId, setActiveProfileId] = useState(getStoredActiveProfileId())
  const [settings, setSettings] = useState<Profile | null>(null)

  useEffect(() => {
    loadProfiles()
  }, [])

  useEffect(() => {
    if (!activeProfileId) {
      setSettings(null)
      return
    }

    setStoredActiveProfileId(activeProfileId)
    loadSettings()
  }, [activeProfileId])

  const loadProfiles = async () => {
    try {
      const response = await profilesAPI.listProfiles()
      const nextProfiles = Array.isArray(response.data) ? response.data : []
      setProfiles(nextProfiles)

      const storedProfileId = getStoredActiveProfileId()
      const matchingStoredProfile = nextProfiles.find((profile) => profile.id === storedProfileId)
      const fallbackProfile = nextProfiles.find((profile) => profile.isDefault) || nextProfiles[0]
      const nextActiveProfileId = matchingStoredProfile?.id || fallbackProfile?.id || ''

      if (nextActiveProfileId) {
        setActiveProfileId(nextActiveProfileId)
        setStoredActiveProfileId(nextActiveProfileId)
      }
    } catch (error) {
      console.error('Failed to load profiles:', error)
    }
  }

  const loadSettings = async () => {
    try {
      const response = await settingsAPI.getSettings()
      setSettings(response.data)
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) || null

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:gap-3">
                  <Link to="/dashboard" className="inline-flex items-center">
                    <img
                      src="/brand/facturamas-icon.png"
                      alt="Facturamas"
                      className="h-10 w-10 rounded-md object-contain"
                    />
                    <span className="ml-3 text-2xl font-bold text-gray-900">Facturamas</span>
                  </Link>
                </div>

                <label className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
                  <span className="text-sm font-medium text-gray-700">Perfil</span>
                  <select
                    value={activeProfileId}
                    onChange={(event) => setActiveProfileId(event.target.value)}
                    className="min-w-[240px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.type === 'company' ? 'Sociedad' : 'Autonomo'} · {profile.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4 sm:gap-3">
                <Link
                  to="/dashboard"
                  className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                >
                  Dashboard
                </Link>
                <Link
                  to="/clients"
                  className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                >
                  Clientes
                </Link>
                <Link
                  to="/contacts"
                  className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                >
                  Contactos
                </Link>
                <Link
                  to="/budgets"
                  className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                >
                  Presupuestos
                </Link>
                <Link
                  to="/invoices"
                  className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                >
                  Facturas
                </Link>
                <Link
                  to="/settings"
                  className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                >
                  Configuracion
                </Link>
                <Link
                  to="/fiscal-calendar"
                  className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                >
                  Calendario fiscal
                </Link>
              </div>
            </div>
          </div>
        </nav>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Routes>
            <Route path="/" element={<DashboardPage activeProfile={activeProfile} />} />
            <Route path="/dashboard" element={<DashboardPage activeProfile={activeProfile} />} />
            <Route path="/invoices" element={<InvoicesList activeProfile={activeProfile} />} />
            <Route path="/budgets" element={<BudgetsList activeProfile={activeProfile} />} />
            <Route path="/budgets/new" element={<BudgetForm activeProfile={activeProfile} settings={settings} mode="create" />} />
            <Route path="/budgets/:id" element={<BudgetForm activeProfile={activeProfile} settings={settings} mode="view" />} />
            <Route path="/budgets/:id/edit" element={<BudgetForm activeProfile={activeProfile} settings={settings} mode="edit" />} />
            <Route path="/invoice-schedules" element={<InvoiceSchedulesPage activeProfile={activeProfile} />} />
            <Route path="/contacts" element={<ContactsPage activeProfile={activeProfile} />} />
            <Route path="/clients" element={<ClientsPage activeProfile={activeProfile} />} />
            <Route path="/invoices/new" element={<InvoiceForm activeProfile={activeProfile} settings={settings} mode="create" />} />
            <Route path="/invoices/:id" element={<InvoiceForm activeProfile={activeProfile} settings={settings} mode="view" />} />
            <Route path="/invoices/:id/edit" element={<InvoiceForm activeProfile={activeProfile} settings={settings} mode="edit" />} />
            <Route path="/settings" element={<Settings activeProfile={activeProfile} onProfileUpdated={loadProfiles} onSettingsUpdated={loadSettings} />} />
            <Route path="/fiscal-calendar" element={<FiscalCalendarPage activeProfile={activeProfile} />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App
