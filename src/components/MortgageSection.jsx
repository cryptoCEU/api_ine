import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { ineGet, filterByMuni, getLatest, EURIBOR, fNum, fEur, CH } from '../utils'
import { Section, Spinner, ErrorBox, KPI, Grid, ChartTooltip, Source } from './UI'

// Monthly mortgage payment
function calcCuota(capital, years, annualRate) {
  const r = annualRate / 100 / 12
  const n = years * 12
  if (r === 0) return capital / n
  return capital * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
}

// Max home price from monthly payment capacity
function maxPrice(monthlyCap, years, annualRate, ltv = 0.8) {
  const r = annualRate / 100 / 12
  const n = years * 12
  if (r === 0) return monthlyCap * n / ltv
  const mortgage = monthlyCap * (Math.pow(1 + r, n) - 1) / (r * Math.pow(1 + r, n))
  return mortgage / ltv
}

export default function MortgageSection({ muniCode }) {
  const [renta,   setRenta]   = useState(null)
  const [gasto,   setGasto]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [years,   setYears]   = useState(30)
  const [euribor, setEuribor] = useState(EURIBOR)
  const [spread,  setSpread]  = useState(1.0)
  const [ltv,     setLtv]     = useState(80)

  const load = useCallback(async () => {
    if (!muniCode) return
    setLoading(true); setError('')
    try {
      const [r1, r2] = await Promise.allSettled([
        ineGet('DATOS_TABLA/9949',  { nult: 1 }),
        ineGet('DATOS_TABLA/31097', { nult: 1 }),
      ])
      if (r1.status === 'fulfilled') {
        const s = filterByMuni(r1.value, muniCode)
        const netS = s.find(x => x.Nombre?.toLowerCase().includes('neta')) || s[0]
        const v = netS ? getLatest([netS]) : null
        if (v != null) setRenta(v)
        else setError('Sin datos de renta — usando estimación')
      }
      if (r2.status === 'fulfilled') {
        const s = filterByMuni(r2.value, muniCode)
        const v = getLatest(s)
        if (v != null) setGasto(v)
      }
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [muniCode])

  useEffect(() => { load() }, [load])

  const baseRenta = renta || 20000

  // 30% of net monthly income → max mortgage payment
  const rentaMensual    = baseRenta / 12
  const maxCuota        = rentaMensual * 0.30

  // Sensitivity range: Euribor ± 5% but min 0
  const rateRange = useMemo(() => {
    const base = euribor + spread
    return [-5, -3, -1, 0, 1, 3, 5].map(delta => {
      const rate = Math.max(0.1, base + delta)
      const cuota = calcCuota(maxPrice(maxCuota, years, rate, ltv/100) * (ltv/100), years, rate)
      return {
        delta: delta === 0 ? 'Base' : `${delta > 0 ? '+' : ''}${delta}%`,
        rate:  +rate.toFixed(2),
        precio: Math.round(maxPrice(maxCuota, years, rate, ltv/100)),
        cuota:  Math.round(cuota),
      }
    })
  }, [euribor, spread, years, ltv, maxCuota])

  const base = rateRange.find(r => r.delta === 'Base') || rateRange[3]

  const scenarioData = useMemo(() => rateRange.map(r => ({
    name:   r.delta,
    precio: r.precio,
    cuota:  r.cuota,
    rate:   r.rate,
  })), [rateRange])

  return (
    <Section title="Cuota hipotecaria máxima y precio de vivienda asumible"
      badge="Cálculo basado en renta neta disponible · Euríbor BDE"
      icon="🏠">
      {loading && <Spinner />}
      {!loading && (
        <>
          {error && <div style={{fontSize:12,color:'var(--warn)',marginBottom:10}}>ℹ {error}</div>}

          {/* Parameters */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem',marginBottom:'1.25rem',
            background:'var(--bg3)',borderRadius:'var(--radius-sm)',padding:'1rem'}}>
            <div>
              <div style={{fontSize:11,textTransform:'uppercase',letterSpacing:1,color:'var(--text3)',fontWeight:600,marginBottom:4}}>
                Euríbor base ({fNum(euribor, 1)}%)
              </div>
              <input type="range" min={0} max={8} step={0.1} value={euribor}
                onChange={e => setEuribor(+e.target.value)}/>
              <div style={{fontSize:11,color:'var(--text2)',marginTop:2}}>
                Tipo total: {fNum(euribor + spread, 2)}% (Euríbor + spread)
              </div>
            </div>
            <div>
              <div style={{fontSize:11,textTransform:'uppercase',letterSpacing:1,color:'var(--text3)',fontWeight:600,marginBottom:4}}>
                Spread bancario ({fNum(spread, 1)}%)
              </div>
              <input type="range" min={0} max={4} step={0.1} value={spread}
                onChange={e => setSpread(+e.target.value)}/>
            </div>
            <div>
              <div style={{fontSize:11,textTransform:'uppercase',letterSpacing:1,color:'var(--text3)',fontWeight:600,marginBottom:4}}>
                Plazo: {years} años
              </div>
              <input type="range" min={10} max={35} step={1} value={years}
                onChange={e => setYears(+e.target.value)}/>
            </div>
            <div>
              <div style={{fontSize:11,textTransform:'uppercase',letterSpacing:1,color:'var(--text3)',fontWeight:600,marginBottom:4}}>
                LTV financiación: {ltv}%
              </div>
              <input type="range" min={50} max={100} step={5} value={ltv}
                onChange={e => setLtv(+e.target.value)}/>
            </div>
          </div>

          {/* KPIs */}
          <Grid cols={4}>
            <KPI label="Renta neta anual"           value={fEur(Math.round(baseRenta))} sub={renta ? "INE" : "Estimada"}/>
            <KPI label="Cuota max mensual (30%)"     value={fEur(Math.round(maxCuota))} color={CH.amber}/>
            <KPI label="Precio vivienda asumible"    value={fEur(base.precio)} sub={`LTV ${ltv}% · ${years} años`} color={CH.teal}/>
            <KPI label="Tipo hipotecario"            value={`${fNum(base.rate, 2)}%`} sub={`Euríbor ${fNum(euribor,1)} + ${fNum(spread,1)}`}/>
          </Grid>

          {/* Gráfico sensibilidad */}
          <div style={{fontSize:12,color:'var(--text2)',fontWeight:600,marginBottom:8,marginTop:8}}>
            Sensibilidad precio asumible por variación tipo de interés
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={scenarioData} margin={{left:0,right:10,top:4,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
              <XAxis dataKey="name" tick={{fontSize:10,fill:'var(--text2)'}}/>
              <YAxis tickFormatter={v => `${fNum(v/1000)}k€`} tick={{fontSize:10,fill:'var(--text2)'}} width={65}/>
              <Tooltip content={<ChartTooltip fmtVal={v => fEur(v)}/>}/>
              <ReferenceLine x="Base" stroke="var(--amber)" strokeDasharray="4 4" label={{value:'Base',position:'top',fontSize:10,fill:'var(--amber)'}}/>
              <Line type="monotone" dataKey="precio" stroke={CH.blue} strokeWidth={2.5}
                dot={{r:4,fill:CH.blue}} name="Precio asumible"/>
            </LineChart>
          </ResponsiveContainer>

          {/* Tabla escenarios */}
          <div style={{marginTop:'1.25rem',overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead>
                <tr style={{borderBottom:'1px solid var(--border)'}}>
                  {['Escenario','Tipo total','Cuota máx / mes','Precio asumible','Entrada (20%)'].map(h => (
                    <th key={h} style={{padding:'6px 10px',textAlign:'left',color:'var(--text2)',fontWeight:600}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scenarioData.map((row, i) => (
                  <tr key={i} style={{
                    borderBottom:'1px solid var(--border)',
                    background: row.name === 'Base' ? 'var(--amber-bg)' : 'transparent'
                  }}>
                    <td style={{padding:'6px 10px',fontWeight:row.name==='Base'?600:400}}>{row.name}</td>
                    <td style={{padding:'6px 10px'}}>{fNum(row.rate, 2)}%</td>
                    <td style={{padding:'6px 10px'}}>{fEur(row.cuota)}</td>
                    <td style={{padding:'6px 10px',color:CH.teal,fontWeight:500}}>{fEur(row.precio)}</td>
                    <td style={{padding:'6px 10px',color:'var(--text2)'}}>{fEur(Math.round(row.precio * (1 - ltv/100)))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{marginTop:8,padding:'0.75rem',background:'var(--bg3)',borderRadius:'var(--radius-sm)',fontSize:11,color:'var(--text2)'}}>
            <b>Metodología:</b> Cuota máxima = 30% renta neta mensual.
            Precio asumible = hipoteca máxima / LTV. Hipoteca máxima calculada con cuota constante (sistema francés) a {years} años al tipo indicado.
            Euríbor de referencia: {fNum(euribor,1)}% (actualizar con{' '}
            <a href="https://www.bde.es/webbe/es/estadisticas/temas/tipos-interes.html" target="_blank" rel="noreferrer">BDE</a>).
          </div>
          <Source label="INE — Atlas renta (t=9949) · BDE Euríbor" href="https://www.bde.es/webbe/es/estadisticas/temas/tipos-interes.html"/>
        </>
      )}
    </Section>
  )
}
