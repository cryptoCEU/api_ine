/**
 * Cliente API JSON del INE
 * Documentación oficial: https://www.ine.es/dyngs/DAB/index.htm?cid=1099
 *
 * Base URL: https://servicios.ine.es/wstempus/js/ES/{función}/{input}[?params]
 *
 * Funciones principales:
 *   DATOS_TABLA/{id}   → datos de una tabla completa
 *   SERIES_TABLA/{id}  → series (con metadatos) de una tabla
 *   DATOS_SERIE/{cod}  → datos de una serie específica
 *
 * Parámetros clave:
 *   nult=N     → últimos N periodos
 *   tip=AM     → modo amigable + metadatos
 *   det=2      → máximo detalle
 *   tv=VAR:VAL → filtro por variable NUMÉRICA — formato: {FK_Variable}:{Codigo}
 *                ⚠️  Los códigos tv= son NUMÉRICOS, NO alfanuméricos (CMUN, CPRO no funcionan)
 *                    Verificar siempre con SERIES_TABLA/{id}?tip=M antes de usar en cada tabla
 *   date=AAAAMMDD:AAAAMMDD → rango de fechas
 *
 * LECCIONES APRENDIDAS inspeccionando las series reales:
 *   - Tabla 9949 (ECV): nivel máximo CCAA. NO tiene municipios ni provincias.
 *     Variable territorial: FK_Variable=70, códigos "01"-"19" (ver CCAA_CODIGOS)
 *     Variable tipo renta:  FK_Variable=482, código "19"=neta, "20"=con alquiler imputado
 *     Ejemplo correcto: tv=70:13&tv=482:19 → renta neta de Madrid CCAA
 *   - Para renta a nivel municipal usar tabla 31097 (Atlas de Renta de los Hogares)
 *   - Las tablas con "pendienteVerificar: true" necesitan SERIES_TABLA/{id}?tip=M
 *     antes de usar filtros tv= para conocer sus FK_Variable exactos
 */

const INE_BASE = "https://servicios.ine.es/wstempus/js/ES";

// ─── TABLAS MAPEADAS ─────────────────────────────────────────────────────────
export const TABLAS = {

  // 2.1.2 ─ Renta por CCAA (ECV)
  // ✅ Variables verificadas con SERIES_TABLA/9949?tip=M
  // ⚠️  Nivel máximo: CCAA. Sin desglose municipal ni provincial.
  renta_ccaa: {
    id: "9949",
    desc: "Renta neta media por hogar — por CCAA",
    nivel: "ccaa",
    fuente: "INE · Encuesta de Condiciones de Vida (ECV)",
    vars: {
      territorio: 70,   // FK_Variable=70 → "00"=España, "01"=Andalucía... (ver CCAA_CODIGOS)
      tipoRenta: 482,   // FK_Variable=482 → "19"=renta neta, "20"=con alquiler imputado
    },
    notas: "Usado para clasificación clase alta/media/baja según % de mediana nacional",
  },

  // 2.3.3 ─ Renta por municipio (Atlas de Renta)
  // ⚠️  Variables pendientes de verificar con SERIES_TABLA/31097?tip=M
  renta_municipios: {
    id: "31097",
    desc: "Renta media por hogar — municipios",
    nivel: "municipio",
    fuente: "INE · Atlas de Distribución de Renta de los Hogares",
    vars: { pendienteVerificar: true },
  },

  // 2.2.1 ─ Evolución población (Padrón)
  // ⚠️  Variables pendientes de verificar con SERIES_TABLA/2852?tip=M
  poblacion_municipios: {
    id: "2852",
    desc: "Población total — Padrón Municipal",
    nivel: "municipio",
    fuente: "INE · Padrón Municipal de Habitantes",
    vars: { pendienteVerificar: true },
  },

  // 2.2.2 ─ Dinámicas demográficas
  // ⚠️  Variables pendientes de verificar
  variacion_residencial: {
    id: "2881",
    desc: "Variaciones residenciales — cambio en población por municipio",
    nivel: "municipio",
    fuente: "INE · Estadística de Variaciones Residenciales",
    vars: { pendienteVerificar: true },
  },
  poblacion_nacionalidad: {
    id: "36859",
    desc: "Población por municipio y nacionalidad",
    nivel: "municipio",
    fuente: "INE · Padrón",
    vars: { pendienteVerificar: true },
  },
  inmigracion: {
    id: "69743",
    desc: "Inmigración exterior",
    nivel: "provincia",
    fuente: "INE · Estadística de Migraciones",
    vars: { pendienteVerificar: true },
  },
  emigracion: {
    id: "69746",
    desc: "Emigración exterior",
    nivel: "provincia",
    fuente: "INE · Estadística de Migraciones",
    vars: { pendienteVerificar: true },
  },

  // 2.3.1 ─ Actividad económica
  // ⚠️  Variables pendientes de verificar
  empresas_actividad: {
    id: "4721",
    desc: "Empresas por actividad principal (CNAE)",
    nivel: "provincia",
    fuente: "INE · DIRCE (Directorio Central de Empresas)",
    vars: { pendienteVerificar: true },
  },

  // 2.3.2 ─ Mercado laboral
  // ⚠️  Variables pendientes de verificar
  salario_medio: {
    id: "13930",
    desc: "Salario medio anual por provincia y sexo",
    nivel: "provincia",
    fuente: "INE · Encuesta de Estructura Salarial",
    vars: { pendienteVerificar: true },
  },

  // 2.3.3 ─ Gasto
  // ⚠️  Variables pendientes de verificar
  gasto_medio_hogar: {
    id: "10734",
    desc: "Gasto total medio por hogar",
    nivel: "nacional",
    fuente: "INE · Encuesta de Presupuestos Familiares",
    vars: { pendienteVerificar: true },
  },
};

// ─── CÓDIGOS CCAA ─────────────────────────────────────────────────────────────
// ✅ Verificados con SERIES_TABLA/9949?tip=M → FK_Variable=70
// Uso: tv=70:{codCCAA}  → ej. tv=70:13 para Comunidad de Madrid
export const CCAA_CODIGOS = {
  espana:           "00",
  andalucia:        "01",
  aragon:           "02",
  asturias:         "03",
  baleares:         "04",
  canarias:         "05",
  cantabria:        "06",
  castilla_leon:    "07",
  castilla_mancha:  "08",
  cataluna:         "09",
  valencia:         "10",
  extremadura:      "11",
  galicia:          "12",
  madrid:           "13",
  murcia:           "14",
  navarra:          "15",
  pais_vasco:       "16",
  rioja:            "17",
  ceuta:            "18",
  melilla:          "19",
};

// ─── CÓDIGOS PROVINCIA ────────────────────────────────────────────────────────
// Código INE de 2 dígitos — pendiente confirmar FK_Variable por tabla
// Referencia: https://www.ine.es/daco/daco42/codmun/cod_ccaa_provincia.htm
export const PROVINCIA_CODIGOS = {
  alicante:    "03",
  almeria:     "04",
  avila:       "05",
  badajoz:     "06",
  barcelona:   "08",
  burgos:      "09",
  caceres:     "10",
  cadiz:       "11",
  castellon:   "12",
  ciudad_real: "13",
  cordoba:     "14",
  girona:      "17",
  granada:     "18",
  guadalajara: "19",
  huelva:      "21",
  huesca:      "22",
  jaen:        "23",
  leon:        "24",
  lleida:      "25",
  logrono:     "26",
  lugo:        "27",
  madrid:      "28",
  malaga:      "29",
  murcia:      "30",
  navarra:     "31",
  ourense:     "32",
  palencia:    "34",
  pontevedra:  "36",
  salamanca:   "37",
  segovia:     "40",
  sevilla:     "41",
  soria:       "42",
  tarragona:   "43",
  teruel:      "44",
  toledo:      "45",
  valencia:    "46",
  valladolid:  "47",
  zamora:      "49",
  zaragoza:    "50",
};

// ─── CLIENTE BASE ─────────────────────────────────────────────────────────────

/**
 * Fetch genérico a la API del INE con gestión de errores y timeout
 */
async function ineRequest(endpoint, params = {}) {
  const url = new URL(`${INE_BASE}/${endpoint}`);

  const defaults = { tip: "AM" };
  const allParams = { ...defaults, ...params };

  // tv puede ser array → múltiples &tv= en la query string
  const tvValues = allParams.tv;
  delete allParams.tv;

  Object.entries(allParams).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  });

  if (tvValues) {
    const tvArray = Array.isArray(tvValues) ? tvValues : [tvValues];
    tvArray.forEach((tv) => url.searchParams.append("tv", tv));
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      throw new Error(`INE API error: ${res.status} ${res.statusText} — ${url}`);
    }

    const data = await res.json();
    return { ok: true, data, url: url.toString() };
  } catch (err) {
    if (err.name === "AbortError") {
      return { ok: false, error: "Timeout (15s)", url: url.toString() };
    }
    return { ok: false, error: err.message, url: url.toString() };
  } finally {
    clearTimeout(timeout);
  }
}

// ─── FUNCIONES DE ALTO NIVEL ──────────────────────────────────────────────────

/**
 * Obtiene los últimos N periodos de una tabla
 * @param {string} tablaKey           - clave en TABLAS (ej. "renta_ccaa")
 * @param {object} opciones
 * @param {number} opciones.nult      - últimos N periodos (default: 5)
 * @param {number} opciones.det       - nivel detalle 0|1|2 (default: 2)
 * @param {string|string[]} opciones.tv - filtros tv numéricos (ej. ["70:13","482:19"])
 */
export async function getDatosTabla(tablaKey, opciones = {}) {
  const tabla = TABLAS[tablaKey];
  if (!tabla) throw new Error(`Tabla desconocida: ${tablaKey}`);

  const { nult = 5, det = 2, tv } = opciones;
  return ineRequest(`DATOS_TABLA/${tabla.id}`, { nult, det, tv });
}

/**
 * Obtiene los metadatos/series de una tabla
 * Úsalo para descubrir los FK_Variable y Codigo exactos antes de filtrar con tv=
 * Ejemplo: getSeriesTabla("renta_ccaa") → revela que territorial es FK_Variable=70
 */
export async function getSeriesTabla(tablaKey) {
  const tabla = TABLAS[tablaKey];
  if (!tabla) throw new Error(`Tabla desconocida: ${tablaKey}`);

  return ineRequest(`SERIES_TABLA/${tabla.id}`, { tip: "M" });
}

/**
 * Inspecciona una tabla por su ID directamente (sin necesidad de que esté en TABLAS)
 * Útil para explorar tablas nuevas antes de añadirlas al mapa
 * @param {string} tablaId - ej. "31097"
 */
export async function inspeccionarTabla(tablaId) {
  return ineRequest(`SERIES_TABLA/${tablaId}`, { tip: "M" });
}

/**
 * Obtiene datos de una serie específica por su código Tempus3
 * @param {string} codigoSerie - ej. "ECV4249"
 */
export async function getDatosSerie(codigoSerie, opciones = {}) {
  const { nult = 5, date } = opciones;
  return ineRequest(`DATOS_SERIE/${codigoSerie}`, { nult, date });
}

// ─── HELPERS DE NEGOCIO ───────────────────────────────────────────────────────

/**
 * Extrae el valor más reciente de un resultado de DATOS_TABLA
 * Devuelve array de { nombre, valor, fecha, unidad, cod }
 */
export function extraerUltimosValores(datosRaw) {
  if (!Array.isArray(datosRaw)) return [];

  return datosRaw
    .map((serie) => {
      const datos = serie.Data || [];
      const ultimo = datos[datos.length - 1] || {};
      return {
        nombre: serie.Nombre || serie.COD,
        valor: ultimo.Valor,
        fecha: ultimo.Anyo ? `${ultimo.Anyo}` : ultimo.T3_Periodo || "—",
        unidad: serie.Unidad?.Nombre || "",
        cod: serie.COD,
      };
    })
    .filter((s) => s.valor !== null && s.valor !== undefined);
}

/**
 * Clasifica renta según % de la mediana nacional
 * Criterio del informe: <75% = baja, 75%-200% = media, >200% = alta
 *
 * @param {number} renta           - renta anual del territorio (€/hogar o €/persona)
 * @param {number} medianaNacional - mediana nacional en la misma unidad
 */
export function clasificarClaseSocial(renta, medianaNacional) {
  const ratio = renta / medianaNacional;
  let clase, descripcion;

  if (ratio < 0.75) {
    clase = "baja";
    descripcion = `Renta inferior al 75% de la mediana nacional (${(ratio * 100).toFixed(1)}%)`;
  } else if (ratio <= 2.0) {
    clase = "media";
    descripcion = `Renta entre el 75% y el 200% de la mediana nacional (${(ratio * 100).toFixed(1)}%)`;
  } else {
    clase = "alta";
    descripcion = `Renta superior al 200% de la mediana nacional (${(ratio * 100).toFixed(1)}%)`;
  }

  return { clase, ratio: parseFloat(ratio.toFixed(3)), descripcion };
}

/**
 * Calcula CAGR (tasa de crecimiento anual compuesto)
 */
export function calcularCAGR(valorInicial, valorFinal, años) {
  if (!valorInicial || años <= 0) return null;
  const cagr = (Math.pow(valorFinal / valorInicial, 1 / años) - 1) * 100;
  return parseFloat(cagr.toFixed(2));
}

/**
 * Calcula la máxima cuota hipotecaria asumible y precio de vivienda
 * Criterio del informe: 30% renta anual mensualizado, a 30 años, Euribor ± 0.5%
 *
 * @param {number} rentaAnualHogar - en euros
 * @param {number} euribor1a       - tipo Euribor a 1 año en decimal (ej. 0.035 para 3.5%)
 * @param {number} spreadBanco     - diferencial en decimal (default: 0.01 = 1%)
 */
export function calcularCapacidadHipotecaria(rentaAnualHogar, euribor1a, spreadBanco = 0.01) {
  const cuotaMaxMensual = (rentaAnualHogar * 0.30) / 12;

  const calcularPrecio = (tipo) => {
    const tipoMensual = tipo / 12;
    const n = 30 * 12; // 360 cuotas
    const precio = cuotaMaxMensual * ((1 - Math.pow(1 + tipoMensual, -n)) / tipoMensual);
    return Math.round(precio);
  };

  const tipoBase = euribor1a + spreadBanco;

  return {
    cuotaMaxMensual:       Math.round(cuotaMaxMensual),
    tipoBase:              (tipoBase * 100).toFixed(2) + "%",
    precioAsumibleBase:    calcularPrecio(tipoBase),
    precioAsumibleMinus05: calcularPrecio(Math.max(tipoBase - 0.005, 0.001)),
    precioAsumiblePlus05:  calcularPrecio(tipoBase + 0.005),
  };
}

// ─── FETCHER COMPLETO PARA SECCIÓN 2 ─────────────────────────────────────────

/**
 * Obtiene todos los datos de la sección 2 para un territorio dado
 *
 * @param {object} territorio
 * @param {string} territorio.municipioCod - código INE municipio (5 dígitos, ej. "03082")
 * @param {string} territorio.provinciaCod - código INE provincia (2 dígitos, ej. "03")
 * @param {string} territorio.ccaaCod      - código CCAA según CCAA_CODIGOS (ej. "10" para Valencia)
 * @param {string} territorio.nombre       - nombre legible (ej. "La Nucía")
 * @param {number} [periodos=10]           - años de histórico para evolución población
 */
export async function fetchSeccion2(territorio, periodos = 10) {
  const { municipioCod, provinciaCod, ccaaCod, nombre } = territorio;

  console.log(`[INE] Fetching sección 2 para: ${nombre}`);
  console.log(`[INE] municipio=${municipioCod} | provincia=${provinciaCod} | ccaa=${ccaaCod}`);

  const [
    rentaCCAA,
    rentaMunicipio,
    poblacionMunicipio,
    variacionResidencial,
    nacionalidad,
    inmigracion,
    emigracion,
    empresasActividad,
    salarioMedio,
    gastoHogar,
  ] = await Promise.allSettled([

    // 2.1.2 Renta media por hogar — nivel CCAA
    // ✅ Filtros verificados: tv=70:{ccaaCod} + tv=482:19 (renta neta sin alquiler imputado)
    getDatosTabla("renta_ccaa", {
      nult: 5,
      tv: ccaaCod
        ? [`70:${ccaaCod}`, "482:19"]
        : ["70:00", "482:19"], // fallback: nacional
    }),

    // 2.3.3 Renta media por hogar — nivel municipio (Atlas de Renta)
    // ⚠️  Filtros tv= pendientes de verificar con SERIES_TABLA/31097?tip=M
    //     Se lanza sin filtro para inspeccionar la estructura de respuesta
    getDatosTabla("renta_municipios", { nult: 3 }),

    // 2.2.1 Evolución población — municipio
    // ⚠️  Filtros tv= pendientes de verificar con SERIES_TABLA/2852?tip=M
    getDatosTabla("poblacion_municipios", { nult: periodos }),

    // 2.2.2 Variación residencial
    // ⚠️  Filtros tv= pendientes de verificar con SERIES_TABLA/2881?tip=M
    getDatosTabla("variacion_residencial", { nult: 5 }),

    // 2.2.2 Nacionalidad
    // ⚠️  Filtros tv= pendientes de verificar con SERIES_TABLA/36859?tip=M
    getDatosTabla("poblacion_nacionalidad", { nult: 3 }),

    // 2.2.2 Inmigración
    // ⚠️  Filtros tv= pendientes de verificar con SERIES_TABLA/69743?tip=M
    getDatosTabla("inmigracion", { nult: 5 }),

    // 2.2.2 Emigración
    // ⚠️  Filtros tv= pendientes de verificar con SERIES_TABLA/69746?tip=M
    getDatosTabla("emigracion", { nult: 5 }),

    // 2.3.1 Empresas por actividad
    // ⚠️  Filtros tv= pendientes de verificar con SERIES_TABLA/4721?tip=M
    getDatosTabla("empresas_actividad", { nult: 3 }),

    // 2.3.2 Salario medio
    // ⚠️  Filtros tv= pendientes de verificar con SERIES_TABLA/13930?tip=M
    getDatosTabla("salario_medio", { nult: 3 }),

    // 2.3.3 Gasto medio por hogar (solo nivel nacional)
    getDatosTabla("gasto_medio_hogar", { nult: 3 }),
  ]);

  const normalizar = (result, etiqueta) => {
    if (result.status === "fulfilled") return result.value;
    console.warn(`[INE] Error en ${etiqueta}:`, result.reason);
    return { ok: false, error: result.reason?.message || "Error desconocido" };
  };

  return {
    territorio: { municipioCod, provinciaCod, ccaaCod, nombre },
    timestamp: new Date().toISOString(),
    secciones: {
      "2.1.2_renta_ccaa":            normalizar(rentaCCAA,            "renta_ccaa"),
      "2.3.3_renta_municipio":       normalizar(rentaMunicipio,       "renta_municipio"),
      "2.2.1_evolucion_poblacion":   normalizar(poblacionMunicipio,   "poblacion_municipio"),
      "2.2.2_variacion_residencial": normalizar(variacionResidencial, "variacion_residencial"),
      "2.2.2_nacionalidad":          normalizar(nacionalidad,         "nacionalidad"),
      "2.2.2_inmigracion":           normalizar(inmigracion,          "inmigracion"),
      "2.2.2_emigracion":            normalizar(emigracion,           "emigracion"),
      "2.3.1_empresas_actividad":    normalizar(empresasActividad,    "empresas_actividad"),
      "2.3.2_salario_medio":         normalizar(salarioMedio,         "salario_medio"),
      "2.3.3_gasto_hogar":           normalizar(gastoHogar,           "gasto_hogar"),
    },
  };
}
