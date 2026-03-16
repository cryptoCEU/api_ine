# INE Dashboard — Análisis Demográfico y Socioeconómico

App React que consume la **API JSON del INE** en tiempo real para generar análisis demográfico y socioeconómico de cualquier municipio de España.

## Secciones

| # | Sección | Fuente INE |
|---|---------|-----------|
| 2.1.1 | Pirámide de población | t=56934 |
| 2.1.2 | Perfil socioeconómico y clases | t=9949 |
| 2.2.1 | Evolución poblacional + CAGR | t=2879 |
| 2.2.2 | Dinámicas migratorias | t=2881, t=36859, t=69743, t=69746 |
| 2.3.1 | Empresas por actividad (DIRCE) | t=4721 |
| 2.3.2 | Salario medio | t=13930 |
| 2.4   | Cuota hipotecaria y precio asumible | t=9949 + cálculo BDE |

## Stack

- **React 18** + **Vite 5**
- **Recharts** para visualizaciones
- **API INE** (`servicios.ine.es/wstempus/js/ES`)
- Desplegado en **Vercel** (estático, sin backend)

## Desarrollo local

```bash
npm install
npm run dev
```

## Despliegue en Vercel

```bash
# 1. Subir a GitHub
git init
git add .
git commit -m "init: INE dashboard"
git remote add origin https://github.com/TU_USUARIO/ine-dashboard.git
git push -u origin main

# 2. En vercel.com → New Project → Import de GitHub
# Framework: Vite (detectado automático)
# Build command: npm run build
# Output dir: dist
```

## Actualizar Euríbor

Edita `src/utils.js`:
```js
export const EURIBOR = 3.2  // % actualizar con BDE
```

## Nota sobre la API del INE

La API es pública y gratuita. Algunos municipios pequeños pueden no tener todos los indicadores disponibles — la app muestra estimaciones en esos casos con aviso visual.

Documentación API: https://www.ine.es/dyngs/DataLab/es/manual.htm?cid=1259945948443
