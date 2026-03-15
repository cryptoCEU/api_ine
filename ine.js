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
 *   tv=VAR:VAL → filtro por variable (permite múltiples &tv=...)
 *   date=AAAAMMDD:AAAAMMDD → rango de fechas
 */

const INE_BASE = "https://servicios.ine.es/wstempus/js/ES";

// ─── TABLAS MAPEADAS ─────────────────────────────────────────────────────────
// Cada tabla incluye: id, descripción, periodicidad, y variables de filtro útiles
export const TABLAS = {
  // 2.1.2 ─ Renta
  renta_media_municipios: {
    id: "9949",
    desc: "Renta neta media por persona — municipios",
    periodicidad: "anual",
    fuente: "INE · Encuesta de Condiciones de Vida",
    // Variables útiles para filtrar: t=territorio, s=sexo
    notas: "Usado para clasificación clase alta/media/baja según % de mediana nacional",
  },

  // 2.2.1 ─ Evolución población
  poblacion_municipios: {
    id: "2852",
    desc: "Población total por municipios — Padrón Municipal",
    periodicidad: "anual",
    fuente: "INE · Padrón Municipal de Habitantes",
  },

  // 2.2.2 ─ Dinámicas demográficas
  variacion_residencial_municipios: {
    id: "2881",
    desc: "Variaciones residenciales — cambio en población por municipio",
    periodicidad: "anual",
    fuente: "INE · Estadística de Variaciones Residenciales",
  },
  poblacion_nacionalidad: {
    id: "36859",
    desc: "Población por municipio y nacionalidad",
    periodicidad: "anual",
    fuente: "INE · Padrón",
  },
  inmigracion: {
    id: "69743",
    desc: "Inmigración exterior por municipio",
    periodicidad: "anual",
    fuente: "INE · Estadística de Migraciones",
  },
  emigracion: {
    id: "69746",
    desc: "Emigración exterior por municipio",
    periodicidad: "anual",
    fuente: "INE · Estadística de Migraciones",
  },

  // 2.3.1 ─ Actividad económica
  empresas_actividad: {
    id: "4721",
    desc: "Empresas por actividad principal (CNAE)",
    periodicidad: "anual",
    fuente: "INE · DIRCE (Directorio Central de Empresas)",
  },

  // 2.3.2 ─ Mercado laboral
  salario_medio: {
    id: "13930",
    desc: "Salario medio anual por provincia y sexo",
    periodicidad: "anual",
    fuente: "INE · Encuesta de Estructura Salarial",
  },

  // 2.3.3 ─ Renta y gasto
  renta_media_hogar: {
    id: "31097",
    desc: "Renta media por hogar por municipio",
    periodicidad: "anual",
    fuente: "INE · Atlas de Distribución de Renta de los Hogares",
  },
  gasto_medio_hogar: {
    id: "10734",
    desc: "Gasto total medio por hogar",
    periodicidad: "anual",
    fuente: "INE · Encuesta de Presupuestos Familiares",
  },
};

// ─── CÓDIGOS TERRITORIALES ────────────────────────────────────────────────────
// Códigos INE para filtrar por territorio (tv=NAC:XX o tv=CPRO:XX)
export const TERRITORIOS = {
  espana: { cod: "00", nivel: "nacional", desc: "España total" },

  // Comunidades Autónomas (prefijo 09 en muchas tablas)
  andalucia:      { cod: "01", nivel: "ccaa" },
  aragon:         { cod: "02", nivel: "ccaa" },
  asturias:       { cod: "03", nivel: "ccaa" },
  baleares:       { cod: "04", nivel: "ccaa" },
  canarias:       { cod: "05", nivel: "ccaa" },
  cantabria:      { cod: "06", nivel: "ccaa" },
  castilla_leon:  { cod: "07", nivel: "ccaa" },
  castilla_mancha:{ cod: "08", nivel: "ccaa" },
  cataluna:       { cod: "09", nivel: "ccaa" },
  extremadura:    { cod: "11", nivel: "ccaa" },
  galicia:        { cod: "12", nivel: "ccaa" },
  madrid:         { cod: "13", nivel: "ccaa" },
  murcia:         { cod: "14", nivel: "ccaa" },
  navarra:        { cod: "15", nivel: "ccaa" },
  pais_vasco:     { cod: "16", nivel: "ccaa" },
  rioja:          { cod: "17", nivel: "ccaa" },
  valencia:       { cod: "10", nivel: "ccaa" },
  ceuta:          { cod: "18", nivel: "ccaa" },
  melilla:        { cod: "19", nivel: "ccaa" },

  // Provincias — código INE de 2 dígitos
  // Consultar: https://www.ine.es/daco/daco42/codmun/cod_ccaa_provincia.htm
};

// ─── CLIENTE BASE ─────────────────────────────────────────────────────────────

/**
 * Fetch genérico a la API del INE con gestión de errores y timeout
 */
async function ineRequest(endpoint, params = {}) {
  const url = new URL(`${INE_BASE}/${endpoint}`);

  // Parámetros por defecto
  const defaults = { tip: "AM" }; // Amigable + metadatos
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
 * @param {string} tablaKey  - clave en TABLAS (ej. "renta_media_municipios")
 * @param {object} opciones
 * @param {number} opciones.nult        - últimos N periodos (default: 5)
 * @param {number} opciones.det         - nivel detalle 0|1|2 (default: 2)
 * @param {string|string[]} opciones.tv - filtros tv (ej. "CPRO:28" para Madrid)
 */
export async function getDatosTabla(tablaKey, opciones = {}) {
  const tabla = TABLAS[tablaKey];
  if (!tabla) throw new Error(`Tabla desconocida: ${tablaKey}`);

  const { nult = 5, det = 2, tv } = opciones;
  return ineRequest(`DATOS_TABLA/${tabla.id}`, { nult, det, tv });
}

/**
 * Obtiene los metadatos/series de una tabla (útil para descubrir los códigos tv)
 */
export async function getSeriesTabla(tablaKey) {
  const tabla = TABLAS[tablaKey];
  if (!tabla) throw new Error(`Tabla desconocida: ${tablaKey}`);

  return ineRequest(`SERIES_TABLA/${tabla.id}`, { tip: "M" });
}

/**
 * Obtiene datos de una serie específica por su código
 * @param {string} codigoSerie - ej. "ECV28459"
 */
export async function getDatosSerie(codigoSerie, opciones = {}) {
  const { nult = 5, date } = opciones;
  return ineRequest(`DATOS_SERIE/${codigoSerie}`, { nult, date });
}

// ─── HELPERS DE NEGOCIO ───────────────────────────────────────────────────────

/**
 * Extrae el valor más reciente de un resultado de DATOS_TABLA
 * Devuelve array de { nombre, valor, fecha, unidad }
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
        fecha: ultimo.Anyo
          ? `${ultimo.Anyo}`
          : ultimo.T3_Periodo || "—",
        unidad: serie.Unidad?.Nombre || "",
        cod: serie.COD,
      };
    })
    .filter((s) => s.valor !== null && s.valor !== undefined);
}

/**
 * Clasifica renta según % de la mediana nacional
 * Criterio del informe: 75%-200% = clase media
 *
 * @param {number} renta          - renta anual bruta del territorio
 * @param {number} medianaNacional - mediana nacional (actualizar cada año)
 * @returns {{ clase, ratio, descripcion }}
 */
export function clasificarClaseSocial(renta, medianaNacional) {
  // Mediana nacional de renta bruta por persona — actualizar con datos INE anuales
  // Último dato disponible (2022): ~14.500 €/año (aprox.)
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
 * @param {number} valorInicial
 * @param {number} valorFinal
 * @param {number} años
 * @returns {string} porcentaje con 2 decimales
 */
export function calcularCAGR(valorInicial, valorFinal, años) {
  if (!valorInicial || años <= 0) return null;
  const cagr = (Math.pow(valorFinal / valorInicial, 1 / años) - 1) * 100;
  return parseFloat(cagr.toFixed(2));
}

/**
 * Calcula la máxima cuota hipotecaria asumible y precio de vivienda
 * según criterio del informe (30% renta anual, a 30 años, Euribor ±5%)
 *
 * @param {number} rentaAnualHogar    - en euros
 * @param {number} euribor1a          - tipo Euribor a 1 año (ej. 0.035 para 3.5%)
 * @param {number} spreadBanco        - diferencial habitual (ej. 0.01 para 1%)
 * @returns {{ cuotaMaxMensual, precioAsumibleBase, precioAsumibleMinus5, precioAsumiblePlus5 }}
 */
export function calcularCapacidadHipotecaria(rentaAnualHogar, euribor1a, spreadBanco = 0.01) {
  const cuotaMaxMensual = (rentaAnualHogar * 0.30) / 12;

  const calcularPrecio = (tipo) => {
    const tipoMensual = tipo / 12;
    const n = 30 * 12; // 360 cuotas
    // Fórmula inversa de cuota: P = C × [(1-(1+r)^-n) / r]
    const precio = cuotaMaxMensual * ((1 - Math.pow(1 + tipoMensual, -n)) / tipoMensual);
    return Math.round(precio);
  };

  const tipoBase = euribor1a + spreadBanco;

  return {
    cuotaMaxMensual: Math.round(cuotaMaxMensual),
    tipoBase: (tipoBase * 100).toFixed(2) + "%",
    precioAsumibleBase:   calcularPrecio(tipoBase),
    precioAsumibleMinus5: calcularPrecio(Math.max(tipoBase - 0.005, 0.001)), // -0.5%
    precioAsumiblePlus5:  calcularPrecio(tipoBase + 0.005), // +0.5%
  };
}

// ─── FETCHER COMPLETO PARA SECCIÓN 2 ─────────────────────────────────────────

/**
 * Obtiene todos los datos de la sección 2 para un territorio dado
 *
 * @param {object} territorio
 * @param {string} territorio.municipioCod   - código INE del municipio (5 dígitos, ej. "28079")
 * @param {string} territorio.provinciaCod   - código INE provincia (2 dígitos, ej. "28")
 * @param {string} territorio.nombre         - nombre legible (ej. "Madrid")
 * @param {number} [periodos=10]             - años de histórico para evolución
 *
 * @returns {Promise<object>} todos los datos estructurados por subsección
 */
export async function fetchSeccion2(territorio, periodos = 10) {
  const { municipioCod, provinciaCod, nombre } = territorio;

  console.log(`[INE] Fetching sección 2 para: ${nombre} (municipio: ${municipioCod}, provincia: ${provinciaCod})`);

  // Lanzar todas las peticiones en paralelo para maximizar velocidad
  const [
    rentaMedia,
    poblacionMunicipio,
    variacionResidencial,
    nacionalidad,
    inmigracion,
    emigracion,
    empresasActividad,
    salarioMedio,
    rentaHogar,
    gastoHogar,
  ] = await Promise.allSettled([
    // 2.1.2 Renta media — filtro por municipio si está disponible
    getDatosTabla("renta_media_municipios", { nult: 3, tv: municipioCod ? `CMUN:${municipioCod}` : undefined }),

    // 2.2.1 Evolución población — últimos N años
    getDatosTabla("poblacion_municipios", { nult: periodos, tv: municipioCod ? `CMUN:${municipioCod}` : undefined }),

    // 2.2.2 Variación residencial
    getDatosTabla("variacion_residencial_municipios", { nult: 5, tv: municipioCod ? `CMUN:${municipioCod}` : undefined }),

    // 2.2.2 Nacionalidad
    getDatosTabla("poblacion_nacionalidad", { nult: 3, tv: municipioCod ? `CMUN:${municipioCod}` : undefined }),

    // 2.2.2 Inmigración
    getDatosTabla("inmigracion", { nult: 5, tv: provinciaCod ? `CPRO:${provinciaCod}` : undefined }),

    // 2.2.2 Emigración
    getDatosTabla("emigracion", { nult: 5, tv: provinciaCod ? `CPRO:${provinciaCod}` : undefined }),

    // 2.3.1 Empresas por actividad — nivel provincial
    getDatosTabla("empresas_actividad", { nult: 3, tv: provinciaCod ? `CPRO:${provinciaCod}` : undefined }),

    // 2.3.2 Salario medio — nivel provincial
    getDatosTabla("salario_medio", { nult: 3, tv: provinciaCod ? `CPRO:${provinciaCod}` : undefined }),

    // 2.3.3 Renta por hogar — municipio
    getDatosTabla("renta_media_hogar", { nult: 3, tv: municipioCod ? `CMUN:${municipioCod}` : undefined }),

    // 2.3.3 Gasto por hogar — nacional (esta tabla no tiene desglose municipal)
    getDatosTabla("gasto_medio_hogar", { nult: 3 }),
  ]);

  // Normalizar resultados de Promise.allSettled
  const normalizar = (result, nombre) => {
    if (result.status === "fulfilled") return result.value;
    console.warn(`[INE] Error en ${nombre}:`, result.reason);
    return { ok: false, error: result.reason?.message || "Error desconocido" };
  };

  return {
    territorio: { municipioCod, provinciaCod, nombre },
    timestamp: new Date().toISOString(),
    secciones: {
      "2.1.2_renta_media":           normalizar(rentaMedia,           "renta_media"),
      "2.2.1_evolucion_poblacion":   normalizar(poblacionMunicipio,   "poblacion_municipio"),
      "2.2.2_variacion_residencial": normalizar(variacionResidencial, "variacion_residencial"),
      "2.2.2_nacionalidad":          normalizar(nacionalidad,         "nacionalidad"),
      "2.2.2_inmigracion":           normalizar(inmigracion,          "inmigracion"),
      "2.2.2_emigracion":            normalizar(emigracion,           "emigracion"),
      "2.3.1_empresas_actividad":    normalizar(empresasActividad,    "empresas_actividad"),
      "2.3.2_salario_medio":         normalizar(salarioMedio,         "salario_medio"),
      "2.3.3_renta_hogar":           normalizar(rentaHogar,           "renta_hogar"),
      "2.3.3_gasto_hogar":           normalizar(gastoHogar,           "gasto_hogar"),
    },
  };
}
