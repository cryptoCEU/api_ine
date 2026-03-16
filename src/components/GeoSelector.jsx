import React, { useState, useEffect } from 'react'
import { PROVINCES, ineGet } from '../utils'

export default function GeoSelector({ onSelect }) {
  const [prov, setProv]     = useState('')
  const [muni, setMuni]     = useState('')
  const [munis, setMunis]   = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr]       = useState('')

  useEffect(() => {
    if (!prov) { setMunis([]); setMuni(''); return }
    setLoading(true); setErr(''); setMuni('')
    const provInt = parseInt(prov, 10)

    const tryVars = async () => {
      // Try different INE variable IDs that contain municipalities
      for (const varId of [19, 3, 752, 115, 29]) {
        try {
          const data = await ineGet(`VALORES_VARIABLE/${varId}`)
          if (!Array.isArray(data) || data.length < 20) continue
          const firstCode = String(data[0]?.Codigo || '')
          if (firstCode.length < 4 || firstCode.length > 7) continue
          const filtered = data.filter(m => {
            const code = String(m.Codigo || '').padStart(5, '0')
            return code.startsWith(String(provInt).padStart(2, '0'))
          }).sort((a, b) => (a.Nombre || '').localeCompare(b.Nombre || '', 'es'))
          if (filtered.length > 1) { setMunis(filtered); return }
        } catch { continue }
      }
      setErr('No se pudieron cargar municipios. Comprueba la conexión.')
    }
    tryVars().finally(() => setLoading(false))
  }, [prov])

  const handleMuni = v => {
    setMuni(v)
    if (!v) return
    const found = munis.find(m => String(m.Codigo) === v)
    if (found) {
      onSelect({
        provCode : prov,
        provName : PROVINCES.find(p => p.c === prov)?.n || '',
        muniCode : String(found.Codigo).padStart(5, '0'),
        muniName : found.Nombre,
      })
    }
  }

  return (
    <div style={{
      background:'var(--bg2)',border:'1px solid var(--border)',
      borderRadius:'var(--radius)',padding:'1.5rem',
      boxShadow:'var(--shadow)',marginBottom:'1.5rem'
    }}>
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
          <select
            value={muni}
            onChange={e => handleMuni(e.target.value)}
            disabled={!prov || loading}
          >
            <option value="">— Seleccionar municipio —</option>
            {munis.map(m => (
              <option key={m.Codigo} value={String(m.Codigo)}>{m.Nombre}</option>
            ))}
          </select>
          {err && <div style={{fontSize:11,color:'var(--red)',marginTop:4}}>⚠ {err}</div>}
        </div>
      </div>
    </div>
  )
}
