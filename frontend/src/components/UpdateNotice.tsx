import { useEffect, useMemo, useState } from 'react'

const CURRENT_VERSION = '1.0.1'
const VERSION_ENDPOINT =
  import.meta.env.VITE_VERSION_URL || 'https://api.github.com/repos/javiulacia/facturamas/releases/latest'
const DISMISSED_VERSION_KEY = 'facturamas.dismissedVersion'

interface VersionInfo {
  latestVersion?: string
  releaseUrl?: string
  releaseNotes?: string
}

interface GitHubRelease {
  tag_name?: string
  html_url?: string
  body?: string
}

function normalizeVersion(version?: string) {
  return (version || '').trim().replace(/^v/i, '')
}

function compareVersions(left: string, right: string) {
  const leftParts = normalizeVersion(left).split('.').map((part) => Number.parseInt(part, 10) || 0)
  const rightParts = normalizeVersion(right).split('.').map((part) => Number.parseInt(part, 10) || 0)
  const length = Math.max(leftParts.length, rightParts.length)

  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] || 0
    const rightPart = rightParts[index] || 0

    if (leftPart > rightPart) return 1
    if (leftPart < rightPart) return -1
  }

  return 0
}

function normalizeVersionInfo(data: VersionInfo | GitHubRelease): VersionInfo {
  if ('tag_name' in data || 'html_url' in data) {
    return {
      latestVersion: data.tag_name,
      releaseUrl: data.html_url,
      releaseNotes: data.body,
    }
  }

  return data as VersionInfo
}

export default function UpdateNotice() {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null)
  const [dismissedVersion, setDismissedVersion] = useState(() => {
    return window.localStorage.getItem(DISMISSED_VERSION_KEY) || ''
  })

  useEffect(() => {
    const controller = new AbortController()

    async function checkVersion() {
      try {
        const response = await fetch(`${VERSION_ENDPOINT}?t=${Date.now()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!response.ok) return

        const data = (await response.json()) as VersionInfo | GitHubRelease
        setVersionInfo(normalizeVersionInfo(data))
      } catch (error) {
        if (!controller.signal.aborted) {
          console.info('No se pudo comprobar la version de Facturamas:', error)
        }
      }
    }

    checkVersion()

    return () => controller.abort()
  }, [])

  const hasUpdate = useMemo(() => {
    if (!versionInfo?.latestVersion) return false
    if (normalizeVersion(versionInfo.latestVersion) === normalizeVersion(dismissedVersion)) return false
    return compareVersions(versionInfo.latestVersion, CURRENT_VERSION) > 0
  }, [dismissedVersion, versionInfo?.latestVersion])

  if (!hasUpdate || !versionInfo?.latestVersion) return null

  const releaseUrl = versionInfo.releaseUrl || 'https://github.com/javiulacia/facturamas/releases'

  const dismiss = () => {
    const latestVersion = normalizeVersion(versionInfo.latestVersion)
    window.localStorage.setItem(DISMISSED_VERSION_KEY, latestVersion)
    setDismissedVersion(latestVersion)
  }

  return (
    <div className="border-b border-blue-100 bg-blue-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 text-sm text-blue-950 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div>
          <p className="font-semibold">Nueva version disponible: v{normalizeVersion(versionInfo.latestVersion)}</p>
          <p className="mt-1 text-blue-800">
            Tienes Facturamas v{CURRENT_VERSION}. Descarga la nueva version para actualizar la aplicacion.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={releaseUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-md bg-blue-700 px-3 py-2 font-medium text-white hover:bg-blue-800"
          >
            Descargar
          </a>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-md px-3 py-2 font-medium text-blue-800 hover:bg-blue-100"
          >
            Ocultar
          </button>
        </div>
      </div>
    </div>
  )
}
