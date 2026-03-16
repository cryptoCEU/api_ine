import React, { useState, useEffect, useRef } from 'react'
import { CCAA, provsByCA, PROV_TO_CCAA, PROVINCES } from '../constants'
import { INE_BASE } from '../utils'

// ─── Logger ──────────────────────────────────────────────────────────────────
function makeLogger(setLogs) {
  return (level, msg, data) => {
    const ts = new Date().toISOString().slice(11, 23)
    const line = `[${ts}] ${level.toUpperCase()} ${msg}`
    const full = data !== undefined ? `${line} → ${JSON.stringify(data).slice(0, 150)}` : line
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](full)
    setLogs(prev => [...prev.slice(-39), { level, text: msg + (data ? ` → ${JSON.stringify(data).slice(0, 120)}` : '') }])
  }
}

async function ineGetLogged(path, params = {}, log) {
  const url = new URL(`${INE_BASE}/${path}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)))
  const fullUrl = url.toString()
  log('info', `GET ${path}`, { url: fullUrl })
  let res
  try { res = await fetch(fullUrl) }
  catch (e) { log('error', `fetch excepción: ${e.message}`); throw e }
  log('info', `HTTP ${res.status}`)
  if (!res.ok) { const b = await res.text().catch(() => ''); log('error', `HTTP ${res.status}`, { body: b.slice(0,200) }); throw new Error(`HTTP ${res.status}`) }
  let json
  try { json = await res.json() }
  catch (e) { log('error', `JSON parse: ${e.message}`); throw e }
  const isArr = Array.isArray(json)
  log('info', `OK`, { isArray: isArr, length: isArr ? json.length : typeof json, sample: isArr ? json[0] : json })
  return json
}

// ─── Select ───────────────────────────────────────────────────────────────────
function Sel({ label, value, onChange, disabled, options, placeholder, count }) {
  return (
    <div>
      <div style={{fontSize:11,textTransform:'uppercase',letterSpacing:1.1,color:'var(--text3)',fontWeight:600,marginBottom:4,display:'flex',justifyContent:'space-between'}}>
        <span>{label}</span>
        {count > 0 && <span style={{fontWeight:400}}>{count}</span>}
      </div>
      <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled} style={{opacity:disabled?0.45:1}}>
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o.c} value={o.c}>{o.n}</option>)}
      </select>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function GeoSelector({ onSelect }) {
  const [ccaa,    setCcaa]    = useState('')
  const [prov,    setProv]    = useState('')
  const [muni,    setMuni]    = useState('')
  const [munis,   setMunis]   = useState([])
  const [loading, setLoading] = useState(false)
  const [err,     setErr]     = useState('')
  const [logs,    setLogs]    = useState([])
  const [showLog, setShowLog] = useState(false)
  const log = useRef(makeLogger(setLogs)).current

  // Provincias filtradas por CCAA
  const provOptions = ccaa ? provsByCA(ccaa) : PROVINCES

  // Reset cascade on CCAA change
  useEffect(() => { setProv(''); setMuni(''); setMunis([]) }, [ccaa])

  // Load municipios when province changes
  useEffect(() => {
    if (!prov) { setMunis([]); setMuni(''); return }
    const provInt = parseInt(prov, 10)
    const provPad = String(provInt).padStart(2, '0')
    setLoading(true); setErr(''); setMuni('')
    setLogs([])
    log('info', `Cargando municipios para provincia ${prov} (${provPad})`)

    const tryVars = async () => {
      for (const varId of [19, 115, 29, 3, 752]) {
        log('info', `Intentando VALORES_VARIABLE/${varId}…`)
        try {
          const data = await ineGetLogged(`VALORES_VARIABLE/${varId}`, {}, log)
          if (!Array.isArray(data) || data.length === 0) { log('warn', `varId ${varId}: no es array o vacío`); continue }
          log('info', `varId ${varId}: ${data.length} items, primer Codigo="${data[0]?.Codigo}"`)
          const filtered = data
            .filter(m => String(m.Codigo ?? '').padStart(5, '0').startsWith(provPad))
            .sort((a, b) => (a.Nombre || '').localeCompare(b.Nombre || '', 'es'))
          log('info', `varId ${varId}: filtrados → ${filtered.length} municipios`)
          if (filtered.length > 0) {
            log('info', `✅ éxito con varId ${varId}`, filtered.slice(0, 2))
            setMunis(filtered); return
          }
          log('warn', `varId ${varId}: 0 resultados para prov "${provPad}"`)
        } catch (e) { log('error', `varId ${varId}: ${e.message}`) }
      }
      log('error', 'Todos los varIds fallaron')
      setErr('No se pudieron cargar municipios. Abre los logs para ver el detalle.')
      setShowLog(true)
    }
    tryVars().finally(() => { setLoading(false); log('info', 'Carga finalizada') })
  }, [prov])

  const handleMuni = v => {
    setMuni(v)
    if (!v) return
    const found = munis.find(m => String(m.Codigo) === v)
    if (!found) return
    log('info', `Municipio seleccionado`, found)
    const provCode = prov
    const ccaaCode = ccaa || PROV_TO_CCAA[String(provCode).padStart(2, '0')] || ''
    onSelect({
      ccaaCode,
      ccaaName : CCAA.find(c => c.c === ccaaCode)?.n || '',
      provCode,
      provName : PROVINCES.find(p => p.c === provCode)?.n || '',
      muniCode : String(found.Codigo).padStart(5, '0'),
      muniName : found.Nombre,
    })
  }

  const logColor = { info:'#69db7c', warn:'#ffd43b', error:'#ff6b6b' }
  const statusColor = logs.some(l => l.level==='error') ? 'var(--red)' : logs.some(l => l.level==='warn') ? 'var(--warn)' : 'var(--teal)'

  return (
    <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'1.5rem',boxShadow:'var(--shadow)',marginBottom:'1.5rem'}}>
      <div style={{fontWeight:700,fontSize:18,marginBottom:4}}>Análisis Demográfico y Socioeconómico</div>
      <div style={{fontSize:12,color:'var(--text2)',marginBottom:'1.25rem'}}>
        Selecciona una ubicación — el informe usa el máximo nivel de detalle disponible con fallback automático a provincia o CCAA
      </div>

      {/* Breadcrumb nivel seleccionado */}
      {(ccaa || prov || muni) && (
        <div style={{display:'flex',alignItems:'center',gap:6,fontSize:12,marginBottom:'1rem',flexWrap:'wrap'}}>
          <span style={{color:'var(--text3)'}}>Nivel:</span>
          {ccaa  && <span style={{background:'var(--bg3)',padding:'2px 8px',borderRadius:4,color:'var(--text2)'}}>{CCAA.find(c=>c.c===ccaa)?.n}</span>}
          {ccaa && prov && <span style={{color:'var(--text3)'}}>›</span>}
          {prov  && <span style={{background:'var(--bg3)',padding:'2px 8px',borderRadius:4,color:'var(--text2)'}}>{PROVINCES.find(p=>p.c===prov)?.n}</span>}
          {prov && muni && <span style={{color:'var(--text3)'}}>›</span>}
          {muni  && <span style={{background:'var(--amber-bg)',padding:'2px 8px',borderRadius:4,color:'var(--amber)',fontWeight:600}}>{munis.find(m=>String(m.Codigo)===muni)?.Nombre}</span>}
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'1rem',alignItems:'end'}}>
        <Sel
          label="Comunidad Autónoma"
          value={ccaa}
          onChange={v => setCcaa(v)}
          options={CCAA}
          placeholder="— Todas las CCAA —"
        />
        <Sel
          label="Provincia"
          value={prov}
          onChange={v => { setProv(v); setMuni(''); setMunis([]) }}
          disabled={false}
          options={provOptions}
          placeholder="— Seleccionar provincia —"
        />
        <Sel
          label={`Municipio${loading ? ' — cargando…' : ''}`}
          value={muni}
          onChange={handleMuni}
          disabled={!prov || loading}
          options={munis.map(m => ({ c: String(m.Codigo), n: m.Nombre }))}
          placeholder="— Seleccionar municipio —"
          count={munis.length > 0 ? `${munis.length} municipios` : ''}
        />
      </div>

      {err && <div style={{fontSize:11,color:'var(--red)',marginTop:8}}>⚠ {err}</div>}

      {/* Log panel */}
      {logs.length > 0 && (
        <div style={{marginTop:'1rem'}}>
          <button onClick={() => setShowLog(v => !v)} style={{fontSize:11,padding:'4px 10px',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text2)',cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
            <span style={{width:7,height:7,borderRadius:'50%',display:'inline-block',background:statusColor}}/>
            {showLog ? 'Ocultar' : 'Ver'} logs API ({logs.length})
          </button>
          {showLog && (
            <div style={{marginTop:8,background:'#0f0f0f',borderRadius:'var(--radius-sm)',padding:'0.75rem',fontFamily:'monospace',fontSize:11,maxHeight:280,overflowY:'auto',lineHeight:1.7}}>
              {logs.map((l, i) => (
                <div key={i} style={{color:logColor[l.level]||'#ccc'}}>
                  <span style={{opacity:.4}}>[{i+1}]</span>{' '}
                  <span style={{fontWeight:600}}>{l.level.toUpperCase()}</span>{' '}
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
