import { PROV_TO_CCAA } from './constants'

// ─── INE API base ───────────────────────────────────────────────────────────
export const INE_BASE = 'https://servicios.ine.es/wstempus/js/ES'

export async function ineGet(path, params = {}) {
  const url = new URL(`${INE_BASE}/${path}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)))
  const fullUrl = url.toString()

  console.group(`[INE] GET ${path}`)
  console.log('URL:', fullUrl)

  let r
  try {
    r = await fetch(fullUrl)
  } catch (e) {
    console.error('[INE] fetch() excepción de red:', e.message)
    console.groupEnd()
    throw e
  }

  console.log(`[INE] HTTP ${r.status} ${r.statusText}`)

  if (!r.ok) {
    const body = await r.text().catch(() => '')
    console.error('[INE] Error body:', body.slice(0, 300))
    console.groupEnd()
    throw new Error(`INE HTTP ${r.status}: ${r.statusText}`)
  }

  let json
  try {
    json = await r.json()
  } catch (e) {
    console.error('[INE] JSON parse falló:', e.message)
    console.groupEnd()
    throw e
  }

  if (Array.isArray(json)) {
    console.log(`[INE] Array de ${json.length} items. Muestra:`, json.slice(0, 2))
  } else {
    console.log('[INE] Respuesta:', JSON.stringify(json).slice(0, 300))
  }
  console.groupEnd()
  return json
}

// ─── Population pyramid reference ───────────────────────────────────────────
export const AGE_GROUPS = [
  '0-4','5-9','10-14','15-19','20-24','25-29','30-34','35-39',
  '40-44','45-49','50-54','55-59','60-64','65-69','70-74','75-79','80-84','85+'
]
export const SPAIN_M = [0.0215,0.0240,0.0250,0.0264,0.0285,0.0328,0.0361,0.0361,0.0397,0.0395,0.0368,0.0348,0.0326,0.0283,0.0223,0.0151,0.0089,0.0064]
export const SPAIN_F = [0.0202,0.0225,0.0236,0.0249,0.0271,0.0311,0.0343,0.0348,0.0384,0.0386,0.0362,0.0343,0.0330,0.0294,0.0255,0.0190,0.0140,0.0130]

// ─── Constants ───────────────────────────────────────────────────────────────
export const NAT_MEDIAN = 15000
export const EURIBOR    = 3.2

// ─── Colors ──────────────────────────────────────────────────────────────────
export const CH = {
  amber:'#B8750A', blue:'#1A62B0', teal:'#0F7B5C',
  red:'#C0392B', purple:'#5B4FC8', male:'#3267AD', female:'#B83280',
}
export const CHART_COLORS = ['#1A62B0','#B8750A','#0F7B5C','#C0392B','#5B4FC8','#B83280','#E9A820','#2AB58A']

// ─── Filtering helpers ────────────────────────────────────────────────────────

export function filterByMuni(series, muniCode) {
  if (!series || !muniCode) return []
  const mc = String(muniCode)
  const targets = [mc, mc.padStart(5, '0'), String(parseInt(mc, 10))]
  return series.filter(s =>
    (s.MetaData || []).some(m => targets.includes(String(m.Codigo)))
  )
}

export function filterByProv(series, provCode) {
  if (!series || !provCode) return []
  const prov2 = String(parseInt(provCode, 10)).padStart(2, '0')
  return series.filter(s =>
    (s.MetaData || []).some(m => {
      const c = String(m.Codigo || '').padStart(5, '0')
      return (
        c.startsWith(prov2) ||
        String(m.Codigo) === String(parseInt(provCode, 10)) ||
        String(m.Codigo) === prov2
      )
    })
  )
}

export function filterByCA(series, ccaaCode) {
  if (!series || !ccaaCode) return []
  const ca2 = String(ccaaCode).padStart(2, '0')
  return series.filter(s =>
    (s.MetaData || []).some(m => {
      const raw = String(m.Codigo || '')
      // Direct CA code match (INE uses 2-digit CA codes in many tables)
      return (
        raw === ca2 ||
        raw === String(parseInt(ca2, 10)) ||
        raw.padStart(2, '0') === ca2
      )
    })
  )
}

/**
 * Full 3-level fallback: municipio → provincia → CCAA
 * Returns { data, level: 'muni' | 'prov' | 'ccaa' | 'none', label }
 */
export function filterWithFallback(series, muniCode, provCode, ccaaCode) {
  // 1. Municipio
  const muniData = filterByMuni(series, muniCode)
  if (muniData.length > 0) {
    console.log(`[filter] ✅ municipio: ${muniData.length} series`)
    return { data: muniData, level: 'muni' }
  }
  console.warn(`[filter] sin datos municipio, intentando provincia ${provCode}`)

  // 2. Provincia
  if (provCode) {
    const provData = filterByProv(series, provCode)
    if (provData.length > 0) {
      console.log(`[filter] ✅ provincia: ${provData.length} series`)
      return { data: provData, level: 'prov' }
    }
    console.warn(`[filter] sin datos provincia, intentando CCAA ${ccaaCode}`)
  }

  // 3. CCAA — derive from provCode if not passed directly
  const resolvedCA = ccaaCode || (provCode ? PROV_TO_CCAA[String(provCode).padStart(2,'0')] : null)
  if (resolvedCA) {
    const caData = filterByCA(series, resolvedCA)
    if (caData.length > 0) {
      console.log(`[filter] ✅ CCAA: ${caData.length} series`)
      return { data: caData, level: 'ccaa' }
    }
    console.warn(`[filter] sin datos CCAA`)
  }

  return { data: [], level: 'none' }
}

// ─── Data extraction ──────────────────────────────────────────────────────────

export function getLatest(series) {
  const s = series?.[0]
  if (!s?.Data?.length) return null
  return [...s.Data]
    .filter(d => d.Valor != null)
    .sort((a, b) => (b.Anyo || 0) - (a.Anyo || 0))[0]?.Valor ?? null
}

export function getTimeSeries(series, maxYears = 9999) {
  const s = series?.[0]
  if (!s?.Data?.length) return []
  return [...s.Data]
    .filter(d => d.Valor != null)
    .sort((a, b) => (a.Anyo || 0) - (b.Anyo || 0))
    .slice(-maxYears)
    .map(d => ({ year: d.Anyo, value: d.Valor }))
}

export function cagr(start, end, years) {
  if (!start || !end || start <= 0 || years <= 0) return 0
  return +((((end / start) ** (1 / years)) - 1) * 100).toFixed(2)
}

// ─── Formatters ───────────────────────────────────────────────────────────────
export const fNum = (n, d = 0) =>
  n != null && !isNaN(n)
    ? Number(n).toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d })
    : '—'

export const fEur = n =>
  n != null && !isNaN(n) ? `${fNum(n)} €` : '—'

export const fPct = n =>
  n != null && !isNaN(n) ? `${+n > 0 ? '+' : ''}${fNum(n, 2)}%` : '—'
