/**
 * POST /api/seccion2
 *
 * Body: {
 *   municipio:    "La Nucía",
 *   municipioCod: "03082",    // código INE municipio 5 dígitos
 *   provinciaCod: "03",       // código INE provincia 2 dígitos
 *   ccaaCod:      "10",       // código CCAA según CCAA_CODIGOS (ej. "10" = C. Valenciana)
 *   euribor:      0.025       // opcional — Euribor a 1 año en decimal
 * }
 *
 * Respuesta: {
 *   ok: true,
 *   municipio,
 *   calculos: { claseSocial, cagrPoblacion, capacidadHipotecaria, euriborUsado },
 *   informe: [ { id, titulo, contenido } ],
 *   datos_crudos: { ... }   // datos INE originales para debug / exportación
 * }
 */

import {
  fetchSeccion2,
  extraerUltimosValores,
  clasificarClaseSocial,
  calcularCAGR,
  calcularCapacidadHipotecaria,
} from "../ine.js";

// Mediana nacional de renta neta por hogar — actualizar anualmente con INE tabla 9949
// Fuente: https://www.ine.es/jaxiT3/Tabla.htm?t=9949
// Último dato disponible (2022): ~30.700 €/hogar/año (aprox.)
const MEDIANA_NACIONAL_RENTA_HOGAR = 30700;

export async function POST(req) {
  try {
    const body = await req.json();
    const { municipio, municipioCod, provinciaCod, ccaaCod, euribor } = body;

    if (!municipio || !municipioCod || !provinciaCod || !ccaaCod) {
      return Response.json(
        { ok: false, error: "Faltan campos: municipio, municipioCod, provinciaCod, ccaaCod" },
        { status: 400 }
      );
    }

    // ── 1. FETCH DATOS INE ─────────────────────────────────────────────────
    console.log(`[seccion2] Iniciando fetch INE para ${municipio}...`);

    const datosINE = await fetchSeccion2(
      { municipioCod, provinciaCod, ccaaCod, nombre: municipio },
      10
    );

    // ── 2. CÁLCULOS PROPIOS ────────────────────────────────────────────────

    // 2.1.2 — Clasificación clase social (usando renta CCAA como proxy)
    let claseSocial = null;
    if (datosINE.secciones["2.1.2_renta_ccaa"]?.ok) {
      const valores = extraerUltimosValores(datosINE.secciones["2.1.2_renta_ccaa"].data || []);
      const rentaHogar = valores[0]?.valor;
      if (rentaHogar) {
        claseSocial = clasificarClaseSocial(rentaHogar, MEDIANA_NACIONAL_RENTA_HOGAR);
      }
    }

    // 2.2.1 — CAGR población
    let cagrPoblacion = null;
    if (datosINE.secciones["2.2.1_evolucion_poblacion"]?.ok) {
      const valores = extraerUltimosValores(datosINE.secciones["2.2.1_evolucion_poblacion"].data || []);
      if (valores.length >= 2) {
        cagrPoblacion = calcularCAGR(valores[0]?.valor, valores[valores.length - 1]?.valor, valores.length - 1);
      }
    }

    // 2.3.4 — Capacidad hipotecaria (usando renta municipio si disponible, si no CCAA)
    let rentaHogarCalculo = null;
    if (datosINE.secciones["2.3.3_renta_municipio"]?.ok) {
      const valores = extraerUltimosValores(datosINE.secciones["2.3.3_renta_municipio"].data || []);
      rentaHogarCalculo = valores[0]?.valor || null;
    }
    if (!rentaHogarCalculo && datosINE.secciones["2.1.2_renta_ccaa"]?.ok) {
      const valores = extraerUltimosValores(datosINE.secciones["2.1.2_renta_ccaa"].data || []);
      rentaHogarCalculo = valores[0]?.valor || null;
    }

    const euriborTipo = euribor || 0.025;
    const capacidadHipotecaria = rentaHogarCalculo
      ? calcularCapacidadHipotecaria(rentaHogarCalculo, euriborTipo)
      : null;

    // ── 3. SÍNTESIS CON CLAUDE ────────────────────────────────────────────
    const contextoINE = construirContextoINE(datosINE, claseSocial, cagrPoblacion, capacidadHipotecaria);
    const secciones_redactadas = await sintetizarConClaude(municipio, contextoINE);

    return Response.json({
      ok: true,
      municipio,
      calculos: { claseSocial, cagrPoblacion, capacidadHipotecaria, euriborUsado: euriborTipo },
      informe: secciones_redactadas,
      datos_crudos: datosINE,
    });

  } catch (err) {
    console.error("[seccion2] Error:", err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// ── HELPERS ──────────────────────────────────────────────────────────────────

function construirContextoINE(datosINE, claseSocial, cagrPoblacion, capacidadHipotecaria) {
  const lineas = ["=== DATOS INE EXTRAÍDOS ===\n"];
  const s = datosINE.secciones;

  const agregar = (clave, etiqueta) => {
    const sec = s[clave];
    if (!sec?.ok || !sec.data) {
      lineas.push(`[${etiqueta}]: No disponible\n`);
      return;
    }
    const valores = extraerUltimosValores(sec.data);
    if (!valores.length) {
      lineas.push(`[${etiqueta}]: Sin datos en la respuesta\n`);
      return;
    }
    lineas.push(`[${etiqueta}]:`);
    valores.slice(0, 8).forEach((v) => {
      lineas.push(`  ${v.nombre}: ${v.valor?.toLocaleString("es-ES")} ${v.unidad} (${v.fecha})`);
    });
    lineas.push("");
  };

  agregar("2.1.2_renta_ccaa",            "Renta neta media por hogar — CCAA");
  agregar("2.3.3_renta_municipio",        "Renta media por hogar — municipio");
  agregar("2.2.1_evolucion_poblacion",    "Evolución de población (10 años)");
  agregar("2.2.2_variacion_residencial",  "Variaciones residenciales");
  agregar("2.2.2_nacionalidad",           "Población por nacionalidad");
  agregar("2.2.2_inmigracion",            "Inmigración exterior");
  agregar("2.2.2_emigracion",             "Emigración exterior");
  agregar("2.3.1_empresas_actividad",     "Empresas por actividad CNAE");
  agregar("2.3.2_salario_medio",          "Salario medio");
  agregar("2.3.3_gasto_hogar",            "Gasto medio por hogar");

  if (claseSocial) {
    lineas.push(`[Clasificación clase social]: ${claseSocial.clase.toUpperCase()} — ${claseSocial.descripcion}\n`);
  }
  if (cagrPoblacion !== null) {
    lineas.push(`[CAGR Población 10 años]: ${cagrPoblacion > 0 ? "+" : ""}${cagrPoblacion}%\n`);
  }
  if (capacidadHipotecaria) {
    const c = capacidadHipotecaria;
    lineas.push(`[Capacidad hipotecaria]:`);
    lineas.push(`  Cuota máx. mensual: ${c.cuotaMaxMensual.toLocaleString("es-ES")} €`);
    lineas.push(`  Tipo aplicado: ${c.tipoBase}`);
    lineas.push(`  Precio asumible (base):     ${c.precioAsumibleBase.toLocaleString("es-ES")} €`);
    lineas.push(`  Precio asumible (-0.5%):    ${c.precioAsumibleMinus05.toLocaleString("es-ES")} €`);
    lineas.push(`  Precio asumible (+0.5%):    ${c.precioAsumiblePlus05.toLocaleString("es-ES")} €`);
    lineas.push("");
  }

  return lineas.join("\n");
}

async function sintetizarConClaude(municipio, contextoINE) {
  const SUBSECCIONES = [
    {
      id: "2.1.1",
      titulo: "Estructura por edades y sexo",
      instruccion: "Describe la estructura demográfica por edades y sexo. Si los datos de pirámide no están disponibles vía API, indícalo y describe el perfil demográfico general con los datos disponibles.",
    },
    {
      id: "2.1.2",
      titulo: "Perfil socioeconómico",
      instruccion: "Analiza la renta neta media por hogar a nivel CCAA. Clasifica la población en clase alta (>200% mediana nacional), clase media (75-200%) y clase baja (<75%). Incluye los valores absolutos y la clasificación calculada.",
    },
    {
      id: "2.2.1",
      titulo: "Evolución de la población",
      instruccion: "Describe la evolución de la población en los últimos 10 años. Incluye el CAGR calculado, los valores inicio/fin y la tendencia principal.",
    },
    {
      id: "2.2.2",
      titulo: "Dinámicas demográficas y migraciones",
      instruccion: "Analiza los movimientos migratorios (inmigración y emigración exterior) y variaciones residenciales. Describe la composición por nacionalidades y el saldo migratorio.",
    },
    {
      id: "2.3.1",
      titulo: "Distribución por actividad económica",
      instruccion: "Describe la estructura empresarial por sectores CNAE. Identifica los sectores dominantes y emergentes.",
    },
    {
      id: "2.3.2",
      titulo: "Mercado laboral",
      instruccion: "Analiza el salario medio comparándolo con la media nacional si tienes el dato. Describe el perfil del mercado laboral.",
    },
    {
      id: "2.3.3",
      titulo: "Renta media y capacidad adquisitiva",
      instruccion: "Presenta la renta media por hogar (municipio si disponible, CCAA como referencia) y el gasto medio por hogar. Calcula el índice renta/gasto como indicador de capacidad de ahorro.",
    },
    {
      id: "2.3.4",
      titulo: "Máxima cuota hipotecaria y precio de vivienda asumible",
      instruccion: "Con los datos de capacidad hipotecaria calculados (30% renta anual mensualizado, a 30 años), describe la cuota máxima asumible y el precio de vivienda resultante. Presenta el rango con ±0.5% sobre el Euribor usado.",
    },
  ];

  const resultados = [];

  for (const subseccion of SUBSECCIONES) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: `Eres un analista inmobiliario senior especializado en el mercado español.

REGLAS:
- Redacta SOLO con los datos proporcionados. No inventes cifras.
- Si un dato no está disponible, indícalo como "dato no disponible vía API".
- Cita las fuentes INE cuando uses datos específicos.
- Formato: Markdown limpio. Máximo 300 palabras por subsección.
- Tono: profesional, analítico, directo.
- Usa formato español para números (puntos como miles, comas para decimales).`,
        messages: [{
          role: "user",
          content: `Municipio analizado: **${municipio}**

${contextoINE}

---
Redacta la subsección **${subseccion.id} ${subseccion.titulo}**

Instrucción: ${subseccion.instruccion}`,
        }],
      }),
    });

    const data = await res.json();
    const texto = data.content
      ?.filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n") || "[Error generando sección]";

    resultados.push({ id: subseccion.id, titulo: subseccion.titulo, contenido: texto });
  }

  return resultados;
}
