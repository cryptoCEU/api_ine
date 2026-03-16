import React from 'react'

const css = {
  card: {
    background:'var(--bg2)', border:'1px solid var(--border)',
    borderRadius:'var(--radius)', padding:'1.5rem',
    boxShadow:'var(--shadow)',
  },
  metCard: {
    background:'var(--bg3)', borderRadius:'var(--radius-sm)', padding:'1rem',
  },
  lbl: {
    fontSize:11, textTransform:'uppercase', letterSpacing:1.1,
    color:'var(--text3)', fontWeight:600, marginBottom:4,
  },
}

export function Spinner() {
  return (
    <div style={{display:'flex',alignItems:'center',gap:8,justifyContent:'center',padding:'2rem',color:'var(--text2)'}}>
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" className="spin">
        <circle cx={12} cy={12} r={9} stroke="var(--border2)" strokeWidth={2.5}/>
        <path d="M12 3 A9 9 0 0 1 21 12" stroke="var(--amber)" strokeWidth={2.5} strokeLinecap="round"/>
      </svg>
      <span style={{fontSize:13}}>Consultando INE…</span>
    </div>
  )
}

export function ErrorBox({ msg, href, retry }) {
  return (
    <div style={{background:'var(--red-bg)',border:'1px solid #F5C6C3',borderRadius:'var(--radius-sm)',padding:'0.75rem 1rem',fontSize:13}}>
      <div style={{color:'var(--red)',fontWeight:600,marginBottom:4}}>⚠ {msg}</div>
      {href && <a href={href} target="_blank" rel="noreferrer" style={{fontSize:12,color:'var(--red)'}}>Ver tabla en INE →</a>}
      {retry && <button onClick={retry} style={{marginLeft:8,fontSize:12,padding:'3px 10px',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)',background:'white'}}>Reintentar</button>}
    </div>
  )
}

/**
 * FallbackBadge — shown when data comes from province level instead of municipality
 */
export function FallbackBadge({ muniName, provName }) {
  return (
    <div style={{
      background:'var(--warn-bg)', border:'1px solid #E8C84A',
      borderRadius:'var(--radius-sm)', padding:'8px 12px',
      fontSize:12, color:'var(--warn)', marginBottom:12,
      display:'flex', alignItems:'flex-start', gap:8,
    }}>
      <span style={{fontSize:14, lineHeight:1}}>⚠</span>
      <div>
        <b>Datos no disponibles para {muniName} — mostrando datos provinciales</b>
        <div style={{marginTop:2, opacity:.85}}>
          Los datos mostrados corresponden a la provincia de <b>{provName}</b>, no al municipio exacto.
        </div>
      </div>
    </div>
  )
}

export function KPI({ label, value, sub, color }) {
  return (
    <div style={css.metCard}>
      <div style={css.lbl}>{label}</div>
      <div style={{fontSize:20,fontWeight:600,color:color||'var(--text)',lineHeight:1.2}}>{value}</div>
      {sub && <div style={{fontSize:11,color:'var(--text2)',marginTop:3}}>{sub}</div>}
    </div>
  )
}

export function Section({ title, badge, icon, children }) {
  return (
    <div style={{...css.card,animation:'fadeup .35s ease both'}} className="fade">
      <div style={{borderBottom:'1px solid var(--border)',paddingBottom:'0.875rem',marginBottom:'1.25rem',display:'flex',alignItems:'center',gap:8}}>
        {icon && <span style={{fontSize:18}}>{icon}</span>}
        <div>
          <div style={{fontWeight:600,fontSize:14}}>{title}</div>
          {badge && <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>{badge}</div>}
        </div>
      </div>
      {children}
    </div>
  )
}

export function Source({ label, href }) {
  return (
    <div style={{marginTop:10,fontSize:11,color:'var(--text3)'}}>
      Fuente: <a href={href} target="_blank" rel="noreferrer" style={{color:'var(--text3)'}}>{label}</a>
    </div>
  )
}

export function Grid({ cols = 3, gap = 10, children }) {
  return (
    <div style={{display:'grid',gridTemplateColumns:`repeat(${cols},1fr)`,gap,marginBottom:'1.25rem'}}>
      {children}
    </div>
  )
}

export function ChartTooltip({ active, payload, label, fmtVal }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'10px 14px',fontSize:12,boxShadow:'var(--shadow)'}}>
      {label && <div style={{color:'var(--text2)',marginBottom:6,fontWeight:600}}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{color:p.color||p.fill||'var(--amber)',marginBottom:2}}>
          {p.name}: <b>{fmtVal ? fmtVal(p.value) : p.value?.toLocaleString('es-ES')}</b>
        </div>
      ))}
    </div>
  )
}

export function InfoBadge({ children }) {
  return (
    <div style={{background:'var(--warn-bg)',border:'1px solid #F0D080',borderRadius:'var(--radius-sm)',padding:'8px 12px',fontSize:12,color:'var(--warn)',marginBottom:12}}>
      ℹ {children}
    </div>
  )
}
