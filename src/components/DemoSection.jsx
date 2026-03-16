import React, { useState, useEffect, useMemo } from 'react'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { ineGet, filterWithFallback, getLatest, getTimeSeries, fNum, CH } from '../utils'
import { Section, Spinner, ErrorBox, ChartTooltip, Source, FallbackBadge } from './UI'

const EXT_LINKS = [
  { label: 'Variaciones (t=2881)',   href: 'https://www.ine.es/jaxiT3/Tabla.htm?t=2881' },
  { label: 'Nacionalidad (t=36859)', href: 'https://www.ine.es/jaxiT3/Tabla.htm?t=36859' },
  { label: 'Inmigración (t=69743)',  href: 'https://www.ine.es/jaxiT3/Tabla.htm?t=69743' },
  { label: 'Emigración (t=69746)',   href: 'https://www.ine.es/jaxiT3/Tabla.htm?t=69746' },
]

export default function DemoSection({ muniCode, muniName, provCode, provName, ccaaCode, ccaaName }) {
  const [fluxData,  setFluxData]  = useState([])
  const [nacData,   setNacData]   = useState(null)
  const [inmData,   setInmData]   = useState([])
  const [emigData,  setEmigData]  = useState([])
  const [levels,    setLevels]    = useState({})
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')

  useEffect(() => {
    if (!muniCode) return
    setLoading(true); setError('')
    Promise.allSettled([
      ineGet('DATOS_TABLA/2881',  {}),        // ALL years
      ineGet('DATOS_TABLA/36859', { nult:1 }),
      ineGet('DATOS_TABLA/69743', {}),        // ALL years
      ineGet('DATOS_TABLA/69746', {}),        // ALL years
    ]).then(([r1, r2, r3, r4]) => {
      let anyData = false
      const lvl = {}

      if (r1.status === 'fulfilled') {
        const { data: s, level } = filterWithFallback(r1.value, muniCode, provCode, ccaaCode)
        if (s.length) {
          setFluxData(getTimeSeries([s[0]]).map(p => ({ año: String(p.year), variacion: p.value })))
          lvl.flux = level; anyData = true
        }
      }
      if (r2.status === 'fulfilled') {
        const { data: s, level } = filterWithFallback(r2.value, muniCode, provCode, ccaaCode)
        const espS = s.find(x => x.Nombre?.toLowerCase().includes('española'))
        const extS = s.find(x => x.Nombre?.toLowerCase().includes('extranjer'))
        const espV = getLatest([espS].filter(Boolean))
        const extV = getLatest([extS].filter(Boolean))
        if (espV != null || extV != null) { setNacData({ esp:espV||0, ext:extV||0 }); lvl.nac = level; anyData = true }
      }
      if (r3.status === 'fulfilled') {
        const { data: s, level } = filterWithFallback(r3.value, muniCode, provCode, ccaaCode)
        if (s.length) { setInmData(getTimeSeries([s[0]]).map(p=>({año:String(p.year),value:p.value}))); lvl.inm=level; anyData=true }
      }
      if (r4.status === 'fulfilled') {
        const { data: s, level } = filterWithFallback(r4.value, muniCode, provCode, ccaaCode)
        if (s.length) { setEmigData(getTimeSeries([s[0]]).map(p=>({año:String(p.year),value:p.value}))); lvl.emig=level; anyData=true }
      }
      setLevels(lvl)
      if (!anyData) setError('Sin datos de dinámica demográfica para ningún nivel de agregación.')
    }).finally(() => setLoading(false))
  }, [muniCode, provCode, ccaaCode]) // ← fix: ccaaCode in deps

  const nacPie = useMemo(() => {
    if (!nacData) return []
    const t = (nacData.esp||0) + (nacData.ext||0)
    if (!t) return []
    return [
      { name:'Española',   value:nacData.esp, pct:+((nacData.esp/t)*100).toFixed(1), color:CH.blue },
      { name:'Extranjera', value:nacData.ext, pct:+((nacData.ext/t)*100).toFixed(1), color:CH.amber },
    ]
  }, [nacData])

  // ← fix: check both 'prov' and 'ccaa' across all sub-datasets
  const allLevels    = Object.values(levels)
  const anyFallback  = allLevels.some(l => l !== 'muni')
  const fallbackLevel = allLevels.includes('ccaa') ? 'ccaa' : allLevels.includes('prov') ? 'prov' : null
  const hasAny       = fluxData.length || nacPie.length || inmData.length || emigData.length

  const mkChart = (data, label, fill, fmtVal) => (
    <div>
      <div style={{fontSize:12,color:'var(--text2)',fontWeight:600,marginBottom:8}}>
        {label}{data.length>1 ? ` (${data[0].año}–${data[data.length-1].año})` : ''}
      </div>
      <ResponsiveContainer width="100%" height={170}>
        <BarChart data={data} margin={{left:0,right:0,top:0,bottom:0}}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
          <XAxis dataKey="año" tick={{fontSize:10,fill:'var(--text2)'}} interval="preserveStartEnd"/>
          <YAxis tick={{fontSize:10,fill:'var(--text2)'}} tickFormatter={v=>fNum(v)} width={55}/>
          <Tooltip content={<ChartTooltip fmtVal={fmtVal}/>}/>
          {data[0]?.variacion !== undefined && <ReferenceLine y={0} stroke="var(--border2)"/>}
          <Bar dataKey={data[0]?.variacion !== undefined ? 'variacion' : 'value'} name={label} fill={fill} radius={[3,3,0,0]}/>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )

  return (
    <Section title="Dinámicas demográficas y migraciones"
      badge="Variaciones residenciales · Padrón por nacionalidad · Migraciones" icon="🌍">
      {loading && <Spinner />}
      {!loading && !hasAny && (
        <div>
          <ErrorBox msg={error}/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:10}}>
            {EXT_LINKS.map(l => (
              <a key={l.label} href={l.href} target="_blank" rel="noreferrer"
                style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',display:'block',fontSize:12,textAlign:'center',padding:'0.5rem',color:'var(--text2)'}}>
                {l.label}
              </a>
            ))}
          </div>
        </div>
      )}
      {!loading && hasAny && (
        <>
          {anyFallback && fallbackLevel && (
            <FallbackBadge level={fallbackLevel} muniName={muniName} provName={provName} ccaaName={ccaaName}/>
          )}

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.5rem'}}>
            {fluxData.length > 0
              ? mkChart(fluxData, 'Variación residencial neta', CH.blue, v=>`${fNum(v)} hab.`)
              : <div style={{fontSize:12,color:'var(--text2)',textAlign:'center',padding:'1rem'}}>Sin datos variación · <a href={EXT_LINKS[0].href} target="_blank" rel="noreferrer">INE →</a></div>
            }
            <div>
              <div style={{fontSize:12,color:'var(--text2)',fontWeight:600,marginBottom:8}}>Población por nacionalidad</div>
              {nacPie.length > 0
                ? <>
                    <ResponsiveContainer width="100%" height={140}>
                      <PieChart>
                        <Pie data={nacPie} cx="50%" cy="50%" outerRadius={60} dataKey="value" paddingAngle={2}>
                          {nacPie.map((e,i) => <Cell key={i} fill={e.color}/>)}
                        </Pie>
                        <Tooltip formatter={v=>fNum(v)}/>
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{display:'flex',gap:16,justifyContent:'center',fontSize:12,marginTop:4,flexWrap:'wrap'}}>
                      {nacPie.map(d => (
                        <span key={d.name} style={{color:'var(--text2)',display:'flex',alignItems:'center',gap:4}}>
                          <span style={{width:8,height:8,borderRadius:'50%',background:d.color,display:'inline-block'}}/>
                          {d.name} <b style={{color:d.color}}>{d.pct}%</b>
                          <span style={{color:'var(--text3)'}}>({fNum(d.value)})</span>
                        </span>
                      ))}
                    </div>
                  </>
                : <div style={{fontSize:12,color:'var(--text2)',textAlign:'center',padding:'1rem'}}>Sin datos · <a href={EXT_LINKS[1].href} target="_blank" rel="noreferrer">INE →</a></div>
              }
            </div>
          </div>

          {(inmData.length > 0 || emigData.length > 0) && (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.5rem',marginTop:'1.5rem'}}>
              {inmData.length  > 0 && mkChart(inmData,  'Inmigración exterior', CH.teal, v=>`${fNum(v)} pers.`)}
              {emigData.length > 0 && mkChart(emigData, 'Emigración exterior',  CH.red,  v=>`${fNum(v)} pers.`)}
            </div>
          )}

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginTop:10}}>
            <Source label="Variaciones residenciales (t=2881)" href="https://www.ine.es/jaxiT3/Tabla.htm?t=2881"/>
            <Source label="Inmigración (t=69743)"              href="https://www.ine.es/jaxiT3/Tabla.htm?t=69743"/>
          </div>
        </>
      )}
    </Section>
  )
}
