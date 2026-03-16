import React, { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts'
import { ineGet, filterByMuni, getTimeSeries, cagr, fNum, fPct, CH } from '../utils'
import { Section, Spinner, ErrorBox, KPI, Grid, ChartTooltip, Source } from './UI'

export default function PopEvoSection({ muniCode, muniName }) {
  const [chartData, setChartData] = useState([])
  const [cagrVal, setCagrVal]     = useState(0)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

  const load = useCallback(async () => {
    if (!muniCode) return
    setLoading(true); setError('')
    try {
      const all = await ineGet('DATOS_TABLA/2879', { nult: 10 })
      const series = filterByMuni(all, muniCode)
      // filter to total (not by sex)
      const totalS = series.find(s =>
        !s.Nombre?.toLowerCase().includes('hombre') &&
        !s.Nombre?.toLowerCase().includes('mujer')
      ) || series[0]
      if (!totalS?.Data) throw new Error('Sin datos de evolución')
      const pts = getTimeSeries([totalS], 10)
      if (!pts.length) throw new Error('Sin datos')
      setChartData(pts.map(p => ({ año: String(p.year), value: p.value })))
      if (pts.length >= 2) setCagrVal(cagr(pts[0].value, pts[pts.length-1].value, pts.length-1))
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [muniCode])

  useEffect(() => { load() }, [load])

  const varAbs    = chartData.length >= 2 ? chartData[chartData.length-1].value - chartData[0].value : 0
  const varData   = chartData.slice(1).map((d, i) => ({
    año: d.año,
    variacion: Math.round(d.value - chartData[i].value)
  }))

  return (
    <Section title="Evolución de la población" badge="Padrón Municipal — últimos 10 años" icon="📈">
      {loading && <Spinner />}
      {!loading && error && <ErrorBox msg={error} retry={load} href="https://www.ine.es/jaxiT3/Tabla.htm?t=2879"/>}
      {!loading && !error && (
        <>
          <Grid cols={4}>
            <KPI label="Población actual"
              value={fNum(chartData[chartData.length-1]?.value)}
              sub={chartData[chartData.length-1]?.año} />
            <KPI label="Hace 10 años"
              value={fNum(chartData[0]?.value)}
              sub={chartData[0]?.año} />
            <KPI label="Variación total"
              value={`${varAbs > 0 ? '+' : ''}${fNum(varAbs)} hab.`}
              color={varAbs >= 0 ? 'var(--teal)' : 'var(--red)'} />
            <KPI label="CAGR 10 años"
              value={fPct(cagrVal)}
              sub="Tasa crec. anual comp."
              color={cagrVal >= 0 ? 'var(--teal)' : 'var(--red)'} />
          </Grid>

          <div style={{fontSize:12,color:'var(--text2)',fontWeight:600,marginBottom:6}}>
            Evolución población total
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{left:0,right:10,top:4,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
              <XAxis dataKey="año" tick={{fontSize:10,fill:'var(--text2)'}}/>
              <YAxis tickFormatter={v => fNum(v)} tick={{fontSize:10,fill:'var(--text2)'}} width={65}/>
              <Tooltip content={<ChartTooltip fmtVal={v => `${fNum(v)} hab.`}/>}/>
              <Line type="monotone" dataKey="value" stroke={CH.amber} strokeWidth={2.5}
                dot={{r:3,fill:CH.amber}} name={muniName}/>
            </LineChart>
          </ResponsiveContainer>

          {varData.length > 0 && (
            <>
              <div style={{fontSize:12,color:'var(--text2)',fontWeight:600,marginTop:16,marginBottom:6}}>
                Variación anual
              </div>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={varData} margin={{left:0,right:10,top:4,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                  <XAxis dataKey="año" tick={{fontSize:10,fill:'var(--text2)'}}/>
                  <YAxis tickFormatter={v => fNum(v)} tick={{fontSize:10,fill:'var(--text2)'}} width={65}/>
                  <Tooltip content={<ChartTooltip fmtVal={v => `${v > 0 ? '+' : ''}${fNum(v)} hab.`}/>}/>
                  <ReferenceLine y={0} stroke="var(--border2)"/>
                  <Bar dataKey="variacion" name="Variación anual" radius={[3,3,0,0]}
                    fill={CH.blue}/>
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
          <Source label="INE — Padrón Municipal de Habitantes (t=2879)" href="https://www.ine.es/dynt3/inebase/index.htm?padre=9632&capsel=9633"/>
        </>
      )}
    </Section>
  )
}
