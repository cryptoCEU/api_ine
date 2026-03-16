import React, { useState } from 'react'
import GeoSelector     from './components/GeoSelector'
import PyramidSection  from './components/PyramidSection'
import SocioSection    from './components/SocioSection'
import PopEvoSection   from './components/PopEvoSection'
import DemoSection     from './components/DemoSection'
import { BusinessSection, LaborSection } from './components/EconomicSection'
import MortgageSection from './components/MortgageSection'

const NAV = [
  { id: '2.1', label: '2.1 Población y pirámide' },
  { id: '2.2', label: '2.2 Evolución y migraciones' },
  { id: '2.3', label: '2.3 Economía y mercado laboral' },
  { id: '2.4', label: '2.4 Hipoteca y vivienda' },
]

export default function App() {
  const [location, setLocation] = useState(null)
  const [active,   setActive]   = useState('2.1')

  const geo = location || {}
  // Shared props passed to every section
  const sharedProps = {
    muniCode : geo.muniCode,
    muniName : geo.muniName,
    provCode : geo.provCode,
    provName : geo.provName,
  }

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)'}}>
      {/* Header */}
      <header style={{background:'var(--bg2)',borderBottom:'1px solid var(--border)',padding:'0 1.5rem',position:'sticky',top:0,zIndex:100}}>
        <div style={{maxWidth:1100,margin:'0 auto',display:'flex',alignItems:'center',gap:'1rem',height:54}}>
          <div style={{fontWeight:700,fontSize:15,whiteSpace:'nowrap'}}>📊 INE Dashboard</div>
          {location && (
            <div style={{display:'flex',alignItems:'center',gap:6,fontSize:13}}>
              <span style={{color:'var(--text3)'}}>·</span>
              <span style={{fontWeight:600}}>{location.muniName}</span>
              <span style={{color:'var(--text3)',fontSize:12}}>{location.provName}</span>
            </div>
          )}
          <div style={{flex:1}}/>
          {location && (
            <nav style={{display:'flex',gap:4}}>
              {NAV.map(n => (
                <button key={n.id} onClick={() => setActive(n.id)} style={{
                  padding:'6px 12px', fontSize:12, borderRadius:'var(--radius-sm)',
                  border: active===n.id ? '1px solid var(--amber)' : '1px solid transparent',
                  background: active===n.id ? 'var(--amber-bg)' : 'transparent',
                  color: active===n.id ? 'var(--amber)' : 'var(--text2)',
                  fontWeight: active===n.id ? 600 : 400, cursor:'pointer',
                }}>
                  {n.label}
                </button>
              ))}
            </nav>
          )}
        </div>
      </header>

      {/* Main */}
      <main style={{maxWidth:1100,margin:'0 auto',padding:'1.5rem'}}>
        <GeoSelector onSelect={loc => { setLocation(loc); setActive('2.1') }}/>

        {!location && (
          <div style={{textAlign:'center',padding:'4rem 1rem',color:'var(--text2)'}}>
            <div style={{fontSize:40,marginBottom:12}}>🗺️</div>
            <div style={{fontWeight:600,marginBottom:6}}>Selecciona una ubicación para comenzar</div>
            <div style={{fontSize:12,color:'var(--text3)',maxWidth:400,margin:'0 auto'}}>
              Elige provincia y municipio para generar el análisis completo con datos en tiempo real del INE
            </div>
          </div>
        )}

        {location && (
          <>
            <div style={{display: active==='2.1' ? 'grid' : 'none', gap:'1.25rem'}}>
              <div style={{fontSize:12,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:1}}>2.1 Análisis Poblacional y Demográfico</div>
              <PyramidSection {...sharedProps}/>
              <SocioSection   {...sharedProps}/>
            </div>

            <div style={{display: active==='2.2' ? 'grid' : 'none', gap:'1.25rem'}}>
              <div style={{fontSize:12,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:1}}>2.2 Evolución Poblacional y Demográfica</div>
              <PopEvoSection  {...sharedProps}/>
              <DemoSection    {...sharedProps}/>
            </div>

            <div style={{display: active==='2.3' ? 'grid' : 'none', gap:'1.25rem'}}>
              <div style={{fontSize:12,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:1}}>2.3 Indicadores Socioeconómicos</div>
              <BusinessSection {...sharedProps}/>
              <LaborSection    {...sharedProps}/>
            </div>

            <div style={{display: active==='2.4' ? 'grid' : 'none', gap:'1.25rem'}}>
              <div style={{fontSize:12,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:1}}>2.4 Capacidad Adquisitiva y Vivienda</div>
              <MortgageSection {...sharedProps}/>
            </div>
          </>
        )}
      </main>

      <footer style={{textAlign:'center',padding:'2rem',fontSize:11,color:'var(--text3)',borderTop:'1px solid var(--border)',marginTop:'2rem'}}>
        Datos en tiempo real via{' '}
        <a href="https://www.ine.es/dyngs/DataLab/es/manual.htm?cid=1259945948443" target="_blank" rel="noreferrer">API JSON del INE</a>
        {' · '}
        <a href="https://www.bde.es" target="_blank" rel="noreferrer">Banco de España</a>
        {' · '}
        <a href="https://www.sepe.es" target="_blank" rel="noreferrer">SEPE</a>
      </footer>
    </div>
  )
}
