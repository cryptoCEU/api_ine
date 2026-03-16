import React, { useState, useEffect } from 'react'
import { PROVINCES, INE_BASE } from '../utils'

// ─── Logger ─────────────────────────────────────────────────────────────────
// Logs to browser console AND keeps a visible in-app trace
function makeLogger(setLogs) {
  return (level, msg, data) => {
    const ts = new Date().toISOString().slice(11, 23)
    const line = `[${ts}] ${level.toUpperCase()} ${msg}`
    if (data !== undefined) {
      console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](line, data)
    } else {
      console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](line)
    }
    setLogs(prev => [...prev.slice(-29), { level, text: msg + (data ? ` → ${JSON.stringify(data).slice(0, 120)}` : '') }])
  }
}

// ─── Raw fetch with full logging ─────────────────────────────────────────────
async function ineGetLogged(path, params = {}, log) {
  const url = new URL(`${INE_BASE}/${path}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)))
  const fullUrl = url.toString()
  log('info', `GET ${fullUrl}`)

  let res
  try {
    res = await fetch(fullUrl)
  } catch (e) {
    log('error', `fetch() lanzó excepción: ${e.message}`)
    throw e
  }

  log('info', `HTTP ${res.status} ${res.statusText}`, { url: fullUrl })

  if (!res.ok) {
    const body = await res.text().catch(() => '(no body)')
    log('error', `HTTP error ${res.status}`, { body: body.slice(0, 200) })
    throw new Error(`HTTP ${res.status} — ${res.statusText}`)
  }

  let json
  try {
    json = await res.json()
  } catch (e) {
    log('error', `JSON parse falló: ${e.message}`)
    throw e
  }

  const isArr = Array.isArray(json)
  log('info', `Respuesta OK`, {
    isArray: isArr,
    length: isArr ? json.length : typeof json,
    sample: isArr && json.length > 0 ? json[0] : json,
  })

  return json
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function GeoSelector({ onSelect }) {
  const [prov,    setProv]    = useState('')
  const [muni,    setMuni]    = useState('')
  const [munis,   setMunis]   = useState([])
  const [loading, setLoading] = useState(false)
  const [err,     setErr]     = useState('')
  const [logs,    setLogs]    = useState([])
  const [showLog, setShowLog] = useState(false)

  const log = makeLogger(setLogs)

  useEffect(() => {
    if (!prov) { setMunis([]); setMuni(''); return }

    const provInt  = parseInt(prov, 10)
    const provPad  = String(provInt).padStart(2, '0')
    setLoading(true); setErr(''); setMuni('')
    setLogs([])
    log('info', `Provincia seleccionada: ${prov} (padded: ${provPad})`)

    const tryVars = async () => {
      // Variable IDs a probar en orden
      // 19 = Municipios (más probable), 115 = Municipios padrón, 29, 3, 752
      for (const varId of [19, 115, 29, 3, 752]) {
        log('info', `Intentando VALORES_VARIABLE/${varId}…`)
        try {
          const data = await ineGetLogged(`VALORES_VARIABLE/${varId}`, {}, log)

          if (!Array.isArray(data)) {
            log('warn', `varId ${varId}: respuesta no es array`, { type: typeof data })
            continue
          }
          if (data.length === 0) {
            log('warn', `varId ${varId}: array vacío`)
            continue
          }

          // Inspeccionar los primeros elementos para entender el formato
          const sample = data.slice(0, 5)
          log('info', `varId ${varId}: ${data.length} items, primeros 5`, sample)

          // Detectar formato del código
          const firstCode = String(sample[0]?.Codigo ?? '')
          log('info', `varId ${varId}: primer Codigo = "${firstCode}" (len ${firstCode.length})`)

          // Filtrar por provincia — acepta códigos de 4, 5 o 6 dígitos
          const filtered = data.filter(m => {
            const raw  = String(m.Codigo ?? '')
            // Normalizar a 5 dígitos para comparar el prefijo de provincia
            const padded = raw.padStart(5, '0')
            const match  = padded.startsWith(provPad)
            return match
          }).sort((a, b) => (a.Nombre || '').localeCompare(b.Nombre || '', 'es'))

          log('info', `varId ${varId}: filtrados para prov "${provPad}" → ${filtered.length} municipios`)

          if (filtered.length > 0) {
            log('info', `✅ Éxito con varId ${varId}`, filtered.slice(0, 3))
            setMunis(filtered)
            return // salir del bucle
          }

          log('warn', `varId ${varId}: 0 municipios para provincia ${provPad} — siguiente varId`)
        } catch (e) {
          log('error', `varId ${varId} falló: ${e.message}`)
          // continuar con siguiente varId
        }
      }

      // Todos los intentos fallaron
      log('error', 'Todos los varIds fallaron — no se pudieron cargar municipios')
      setErr('No se pudieron cargar municipios. Abre el panel de logs para ver el detalle.')
      setShowLog(true)
    }

    tryVars().finally(() => {
      setLoading(false)
      log('info', 'Carga finalizada')
    })
  }, [prov])

  const handleMuni = v => {
    setMuni(v)
    if (!v) return
    const found = munis.find(m => String(m.Codigo) === v)
    log('info', `Municipio seleccionado`, found)
    if (found) {
      onSelect({
        provCode : prov,
        provName : PROVINCES.find(p => p.c === prov)?.n || '',
        muniCode : String(found.Codigo).padStart(5, '0'),
        muniName : found.Nombre,
      })
    }
  }

  const logColor = { info: 'var(--text2)', warn: 'var(--warn)', error: 'var(--red)' }

  return (
    <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'1.5rem',boxShadow:'var(--shadow)',marginBottom:'1.5rem'}}>
      <div style={{fontWeight:700,fontSize:18,marginBottom:4}}>
        Análisis Demográfico y Socioeconómico
      </div>
      <div style={{fontSize:12,color:'var(--text2)',marginBottom:'1.25rem'}}>
        Selecciona un municipio para generar el informe completo con datos del INE
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem',alignItems:'end'}}>
        <div>
          <div style={{fontSize:11,textTransform:'uppercase',letterSpacing:1.1,color:'var(--text3)',fontWeight:600,marginBottom:4}}>
            Provincia
          </div>
          <select value={prov} onChange={e => setProv(e.target.value)}>
            <option value="">— Seleccionar provincia —</option>
            {PROVINCES.map(p => <option key={p.c} value={p.c}>{p.n}</option>)}
          </select>
        </div>

        <div>
          <div style={{fontSize:11,textTransform:'uppercase',letterSpacing:1.1,color:'var(--text3)',fontWeight:600,marginBottom:4,display:'flex',justifyContent:'space-between'}}>
            <span>
              Municipio{' '}
              {loading && <span style={{color:'var(--amber)',fontWeight:400}}>cargando…</span>}
            </span>
            {munis.length > 0 && <span style={{fontWeight:400}}>{munis.length} municipios</span>}
          </div>
          <select value={muni} onChange={e => handleMuni(e.target.value)} disabled={!prov || loading}>
            <option value="">— Seleccionar municipio —</option>
            {munis.map(m => (
              <option key={m.Codigo} value={String(m.Codigo)}>{m.Nombre}</option>
            ))}
          </select>
          {err && <div style={{fontSize:11,color:'var(--red)',marginTop:4}}>⚠ {err}</div>}
        </div>
      </div>

      {/* ── Debug log panel ─────────────────────────────────────────────── */}
      {logs.length > 0 && (
        <div style={{marginTop:'1rem'}}>
          <button
            onClick={() => setShowLog(v => !v)}
            style={{
              fontSize:11, padding:'4px 10px', borderRadius:'var(--radius-sm)',
              border:'1px solid var(--border)', background:'var(--bg3)',
              color:'var(--text2)', cursor:'pointer', display:'flex', alignItems:'center', gap:6,
            }}
          >
            <span style={{
              width:7, height:7, borderRadius:'50%', display:'inline-block',
              background: logs.some(l => l.level === 'error') ? 'var(--red)'
                        : logs.some(l => l.level === 'warn')  ? 'var(--warn)'
                        : 'var(--teal)',
            }}/>
            {showLog ? 'Ocultar' : 'Ver'} logs API ({logs.length})
          </button>

          {showLog && (
            <div style={{
              marginTop:8, background:'#0f0f0f', borderRadius:'var(--radius-sm)',
              padding:'0.75rem', fontFamily:'monospace', fontSize:11,
              maxHeight:280, overflowY:'auto', lineHeight:1.7,
            }}>
              {logs.map((l, i) => (
                <div key={i} style={{color: logColor[l.level] || '#ccc'}}>
                  <span style={{opacity:.5}}>[{i+1}]</span>{' '}
                  <span style={{color: l.level === 'error' ? '#ff6b6b' : l.level === 'warn' ? '#ffd43b' : '#69db7c'}}>
                    {l.level.toUpperCase()}
                  </span>{' '}
                  {l.text}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
