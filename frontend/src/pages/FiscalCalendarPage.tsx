import { Profile } from '../types'

interface FiscalCalendarPageProps {
  activeProfile: Profile | null
}

interface FiscalDeadline {
  period: string
  dueDate: string
  models: string[]
  details: string
  optional?: boolean
}

interface FiscalSection {
  title: string
  note: string
  deadlines: FiscalDeadline[]
}

const selfEmployedSections: FiscalSection[] = [
  {
    title: 'Obligaciones trimestrales del autonomo societario',
    note: 'Aplican cuando facturas como persona fisica. Algunas solo corresponden si tienes empleados, alquiler con retencion u operaciones intracomunitarias.',
    deadlines: [
      {
        period: '1T 2026',
        dueDate: '1 al 20 de abril de 2026',
        models: ['130', '303', '111', '115'],
        details: 'Pago fraccionado de IRPF, IVA trimestral y retenciones. Los modelos 111 y 115 solo aplican si corresponde.',
      },
      {
        period: '2T 2026',
        dueDate: '1 al 20 de julio de 2026',
        models: ['130', '303', '111', '115'],
        details: 'Segundo trimestre con la misma estructura: IRPF, IVA y retenciones si las tienes.',
      },
      {
        period: '3T 2026',
        dueDate: '1 al 20 de octubre de 2026',
        models: ['130', '303', '111', '115'],
        details: 'Tercer trimestre de IRPF, IVA y retenciones asociadas a tu actividad personal.',
      },
      {
        period: '4T 2026',
        dueDate: '1 al 30 de enero de 2027',
        models: ['130', '303', '390'],
        details: 'Cuarto trimestre de IRPF e IVA. El modelo 390 es el resumen anual de IVA si te aplica.',
      },
    ],
  },
  {
    title: 'Obligaciones anuales y complementarias',
    note: 'Este perfil representa tus obligaciones como persona fisica. La sociedad, si existe, mantiene su propio calendario separado.',
    deadlines: [
      {
        period: 'Renta 2025',
        dueDate: '8 de abril al 30 de junio de 2026',
        models: ['IRPF anual'],
        details: 'Campana de Renta 2025 para tu declaracion anual como persona fisica.',
      },
      {
        period: 'Resumen anual de retenciones 2025',
        dueDate: '1 de enero al 2 de febrero de 2026',
        models: ['190', '180'],
        details: 'Resumen anual de retenciones de trabajo/profesionales y de alquileres, solo si durante 2025 presentaste 111 o 115.',
        optional: true,
      },
      {
        period: 'Declaracion anual de operaciones',
        dueDate: '1 de febrero al 2 de marzo de 2026',
        models: ['347'],
        details: 'Declaracion anual de operaciones con terceras personas si superas los umbrales y no estas excluido.',
        optional: true,
      },
      {
        period: 'Operaciones intracomunitarias',
        dueDate: 'Segun periodicidad mensual, trimestral o anual',
        models: ['349'],
        details: 'Se presenta cuando haces operaciones intracomunitarias. La AEAT fija plazos segun el periodo que te corresponda.',
        optional: true,
      },
      {
        period: 'Madrid - IAE',
        dueDate: 'Normalmente exento para personas fisicas',
        models: ['IAE'],
        details: 'Como autonomo societario, por regla general no tienes recibo municipal de IAE personal en Madrid porque las personas fisicas estan exentas.',
        optional: true,
      },
    ],
  },
]

const companySections: FiscalSection[] = [
  {
    title: 'Obligaciones trimestrales de la sociedad',
    note: 'Este perfil refleja las obligaciones de la sociedad en regimen general. Los modelos 111 y 115 solo aplican si tienes empleados, profesionales con retencion o alquiler con retencion.',
    deadlines: [
      {
        period: '1T 2026',
        dueDate: '1 al 20 de abril de 2026',
        models: ['303', '111', '115', '202'],
        details: 'IVA, retenciones trimestrales y primer pago fraccionado del Impuesto sobre Sociedades si te corresponde.',
      },
      {
        period: '2T 2026',
        dueDate: '1 al 20 de julio de 2026',
        models: ['303', '111', '115'],
        details: 'Segundo trimestre de IVA y retenciones de la sociedad.',
      },
      {
        period: '3T 2026',
        dueDate: '1 al 20 de octubre de 2026',
        models: ['303', '111', '115', '202'],
        details: 'Tercer trimestre de IVA y retenciones, mas segundo pago fraccionado de Sociedades si aplica.',
      },
      {
        period: '4T 2026',
        dueDate: '1 al 30 de enero de 2027',
        models: ['303', '390'],
        details: 'Cuarto trimestre y resumen anual de IVA, cuando proceda.',
      },
      {
        period: 'Pago fraccionado de diciembre',
        dueDate: '1 al 21 de diciembre de 2026',
        models: ['202'],
        details: 'Tercer pago fraccionado del Impuesto sobre Sociedades.',
        optional: true,
      },
    ],
  },
  {
    title: 'Obligaciones anuales y complementarias',
    note: 'Pensado para una S.L. o S.L.U. con cierre a 31 de diciembre. Si tu ejercicio es distinto, la fecha del modelo 200 cambia.',
    deadlines: [
      {
        period: 'Impuesto sobre Sociedades 2025',
        dueDate: '1 al 27 de julio de 2026',
        models: ['200'],
        details: 'Declaracion anual del Impuesto sobre Sociedades del ejercicio 2025.',
      },
      {
        period: 'Resumen anual de retenciones 2025',
        dueDate: '1 de enero al 2 de febrero de 2026',
        models: ['190', '180'],
        details: 'Resumen anual de retenciones de trabajo/profesionales y alquileres, solo si durante 2025 presentaste 111 o 115.',
        optional: true,
      },
      {
        period: 'Declaracion anual de operaciones',
        dueDate: '1 de febrero al 2 de marzo de 2026',
        models: ['347'],
        details: 'Declaracion anual de operaciones con terceras personas si superas los umbrales y no estas excluido.',
        optional: true,
      },
      {
        period: 'Operaciones intracomunitarias',
        dueDate: 'Segun periodicidad mensual, trimestral o anual',
        models: ['349'],
        details: 'Declaracion recapitulativa de operaciones intracomunitarias cuando existan.',
        optional: true,
      },
      {
        period: 'Madrid - IAE',
        dueDate: '1 de octubre al 1 de diciembre de 2026',
        models: ['IAE'],
        details: 'Solo si la sociedad no esta exenta. Muchas sociedades no pagan IAE si su cifra de negocios es inferior a 1.000.000 EUR.',
        optional: true,
      },
    ],
  },
]

const officialSources = [
  {
    label: 'AEAT - Campana Renta 2025',
    href: 'https://sede.agenciatributaria.gob.es/Sede/ayuda/calendario-contribuyente/calendario-contribuyente-2026/recuerde/fechas-campana-renta-patrimonio.html',
  },
  {
    label: 'AEAT - Modelo 303',
    href: 'https://sede.agenciatributaria.gob.es/Sede/iva/presentar-declaracion-iva-modelo-303/plazo-presentacion-modelo-303.html',
  },
  {
    label: 'AEAT - Modelo 130',
    href: 'https://sede.agenciatributaria.gob.es/Sede/impuestos-tasas/impuesto-sobre-renta-personas-fisicas/modelo-130-irpf______esionales-estimacion-directa-fraccionado_/instrucciones.html',
  },
  {
    label: 'AEAT - Modelo 190',
    href: 'https://sede.agenciatributaria.gob.es/Sede/todas-gestiones/impuestos-tasas/declaraciones-informativas/modelo-190-decla_____moniales-imputaciones-rentas-anual_/plazos-presentacion.html',
  },
  {
    label: 'AEAT - Modelo 180',
    href: 'https://sede.agenciatributaria.gob.es/Sede/todas-gestiones/impuestos-tasas/declaraciones-informativas/modelo-180-decla_____arrendamiento-inmuebles-urbanos-anual_/plazos-presentacion.html',
  },
  {
    label: 'AEAT - Modelo 349',
    href: 'https://sede.agenciatributaria.gob.es/Sede/todas-gestiones/impuestos-tasas/declaraciones-informativas/modelo-349-decla_____n-recapitulativa-operaciones-intracomunitarias_/plazos-presentacion.html',
  },
  {
    label: 'AEAT - Modelo 347',
    href: 'https://sede.agenciatributaria.gob.es/Sede/todas-gestiones/impuestos-tasas/declaraciones-informativas/modelo-347-decla_____racion-anual-operaciones-personas_/plazo-presentacion-modelo-347.html',
  },
  {
    label: 'AEAT - Modelo 200',
    href: 'https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/manual-sociedades-2024/capitulo-01-cuestiones-generales/presentacion-declaracion-impuesto-sobre-sociedades/plazo-presentar-declaracion.html',
  },
  {
    label: 'AEAT - Modelo 202',
    href: 'https://sede.agenciatributaria.gob.es/Sede/impuesto-sobre-sociedades/pagos-fraccionados-impuesto-sobre-sociedades/plazo-presentacion-pagos-fraccionados.html',
  },
  {
    label: 'Ayuntamiento de Madrid - IAE',
    href: 'https://agenciatributaria.madrid.es/portales/contribuyente/es/Gestiones-y-tramites/Otras-gestiones/Impuesto-sobre-Actividades-Economicas-IAE-/?vgnextchannel=fe72e5bcc9c78710VgnVCM1000008a4a900aRCRD&vgnextfmt=default',
  },
]

function DeadlineCard({ deadline }: { deadline: FiscalDeadline }) {
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">{deadline.period}</p>
          <h3 className="mt-2 text-lg font-semibold text-gray-900">{deadline.models.join(' · ')}</h3>
        </div>
        {deadline.optional ? (
          <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
            Solo si aplica
          </span>
        ) : (
          <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            Obligacion habitual
          </span>
        )}
      </div>

      <p className="mt-4 text-sm font-medium text-gray-900">{deadline.dueDate}</p>
      <p className="mt-2 text-sm leading-6 text-gray-600">{deadline.details}</p>
    </article>
  )
}

export default function FiscalCalendarPage({ activeProfile }: FiscalCalendarPageProps) {
  const isCompanyProfile = activeProfile?.type === 'company'
  const title = isCompanyProfile ? 'Calendario fiscal de la sociedad' : 'Calendario fiscal del autonomo societario'
  const intro = isCompanyProfile
    ? 'Resumen de fechas y modelos habituales para una sociedad en regimen general y con cierre a 31 de diciembre.'
    : 'Resumen de fechas y modelos habituales cuando el perfil personal factura como autonomo societario.'
  const sections = isCompanyProfile ? companySections : selfEmployedSections

  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-slate-900 px-6 py-8 text-white shadow-sm sm:px-8">
        <div className="max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">Calendario fiscal 2026</p>
          <h1 className="mt-3 text-3xl font-bold">{title}</h1>
          <p className="mt-4 text-sm leading-6 text-slate-200 sm:text-base">{intro}</p>
          <p className="mt-4 text-sm leading-6 text-slate-300">
            Perfil activo: <span className="font-semibold text-white">{activeProfile?.name || 'Sin perfil seleccionado'}</span>
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
        Este bloque es una guia operativa para trabajar dentro de la app. Si tienes casuisticas especiales, cierres de ejercicio no estandar,
        REDEME, grupo de IVA o dudas de encaje fiscal, conviene validarlo con tu asesoria antes de presentar modelos.
      </section>

      {sections.map((section) => (
        <section key={section.title} className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{section.title}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">{section.note}</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {section.deadlines.map((deadline) => (
              <DeadlineCard key={`${section.title}-${deadline.period}-${deadline.models.join('-')}`} deadline={deadline} />
            ))}
          </div>
        </section>
      ))}

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900">Fuentes oficiales</h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          Fechas verificadas con AEAT y Ayuntamiento de Madrid para el calendario 2026. Puedes abrir estas referencias si quieres contrastar un modelo concreto.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {officialSources.map((source) => (
            <a
              key={source.href}
              href={source.href}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium text-blue-700 transition hover:border-blue-200 hover:bg-blue-50"
            >
              {source.label}
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}
