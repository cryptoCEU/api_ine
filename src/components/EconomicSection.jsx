import React, { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ineGet, filterWithFallback, getLatest, fNum, fEur, CH } from '../utils'
import { Section, Spinner, ErrorBox, KPI, Grid, ChartTooltip, Source, FallbackBadge } from './UI'

// ─── 2.3.1 Empresas por actividad (DIRCE) ────────────────────────────────────
export function BusinessSection({ muniCode, muniName, provCode, provName, ccaaCode, ccaaName }) {
  const [data,      setData]    = useState([])
  const [total,     setTotal]   = useState(null)
  const [dataLevel, setLevel]   = useState('muni')
  const [loading,   setLoading] = useState(true)
  const [error,     setError]   = useState('')

  const load = useCallback(async () => {
    if (!muniCode) return
    setLoading(true); setError('')
    try {
      const all = await ineGet('DATOS_TABLA/4721', { nult: 1 })
      const { data: series, level } = filterWithFallback(all, muniCode, provCode, ccaaCode) // ← fix: ccaaCode
      if (!series.length) throw new Error('Sin datos para ningún nivel de agregación')
      setLevel(level)
      const sectors = {}; let tot = 0
      series.forEach(s => {
        const actMeta = (s.MetaData||[]).find(m =>
          m.Variable?.Nombre?.toLowerCase().includes('activid') ||
          m.Variable?.Nombre?.toLowerCase().includes('cnae')
        )
        const v = getLatest([s])
        if (v == null) return
        const nm = actMeta?.Nombre || 'Otros'
        if (nm.toLowerCase().includes('total')) tot += v
        else sectors[nm] = (sectors[nm]||0) + v
      })
      const sorted = Object.entries(sectors).sort((a,b)=>b[1]-a[1]).slice(0,10)
        .map(([name,value]) => ({ name: name.length>40?name.slice(0,40)+'…':name, value }))
      if (!sorted.length) throw new Error('Sin distribución sectorial')
      setData(sorted)
      setTotal(tot || sorted.reduce((s,d)=>s+d.value,0))
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [muniCode, provCode, ccaaCode]) // ← fix: ccaaCode in deps

  useEffect(() => { load() }, [load])

  return (
    <Section title="Distribución por actividad económica" badge="DIRCE — Directorio Central de Empresas · INE" icon="🏢">
      {loading && <Spinner />}
      {!loading && error && <ErrorBox msg={error} retry={load} href="https://www.ine.es/jaxiT3/Tabla.htm?t=4721"/>}
      {!loading && !error && (
        <>
          {dataLevel !== 'muni' && ( // ← fix: check both 'prov' and 'ccaa'
            <FallbackBadge level={dataLevel} muniName={muniName} provName={provName} ccaaName={ccaaName}/>
          )}
          {total != null && <div style={{marginBottom:'1rem'}}><KPI label="Total empresas" value={fNum(total)}/></div>}
          <ResponsiveContainer width="100%" height={Math.max(240, data.length*36)}>
            <BarChart data={data} layout="vertical" margin={{left:8,right:40,top:0,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false}/>
              <XAxis type="number" tick={{fontSize:10,fill:'var(--text2)'}} tickFormatter={v=>fNum(v)}/>
              <YAxis type="category" dataKey="name" tick={{fontSize:10,fill:'var(--text)'}} width={180}/>
              <Tooltip content={<ChartTooltip fmtVal={v=>`${fNum(v)} empresas`}/>}/>
              <Bar dataKey="value" name="Empresas" fill={CH.teal} radius={[0,4,4,0]}/>
            </BarChart>
          </ResponsiveContainer>
          <Source label="INE — DIRCE (t=4721)" href="https://www.ine.es/jaxiT3/Tabla.htm?t=4721"/>
        </>
      )}
    </Section>
  )
}

// ─── 2.3.2 Mercado laboral — Salario medio ────────────────────────────────────
export function LaborSection({ muniCode, muniName, provCode, provName, ccaaCode, ccaaName }) {
  const [salary,    setSalary]  = useState(null)
  const [dataLevel, setLevel]   = useState('muni')
  const [loading,   setLoading] = useState(true)
  const [error,     setError]   = useState('')

  useEffect(() => {
    if (!muniCode) return
    setLoading(true); setError('')
    ineGet('DATOS_TABLA/13930', { nult: 1 })
      .then(all => {
        const { data: s, level } = filterWithFallback(all, muniCode, provCode, ccaaCode) // ← fix: ccaaCode
        const v = getLatest(s)
        if (v != null) { setSalary(v); setLevel(level) }
        else setError('Sin datos de salario para ningún nivel')
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [muniCode, provCode, ccaaCode]) // ← fix: ccaaCode in deps

  const natRef = 25897

  return (
    <Section title="Mercado laboral — Salario medio" badge="Encuesta Estructura Salarial · INE" icon="💼">
      {loading && <Spinner />}
      {!loading && error && (
        <div>
          <ErrorBox msg={error} href="https://www.ine.es/jaxiT3/Tabla.htm?t=13930"/>
          <div style={{marginTop:10,fontSize:12,color:'var(--text2)'}}>
            Otras fuentes:{' '}
            <a href="https://www.sepe.es/HomeSepe/que-es-el-sepe/estadisticas/datos-estadisticos/municipios.html" target="_blank" rel="noreferrer">Paro y contratos SEPE →</a>
            {' · '}
            <a href="https://w6.seg-social.es/PXWeb/pxweb/es/Afiliados%20en%20alta%20laboral/" target="_blank" rel="noreferrer">Afiliados Seg. Social →</a>
          </div>
        </div>
      )}
      {!loading && !error && salary && (
        <>
          {dataLevel !== 'muni' && ( // ← fix: check both 'prov' and 'ccaa'
            <FallbackBadge level={dataLevel} muniName={muniName} provName={provName} ccaaName={ccaaName}/>
          )}
          <Grid cols={3}>
            <KPI label="Salario bruto medio" value={fEur(salary)} sub="Anual bruto" color={CH.amber}/>
            <KPI label="Media nacional"       value={fEur(natRef)} sub="España media"/>
            <KPI label="vs. media nacional"   value={`${salary>natRef?'+':''}${fNum((salary/natRef-1)*100,1)}%`}
              color={salary>=natRef?'var(--teal)':'var(--red)'}/>
          </Grid>
          <div style={{marginTop:8,padding:'0.75rem',background:'var(--bg3)',borderRadius:'var(--radius-sm)',fontSize:12,color:'var(--text2)'}}>
            <b>Fuentes adicionales:</b>{' '}
            <a href="https://www.sepe.es/HomeSepe/que-es-el-sepe/estadisticas/datos-estadisticos/municipios.html" target="_blank" rel="noreferrer">Tasa de paro y contratos SEPE</a>
            {' · '}
            <a href="https://w6.seg-social.es/PXWeb/pxweb/es/Afiliados%20en%20alta%20laboral/" target="_blank" rel="noreferrer">Afiliados por sector Seg. Social</a>
          </div>
          <Source label="INE — Encuesta Estructura Salarial (t=13930)" href="https://www.ine.es/jaxiT3/Tabla.htm?t=13930"/>
        </>
      )}
    </Section>
  )
}
