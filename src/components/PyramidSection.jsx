import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import { ineGet, filterWithFallback, getLatest, AGE_GROUPS, SPAIN_M, SPAIN_F, fNum } from '../utils'
import { Section, Spinner, InfoBadge, FallbackBadge, KPI, Grid, ChartTooltip, Source } from './UI'

export default function PyramidSection({ muniCode, muniName, provCode, provName, ccaaCode, ccaaName }) {
  const [data,      setData]    = useState(null)
  const [totals,    setTotals]  = useState(null)
  const [year,      setYear]    = useState(0)
  const [dataLevel, setLevel]   = useState('muni')
  const [loading,   setLoading] = useState(true)

  const buildEstimated = useCallback((totalPop, yr, level) => {
    const d = AGE_GROUPS.map((g, i) => {
      const h = Math.round(totalPop * SPAIN_M[i])
      const m = Math.round(totalPop * SPAIN_F[i])
      return { age: g, Hombres: -h, Mujeres: m, absH: h, absM: m }
    })
    setData(d)
    const th = d.reduce((s, x) => s + x.absH, 0)
    const tm = d.reduce((s, x) => s + x.absM, 0)
    setTotals({ h: th, m: tm, total: th + tm })
    setYear(yr)
    setLevel(level + '-estimated')
  }, [])

  const parsePyramid = useCallback((series) => {
    const pyramid = {}; let yr = 0
    series.forEach(s => {
      const sexMeta = (s.MetaData || []).find(m => m.Variable?.Nombre?.toLowerCase().includes('sexo'))
      const ageMeta = (s.MetaData || []).find(m => m.Variable?.Nombre?.toLowerCase().includes('edad'))
      if (!sexMeta || !ageMeta) return
      const sexNm = (sexMeta.Nombre || '').toLowerCase()
      const ageNm = ageMeta.Nombre || ''
      const val   = s.Data?.[0]?.Valor
      if (val == null) return
      if ((s.Data[0].Anyo || 0) > yr) yr = s.Data[0].Anyo
      const ageNum = parseInt((ageNm.match(/(\d+)/) || [])[1] || '0')
      const ag = AGE_GROUPS.find(g => ageNum === parseInt(g.split('-')[0]))
      if (!ag) return
      if (!pyramid[ag]) pyramid[ag] = { H: 0, M: 0 }
      if (sexNm.includes('hombre') || sexNm === '1') pyramid[ag].H += val
      else if (sexNm.includes('mujer') || sexNm === '6') pyramid[ag].M += val
    })
    const pd = AGE_GROUPS.map(g => ({
      age: g, Hombres: -(pyramid[g]?.H || 0), Mujeres: pyramid[g]?.M || 0,
      absH: pyramid[g]?.H || 0, absM: pyramid[g]?.M || 0,
    }))
    return { pd, th: pd.reduce((s,x)=>s+x.absH,0), tm: pd.reduce((s,x)=>s+x.absM,0), yr }
  }, [])

  const load = useCallback(async () => {
    if (!muniCode) return
    setLoading(true)
    try {
      // Try age-by-sex table first
      const all = await ineGet('DATOS_TABLA/56934', { nult: 1 })
      const { data: series, level } = filterWithFallback(all, muniCode, provCode, ccaaCode)
      if (series.length > 0) {
        const { pd, th, tm, yr } = parsePyramid(series)
        if (th + tm > 0) {
          setData(pd); setTotals({ h: th, m: tm, total: th + tm }); setYear(yr); setLevel(level)
          return
        }
      }
      throw new Error('sin datos pirámide')
    } catch {
      // Fallback: total population → estimate with national age distribution
      try {
        const all2 = await ineGet('DATOS_TABLA/2879', { nult: 1 })
        const { data: s2, level } = filterWithFallback(all2, muniCode, provCode, ccaaCode) // ← fix: ccaaCode
        const tot = getLatest(s2) || 20000
        const yr  = (s2[0]?.Data || []).sort((a,b)=>(b.Anyo||0)-(a.Anyo||0))[0]?.Anyo || 2023
        buildEstimated(tot, yr, level)
      } catch {
        buildEstimated(20000, 2023, 'estimated')
      }
    } finally { setLoading(false) }
  }, [muniCode, provCode, ccaaCode, parsePyramid, buildEstimated]) // ← fix: ccaaCode in deps

  useEffect(() => { load() }, [load])

  const maxV = useMemo(() =>
    data ? Math.max(...data.map(d => Math.max(Math.abs(d.Hombres), d.Mujeres))) : 1000
  , [data])

  const depRatio = useMemo(() => {
    if (!data) return null
    const young = data.filter(d => parseInt(d.age) < 15).reduce((s,d)=>s+d.absH+d.absM, 0)
    const old   = data.filter(d => parseInt(d.age) >= 65).reduce((s,d)=>s+d.absH+d.absM, 0)
    const work  = data.filter(d => { const a=parseInt(d.age); return a>=15&&a<65 }).reduce((s,d)=>s+d.absH+d.absM, 0)
    return work > 0 ? fNum((young+old)/work*100, 1) : null
  }, [data])

  // 'muni' | 'prov' | 'ccaa' | 'prov-estimated' | 'ccaa-estimated' | 'estimated'
  const baseLevel    = dataLevel.replace('-estimated', '')
  const isEstimated  = dataLevel.includes('estimated')
  const isFallback   = baseLevel === 'prov' || baseLevel === 'ccaa'

  return (
    <Section title="Pirámide de población" badge={`Padrón Municipal${year ? ` · ${year}` : ''}`} icon="👥">
      {loading && <Spinner />}
      {!loading && (
        <>
          {isFallback && (
            <FallbackBadge level={baseLevel} muniName={muniName} provName={provName} ccaaName={ccaaName}/>
          )}
          {isEstimated && (
            <InfoBadge>
              Distribución por edad estimada con proporciones nacionales.{' '}
              <a href="https://www.ine.es/aplicaciones/piramides/" target="_blank" rel="noreferrer">Ver pirámide oficial →</a>
            </InfoBadge>
          )}
          {totals && (
            <Grid cols={4}>
              <KPI label="Población total"  value={fNum(totals.total)} sub={year ? `Padrón ${year}` : ''}/>
              <KPI label="Hombres"           value={fNum(totals.h)}     sub={`${fNum(totals.total>0?totals.h/totals.total*100:0,1)}%`} color="var(--male)"/>
              <KPI label="Mujeres"           value={fNum(totals.m)}     sub={`${fNum(totals.total>0?totals.m/totals.total*100:0,1)}%`} color="var(--female)"/>
              {depRatio && <KPI label="Tasa dependencia" value={`${depRatio}%`} sub="Dep. / Pob. activa"/>}
            </Grid>
          )}
          <div style={{display:'flex',gap:16,fontSize:12,color:'var(--text2)',marginBottom:8,justifyContent:'center'}}>
            <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:10,height:10,background:'var(--male)',borderRadius:2,display:'inline-block'}}/> Hombres</span>
            <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:10,height:10,background:'var(--female)',borderRadius:2,display:'inline-block'}}/> Mujeres</span>
          </div>
          {data && (
            <ResponsiveContainer width="100%" height={430}>
              <BarChart data={data} layout="vertical" margin={{left:8,right:8,top:0,bottom:0}} barGap={0} barCategoryGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false}/>
                <XAxis type="number" domain={[-maxV*1.1,maxV*1.1]} tickFormatter={v=>fNum(Math.abs(v))} tick={{fontSize:10,fill:'var(--text2)'}}/>
                <YAxis type="category" dataKey="age" tick={{fontSize:10,fill:'var(--text)'}} width={32}/>
                <Tooltip content={<ChartTooltip fmtVal={v=>`${fNum(Math.abs(v))} hab.`}/>}/>
                <ReferenceLine x={0} stroke="var(--border2)" strokeWidth={1}/>
                <Bar dataKey="Hombres" fill="var(--male)"   name="Hombres"/>
                <Bar dataKey="Mujeres" fill="var(--female)" name="Mujeres"/>
              </BarChart>
            </ResponsiveContainer>
          )}
          <Source label="INE — Padrón Municipal por edad y sexo" href="https://www.ine.es/aplicaciones/piramides/"/>
        </>
      )}
    </Section>
  )
}
