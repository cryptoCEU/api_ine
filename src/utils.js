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

// ─── Geography ───────────────────────────────────────────────────────────────
export const PROVINCES = [
  {c:'01',n:'Álava'},{c:'02',n:'Albacete'},{c:'03',n:'Alicante/Alacant'},
  {c:'04',n:'Almería'},{c:'05',n:'Ávila'},{c:'06',n:'Badajoz'},
  {c:'07',n:'Balears, Illes'},{c:'08',n:'Barcelona'},{c:'09',n:'Burgos'},
  {c:'10',n:'Cáceres'},{c:'11',n:'Cádiz'},{c:'12',n:'Castellón/Castelló'},
  {c:'13',n:'Ciudad Real'},{c:'14',n:'Córdoba'},{c:'15',n:'Coruña, A'},
  {c:'16',n:'Cuenca'},{c:'17',n:'Girona'},{c:'18',n:'Granada'},
  {c:'19',n:'Guadalajara'},{c:'20',n:'Gipuzkoa'},{c:'21',n:'Huelva'},
  {c:'22',n:'Huesca'},{c:'23',n:'Jaén'},{c:'24',n:'León'},
  {c:'25',n:'Lleida'},{c:'26',n:'Rioja, La'},{c:'27',n:'Lugo'},
  {c:'28',n:'Madrid'},{c:'29',n:'Málaga'},{c:'30',n:'Murcia'},
  {c:'31',n:'Navarra/Nafarroa'},{c:'32',n:'Ourense'},{c:'33',n:'Asturias'},
  {c:'34',n:'Palencia'},{c:'35',n:'Palmas, Las'},{c:'36',n:'Pontevedra'},
  {c:'37',n:'Salamanca'},{c:'38',n:'S.C. de Tenerife'},{c:'39',n:'Cantabria'},
  {c:'40',n:'Segovia'},{c:'41',n:'Sevilla'},{c:'42',n:'Soria'},
  {c:'43',n:'Tarragona'},{c:'44',n:'Teruel'},{c:'45',n:'Toledo'},
  {c:'46',n:'Valencia/València'},{c:'47',n:'Valladolid'},{c:'48',n:'Bizkaia'},
  {c:'49',n:'Zamora'},{c:'50',n:'Zaragoza'},{c:'51',n:'Ceuta'},{c:'52',n:'Melilla'}
]

// ─── Population pyramid reference (Spain distribution) ───────────────────────
export const AGE_GROUPS = [
  '0-4','5-9','10-14','15-19','20-24','25-29','30-34','35-39',
  '40-44','45-49','50-54','55-59','60-64','65-69','70-74','75-79','80-84','85+'
]
export const SPAIN_M = [0.0215,0.0240,0.0250,0.0264,0.0285,0.0328,0.0361,0.0361,0.0397,0.0395,0.0368,0.0348,0.0326,0.0283,0.0223,0.0151,0.0089,0.0064]
export const SPAIN_F = [0.0202,0.0225,0.0236,0.0249,0.0271,0.0311,0.0343,0.0348,0.0384,0.0386,0.0362,0.0343,0.0330,0.0294,0.0255,0.0190,0.0140,0.0130]

// ─── Socioeconomic ───────────────────────────────────────────────────────────
export const NAT_MEDIAN = 15000   // € renta neta / UC mediana nacional aprox.
export const EURIBOR   = 3.2      // % Euríbor referencia (actualizar con BDE)

// ─── Colors ──────────────────────────────────────────────────────────────────
export const CH = {
  amber:'#B8750A', blue:'#1A62B0', teal:'#0F7B5C',
  red:'#C0392B', purple:'#5B4FC8', male:'#3267AD', female:'#B83280',
  amber2:'#E9A820', blue2:'#4A90D9', teal2:'#2AB58A',
}
export const CHART_COLORS = ['#1A62B0','#B8750A','#0F7B5C','#C0392B','#5B4FC8','#B83280','#E9A820','#2AB58A']

// ─── Data helpers ─────────────────────────────────────────────────────────────
export function filterByMuni(series, muniCode) {
  if (!series || !muniCode) return []
  const mc = String(muniCode)
  const targets = [mc, mc.padStart(5,'0'), String(parseInt(mc,10))]
  return series.filter(s =>
    (s.MetaData || []).some(m => targets.includes(String(m.Codigo)))
  )
}

export function getLatest(series) {
  const s = series?.[0]
  if (!s?.Data?.length) return null
  return [...s.Data]
    .filter(d => d.Valor != null)
    .sort((a, b) => (b.Anyo||0) - (a.Anyo||0))[0]?.Valor ?? null
}

export function getTimeSeries(series, n = 10) {
  const s = series?.[0]
  if (!s?.Data?.length) return []
  return [...s.Data]
    .filter(d => d.Valor != null)
    .sort((a, b) => (a.Anyo||0) - (b.Anyo||0))
    .slice(-n)
    .map(d => ({ year: d.Anyo, value: d.Valor }))
}

export function cagr(start, end, years) {
  if (!start || !end || start <= 0 || years <= 0) return 0
  return +((((end / start) ** (1 / years)) - 1) * 100).toFixed(2)
}

// ─── Formatters ──────────────────────────────────────────────────────────────
export const fNum = (n, d = 0) =>
  n != null && !isNaN(n)
    ? Number(n).toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d })
    : '—'

export const fEur = n =>
  n != null && !isNaN(n) ? `${fNum(n)} €` : '—'

export const fPct = n =>
  n != null && !isNaN(n) ? `${+n > 0 ? '+' : ''}${fNum(n, 2)}%` : '—'
