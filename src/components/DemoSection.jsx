import React, { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts'
import { ineGet, filterByMuni, getLatest, getTimeSeries, fNum, CH } from '../utils'
import { Section, Spinner, ErrorBox, KPI, Grid, ChartTooltip, Source } from './UI'

const EXT_LINKS = [
  { label: 'Variaciones (t=2881)',   href: 'https://www.ine.es/jaxiT3/Tabla.htm?t=2881' },
  { label: 'Nacionalidad (t=36859)', href: 'https://www.ine.es/jaxiT3/Tabla.htm?t=36859' },
  { label: 'Inmigración (t=69743)',  href: 'https://www.ine.es/jaxiT3/Tabla.htm?t=69743' },
  { label: 'Emigración (t=69746)',   href: 'https://www.ine.es/jaxiT3/Tabla.htm?t=69746' },
]

export default function DemoSection({ muniCode }) {
  const [fluxData,  setFluxData]  = useState([])
  const [nacData,   setNacData]   = useState(null)
  const [inmData,   setInmData]   = useState(null)
  const [emigData,  setEmigData]  = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')

  useEffect(() => {
    if (!muniCode) return
    setLoading(true); setError('')

    Promise.allSettled([
      ineGet('DATOS_TABLA/2881',  { nult: 5 }),
      ineGet('DATOS_TABLA/36859', { nult: 1 }),
      ineGet('DATOS_TABLA/69743', { nult: 5 }),
      ineGet('DATOS_TABLA/69746', { nult: 5 }),
    ]).then(([r1, r2, r3, r4]) => {
      let anyData = false

      if (r1.status === 'fulfilled') {
        const s = filterByMuni(r1.value, muniCode)
        if (s.length) {
          const pts = getTimeSeries([s[0]], 5)
          setFluxData(pts.map(p => ({ año: String(p.year), variacion: p.value })))
          anyData = true
        }
      }
      if (r2.status === 'fulfilled') {
        const s = filterByMuni(r2.value, muniCode)
        const espS = s.find(x => x.Nombre?.toLowerCase().includes('española'))
        const extS = s.find(x => x.Nombre?.toLowerCase().includes('extranjer'))
        const espV = getLatest([espS].filter(Boolean))
        const extV = getLatest([extS].filter(Boolean))
        if (espV != null || extV != null) { setNacData({ esp: espV||0, ext: extV||0 }); anyData = true }
      }
      if (r3.status === 'fulfilled') {
        const s = filterByMuni(r3.value, muniCode)
        if (s.length) {
          setInmData(getTimeSeries([s[0]], 5).map(p => ({ año: String(p.year), value: p.value })))
          anyData = true
        }
      }
      if (r4.status === 'fulfilled') {
        const s = filterByMuni(r4.value, muniCode)
        if (s.length) {
          setEmigData(getTimeSeries([s[0]], 5).map(p => ({ año: String(p.year), value: p.value })))
          anyData = true
        }
      }
      if (!anyData) setError('Sin datos de dinámica demográfica para este municipio.')
    }).finally(() => setLoading(false))
  }, [muniCode])

  const nacPie = useMemo(() => {
    if (!nacData) return []
    const t = (nacData.esp||0) + (nacData.ext||0)
    if (!t) return []
    return [
      { name:'Española',   value:nacData.esp, pct:+(nacData.esp/t*100).toFixed(1), color:CH.blue },
      { name:'Extranjera', value:nacData.ext, pct:+(nacData.ext/t*100).toFixed(1), color:CH.amber },
    ]
  }, [nacData])

  const hasAny = fluxData.length || nacPie.length || inmData?.length || emigData?.length

  return (
    <Section title="Dinámicas demográficas y migraciones" badge="Variaciones residenciales · Padrón por nacionalidad · Migraciones" icon="🌍">
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
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.5rem'}}>
            {/* Variación residencial */}
            <div>
              <div style={{fontSize:12,color:'var(--text2)',fontWeight:600,marginBottom:8}}>Variación residencial neta</div>
              {fluxData.length > 0
                ? <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={fluxData} margin={{left:0,right:0,top:0,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                      <XAxis dataKey="año" tick={{fontSize:10,fill:'var(--text2)'}}/>
                      <YAxis tick={{fontSize:10,fill:'var(--text2)'}} tickFormatter={v => fNum(v)} width={55}/>
                      <Tooltip content={<ChartTooltip fmtVal={v => `${fNum(v)} hab.`}/>}/>
                      <ReferenceLine y={0} stroke="var(--border2)"/>
                      <Bar dataKey="variacion" name="Variación" fill={CH.blue} radius={[3,3,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                : <div style={{fontSize:12,color:'var(--text2)',textAlign:'center',padding:'1rem'}}>
                    Sin datos · <a href="https://www.ine.es/jaxiT3/Tabla.htm?t=2881" target="_blank" rel="noreferrer">Ver en INE →</a>
                  </div>
              }
            </div>

            {/* Nacionalidad */}
            <div>
              <div style={{fontSize:12,color:'var(--text2)',fontWeight:600,marginBottom:8}}>Población por nacionalidad</div>
              {nacPie.length > 0
                ? <>
                    <ResponsiveContainer width="100%" height={120}>
                      <PieChart>
                        <Pie data={nacPie} cx="50%" cy="50%" outerRadius={55} dataKey="value" paddingAngle={2}>
                          {nacPie.map((e, i) => <Cell key={i} fill={e.color}/>)}
                        </Pie>
                        <Tooltip formatter={v => fNum(v)}/>
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
                : <div style={{fontSize:12,color:'var(--text2)',textAlign:'center',padding:'1rem'}}>
                    Sin datos · <a href="https://www.ine.es/jaxiT3/Tabla.htm?t=36859" target="_blank" rel="noreferrer">Ver en INE →</a>
                  </div>
              }
            </div>
          </div>

          {/* Inmigración y emigración */}
          {(inmData?.length || emigData?.length) && (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.5rem',marginTop:'1.5rem'}}>
              {inmData?.length > 0 && (
                <div>
                  <div style={{fontSize:12,color:'var(--text2)',fontWeight:600,marginBottom:8}}>Inmigración exterior</div>
                  <ResponsiveContainer width="100%" height={130}>
                    <BarChart data={inmData} margin={{left:0,right:0,top:0,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                      <XAxis dataKey="año" tick={{fontSize:10,fill:'var(--text2)'}}/>
                      <YAxis tick={{fontSize:10,fill:'var(--text2)'}} tickFormatter={v => fNum(v)} width={55}/>
                      <Tooltip content={<ChartTooltip fmtVal={v => `${fNum(v)} pers.`}/>}/>
                      <Bar dataKey="value" name="Inmigrantes" fill={CH.teal} radius={[3,3,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {emigData?.length > 0 && (
                <div>
                  <div style={{fontSize:12,color:'var(--text2)',fontWeight:600,marginBottom:8}}>Emigración exterior</div>
                  <ResponsiveContainer width="100%" height={130}>
                    <BarChart data={emigData} margin={{left:0,right:0,top:0,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                      <XAxis dataKey="año" tick={{fontSize:10,fill:'var(--text2)'}}/>
                      <YAxis tick={{fontSize:10,fill:'var(--text2)'}} tickFormatter={v => fNum(v)} width={55}/>
                      <Tooltip content={<ChartTooltip fmtVal={v => `${fNum(v)} pers.`}/>}/>
                      <Bar dataKey="value" name="Emigrantes" fill={CH.red} radius={[3,3,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginTop:10}}>
            <Source label="Variaciones residenciales (t=2881)"  href="https://www.ine.es/jaxiT3/Tabla.htm?t=2881"/>
            <Source label="Inmigración (t=69743)"               href="https://www.ine.es/jaxiT3/Tabla.htm?t=69743"/>
          </div>
        </>
      )}
    </Section>
  )
}
