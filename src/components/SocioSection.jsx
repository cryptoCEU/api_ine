import React, { useState, useEffect, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts'
import { ineGet, filterWithFallback, getLatest, NAT_MEDIAN, fNum, fEur, CH } from '../utils'
import { Section, Spinner, ErrorBox, KPI, Grid, ChartTooltip, Source, FallbackBadge } from './UI'

function classifyRenta(renta) {
  const r = renta / NAT_MEDIAN
  if (r > 2)     return { clase: 'Alta',  color: CH.amber, ratio: r }
  if (r >= 0.75) return { clase: 'Media', color: CH.blue,  ratio: r }
  return               { clase: 'Baja',  color: CH.red,   ratio: r }
}
function estimateDistrib(ratio) {
  if (ratio > 2)    return [40, 50, 10]
  if (ratio > 1.5)  return [25, 55, 20]
  if (ratio > 1)    return [15, 55, 30]
  if (ratio > 0.75) return [10, 55, 35]
  return                   [ 5, 45, 50]
}

export default function SocioSection({ muniCode, muniName, provCode, provName, ccaaCode, ccaaName }) {
  const [renta,      setRenta]      = useState(null)
  const [gasto,      setGasto]      = useState(null)
  const [rentaLevel, setRentaLevel] = useState('muni')
  const [gastoLevel, setGastoLevel] = useState('muni')
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')

  useEffect(() => {
    if (!muniCode) return
    setLoading(true); setError('')
    Promise.allSettled([
      ineGet('DATOS_TABLA/9949',  { nult: 1 }),
      ineGet('DATOS_TABLA/31097', { nult: 1 }),
    ]).then(([r1, r2]) => {
      if (r1.status === 'fulfilled') {
        const { data: s, level } = filterWithFallback(r1.value, muniCode, provCode, ccaaCode)
        const netS = s.find(x => x.Nombre?.toLowerCase().includes('neta')) || s[0]
        const v = netS ? getLatest([netS]) : null
        if (v != null) { setRenta(v); setRentaLevel(level) }
      }
      if (r2.status === 'fulfilled') {
        const { data: s, level } = filterWithFallback(r2.value, muniCode, provCode, ccaaCode)
        const v = getLatest(s)
        if (v != null) { setGasto(v); setGastoLevel(level) }
      }
    }).catch(() => setError('Error al obtener datos de renta'))
    .finally(() => setLoading(false))
  }, [muniCode, provCode, ccaaCode]) // ← fix: ccaaCode in deps

  const { clase, color, ratio, distrib } = useMemo(() => {
    if (!renta) return {}
    const cl = classifyRenta(renta)
    const d  = estimateDistrib(cl.ratio)
    return { ...cl, distrib: [
      { name: 'Clase alta',  value: d[0], color: CH.amber },
      { name: 'Clase media', value: d[1], color: CH.blue  },
      { name: 'Clase baja',  value: d[2], color: CH.red   },
    ]}
  }, [renta])

  const ahorroRate = useMemo(() => {
    if (!renta || !gasto) return null
    return fNum((renta - gasto) / renta * 100, 1)
  }, [renta, gasto])

  const barData = useMemo(() => renta ? [
    { name: 'Este municipio', value: Math.round(renta) },
    { name: 'Mediana nacional', value: NAT_MEDIAN },
  ] : [], [renta])

  // ← fix: derive a single fallback level and check both 'prov' and 'ccaa'
  const fallbackLevel = rentaLevel !== 'muni' ? rentaLevel : gastoLevel !== 'muni' ? gastoLevel : null
  const isFallback    = fallbackLevel && fallbackLevel !== 'muni'

  return (
    <Section title="Perfil socioeconómico" badge="Atlas distribución de renta · INE" icon="💰">
      {loading && <Spinner />}
      {!loading && !renta && (
        <ErrorBox msg={error || 'Sin datos de renta para ningún nivel'} href="https://www.ine.es/jaxiT3/Tabla.htm?t=9949"/>
      )}
      {!loading && renta && (
        <>
          {isFallback && (
            <FallbackBadge level={fallbackLevel} muniName={muniName} provName={provName} ccaaName={ccaaName}/>
          )}
          <Grid cols={3}>
            <KPI label="Renta neta / UC"      value={fEur(renta)}    sub={`vs ${fEur(NAT_MEDIAN)} mediana nac.`} color={color}/>
            <KPI label="Clasificación"         value={`Clase ${clase}`} sub={ratio ? `${fNum(ratio*100,0)}% de la mediana` : ''} color={color}/>
            {gasto && <KPI label="Gasto medio / hogar" value={fEur(gasto)} sub={ahorroRate ? `Tasa ahorro est. ${ahorroRate}%` : ''}/>}
          </Grid>

          {distrib && (
            <div style={{marginBottom:'1.25rem'}}>
              <div style={{fontSize:12,color:'var(--text2)',fontWeight:600,marginBottom:8}}>Distribución estimada por clase social</div>
              <div style={{display:'flex',gap:12,marginBottom:8,flexWrap:'wrap'}}>
                {distrib.map(d => (
                  <span key={d.name} style={{fontSize:12,color:'var(--text2)',display:'flex',alignItems:'center',gap:4}}>
                    <span style={{width:10,height:10,background:d.color,borderRadius:2,display:'inline-block'}}/>
                    {d.name}: <b style={{color:d.color}}>{d.value}%</b>
                  </span>
                ))}
              </div>
              <div style={{display:'flex',height:14,borderRadius:4,overflow:'hidden',gap:1}}>
                {distrib.map(d => <div key={d.name} style={{flex:d.value,background:d.color,opacity:.8}}/>)}
              </div>
            </div>
          )}

          {barData.length > 0 && (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={barData} margin={{left:0,right:10,top:0,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                <XAxis dataKey="name" tick={{fontSize:11,fill:'var(--text2)'}}/>
                <YAxis tickFormatter={v => fEur(v)} tick={{fontSize:10,fill:'var(--text2)'}} width={80}/>
                <Tooltip content={<ChartTooltip fmtVal={v => fEur(v)}/>}/>
                <Bar dataKey="value" name="Renta neta / UC" radius={[4,4,0,0]}>
                  {barData.map((_,i) => <Cell key={i} fill={i===0?CH.amber:CH.blue}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}

          <div style={{marginTop:'0.75rem',padding:'0.75rem',background:'var(--bg3)',borderRadius:'var(--radius-sm)',fontSize:12,color:'var(--text2)'}}>
            <b>Criterio:</b> &gt;200% mediana → clase alta · 75–200% → clase media · &lt;75% → clase baja<br/>
            <b>Mediana nacional:</b> {fEur(NAT_MEDIAN)} / UC / año (aprox. 2022)
          </div>
          <Source label="INE — Atlas renta (t=9949) · Encuesta Presupuestos Familiares (t=31097)" href="https://www.ine.es/jaxiT3/Tabla.htm?t=9949"/>
        </>
      )}
    </Section>
  )
}
