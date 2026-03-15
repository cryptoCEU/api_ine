/**
 * POST /api/seccion2
 *
 * Body: {
 *   municipio: "Madrid",
 *   municipioCod: "28079",   // código INE 5 dígitos
 *   provinciaCod: "28",      // código INE 2 dígitos
 *   euribor: 0.035           // opcional — si no se pasa, se busca en BDE
 * }
 *
 * Respuesta: {
 *   ok: true,
 *   informe: { secciones: [...] },
 *   datos_crudos: { ... }   // datos INE originales para debug/exportación
 * }
 */

import {
  fetchSeccion2,
  extraerUltimosValores,
  clasificarClaseSocial,
  calcularCAGR,
  calcularCapacidadHipotecaria,
  TABLAS,
} from "../ine.js";

// Mediana nacional de renta bruta por persona — actualizar anualmente con INE tabla 9949
// Fuente: https://www.ine.es/jaxiT3/Tabla.htm?t=9949
const MEDIANA_NACIONAL_RENTA = 14500; // euros/año (dato 2022 — revisar cada año)

export async function POST(req) {
  try {
    const body = await req.json();
    const { municipio, municipioCod, provinciaCod, euribor } = body;

    if (!municipio || !municipioCod || !provinciaCod) {
      return Response.json(
        { ok: false, error: "Faltan campos: municipio, municipioCod, provinciaCod" },
        { status: 400 }
      );
    }

    // ── 1. FETCH DATOS INE ─────────────────────────────────────────────────
    console.log(`[seccion2] Iniciando fetch INE para ${municipio}...`);

    const datosINE = await fetchSeccion2(
      { municipioCod, provinciaCod, nombre: municipio },
      10 // 10 años de histórico
    );

    // ── 2. CÁLCULOS PROPIOS ────────────────────────────────────────────────

    // 2.3.4 — Capacidad hipotecaria
    // Extraer renta media por hogar del INE
    let rentaHogarValor = null;
    if (datosINE.secciones["2.3.3_renta_hogar"]?.ok) {
      const valores = extraerUltimosValores(datosINE.secciones["2.3.3_renta_hogar"].data || []);
      rentaHogarValor = valores[0]?.valor || null;
    }

    const euriborTipo = euribor || 0.035; // fallback si no se pasa
    const capacidadHipotecaria = rentaHogarValor
      ? calcularCapacidadHipotecaria(rentaHogarValor, euriborTipo)
      : null;

    // 2.1.2 — Clasificación clase social
    let claseSocial = null;
    if (datosINE.secciones["2.1.2_renta_media"]?.ok) {
      const valores = extraerUltimosValores(datosINE.secciones["2.1.2_renta_media"].data || []);
      const rentaPersona = valores[0]?.valor;
      if (rentaPersona) {
        claseSocial = clasificarClaseSocial(rentaPersona, MEDIANA_NACIONAL_RENTA);
      }
    }

    // 2.2.1 — CAGR población
    let cagrPoblacion = null;
    if (datosINE.secciones["2.2.1_evolucion_poblacion"]?.ok) {
      const valores = extraerUltimosValores(datosINE.secciones["2.2.1_evolucion_poblacion"].data || []);
      if (valores.length >= 2) {
        const inicio = valores[0]?.valor;
        const fin = valores[valores.length - 1]?.valor;
        cagrPoblacion = calcularCAGR(inicio, fin, valores.length - 1);
      }
    }

    // ── 3. CONTEXTO PARA CLAUDE ───────────────────────────────────────────
    // Serializar los datos relevantes en texto estructurado para el system prompt

    const contextoINE = construirContextoINE(datosINE, claseSocial, cagrPoblacion, capacidadHipotecaria);

    // ── 4. SÍNTESIS CON CLAUDE ────────────────────────────────────────────
    const secciones_redactadas = await sintetizarConClaude(municipio, contextoINE);

    return Response.json({
      ok: true,
      municipio,
      calculos: { claseSocial, cagrPoblacion, capacidadHipotecaria, euriborUsado: euriborTipo },
      informe: secciones_redactadas,
      datos_crudos: datosINE, // útil para debug y exportación Excel
    });
  } catch (err) {
    console.error("[seccion2] Error:", err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// ── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Serializa los datos del INE en texto estructurado para inyectar en Claude
 */
function construirContextoINE(datosINE, claseSocial, cagrPoblacion, capacidadHipotecaria) {
  const lineas = ["=== DATOS INE EXTRAÍDOS ===\n"];

  const secciones = datosINE.secciones;

  const agregar = (clave, etiqueta) => {
    const s = secciones[clave];
    if (!s?.ok || !s.data) {
      lineas.push(`[${etiqueta}]: No disponible\n`);
      return;
    }
    const valores = extraerUltimosValores(s.data);
    if (!valores.length) {
      lineas.push(`[${etiqueta}]: Sin datos\n`);
      return;
    }
    lineas.push(`[${etiqueta}]:`);
    valores.slice(0, 8).forEach((v) => {
      lineas.push(`  ${v.nombre}: ${v.valor?.toLocaleString("es-ES")} ${v.unidad} (${v.fecha})`);
    });
    lineas.push("");
  };

  agregar("2.1.2_renta_media",           "Renta media por persona");
  agregar("2.2.1_evolucion_poblacion",   "Evolución de población (10 años)");
  agregar("2.2.2_variacion_residencial", "Variaciones residenciales");
  agregar("2.2.2_nacionalidad",          "Población por nacionalidad");
  agregar("2.2.2_inmigracion",           "Inmigración exterior");
  agregar("2.2.2_emigracion",            "Emigración exterior");
  agregar("2.3.1_empresas_actividad",    "Empresas por actividad CNAE");
  agregar("2.3.2_salario_medio",         "Salario medio");
  agregar("2.3.3_renta_hogar",           "Renta media por hogar");
  agregar("2.3.3_gasto_hogar",           "Gasto medio por hogar");

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
    lineas.push(`  Precio asumible (base):  ${c.precioAsumibleBase.toLocaleString("es-ES")} €`);
    lineas.push(`  Precio asumible (-0.5%): ${c.precioAsumibleMinus5.toLocaleString("es-ES")} €`);
    lineas.push(`  Precio asumible (+0.5%): ${c.precioAsumiblePlus5.toLocaleString("es-ES")} €`);
    lineas.push("");
  }

  return lineas.join("\n");
}

/**
 * Llama a Claude para sintetizar los datos INE en texto de informe
 */
async function sintetizarConClaude(municipio, contextoINE) {
  const SUBSECCIONES = [
    {
      id: "2.1.1",
      titulo: "Estructura por edades y sexo",
      instruccion: "Describe la estructura demográfica por edades y sexo. Incluye pirámide de población y grupos de edad principales. Si los datos de pirámide no están disponibles vía API, indícalo y describe el perfil demográfico general.",
    },
    {
      id: "2.1.2",
      titulo: "Perfil socioeconómico",
      instruccion: "Analiza la renta media por persona. Clasifica la población según los datos en clase alta (>200% mediana nacional), clase media (75-200%) y clase baja (<75%). Incluye los valores absolutos y la distribución estimada.",
    },
    {
      id: "2.2.1",
      titulo: "Evolución de la población",
      instruccion: "Describe la evolución de la población en los últimos 10 años. Incluye el CAGR calculado, los valores inicio/fin, y la tendencia principal. Compara con la media nacional si los datos lo permiten.",
    },
    {
      id: "2.2.2",
      titulo: "Dinámicas demográficas y migraciones",
      instruccion: "Analiza los movimientos migratorios (inmigración y emigración exterior) y variaciones residenciales. Describe la composición por nacionalidades y el saldo migratorio.",
    },
    {
      id: "2.3.1",
      titulo: "Distribución por actividad económica",
      instruccion: "Describe la estructura empresarial por sectores CNAE. Identifica los sectores dominantes y emergentes. Relaciona con el perfil económico del territorio.",
    },
    {
      id: "2.3.2",
      titulo: "Mercado laboral",
      instruccion: "Analiza el salario medio, comparándolo con la media nacional. Describe el mercado laboral en términos de actividad económica dominante.",
    },
    {
      id: "2.3.3",
      titulo: "Renta media y capacidad adquisitiva",
      instruccion: "Presenta la renta media por hogar y el gasto medio por hogar. Calcula el índice renta/gasto como indicador de capacidad de ahorro.",
    },
    {
      id: "2.3.4",
      titulo: "Máxima cuota hipotecaria y precio de vivienda asumible",
      instruccion: "Con los datos de renta calculados (30% renta anual mensualizado), describe la cuota hipotecaria máxima asumible y el precio de vivienda resultante a 30 años. Presenta el rango con ±0.5% sobre el Euribor usado.",
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
- Si un dato no está disponible, indícalo explícitamente como "dato no disponible vía API".
- Cita las fuentes INE cuando uses datos específicos.
- Formato: Markdown limpio. Máximo 300 palabras por subsección.
- Tono: profesional, analítico, directo.
- Usa siempre el formato español para números (puntos como separadores de miles, comas para decimales).`,
        messages: [
          {
            role: "user",
            content: `Municipio analizado: **${municipio}**

${contextoINE}

---
Redacta la subsección **${subseccion.id} ${subseccion.titulo}**

Instrucción específica: ${subseccion.instruccion}`,
          },
        ],
      }),
    });

    const data = await res.json();
    const texto = data.content
      ?.filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n") || "[Error generando sección]";

    resultados.push({
      id: subseccion.id,
      titulo: subseccion.titulo,
      contenido: texto,
    });
  }

  return resultados;
}
