/**
 * ine-codigos.js
 * Utilidad para buscar códigos INE de municipios
 *
 * Los filtros tv= de la API del INE usan:
 *   CMUN:{codigo5digitos}   → municipio (ej. "28079" para Madrid)
 *   CPRO:{codigo2digitos}   → provincia (ej. "28" para Madrid)
 *   CCAA:{codigo2digitos}   → comunidad autónoma (ej. "13" para Madrid)
 *
 * Fuente: https://www.ine.es/daco/daco42/codmun/codmun24.xlsx
 * INE publica el Excel oficial de códigos cada año — descargarlo y cachear
 */

/**
 * Busca el código INE de un municipio por nombre
 * Usa la API de municipios del INE
 *
 * @param {string} nombreMunicipio - ej. "Valencia", "Málaga"
 * @returns {Promise<Array<{nombre, codMunicipio, codProvincia, codCCAA}>>}
 */
export async function buscarCodigoMunicipio(nombreMunicipio) {
  const url = `https://servicios.ine.es/wstempus/js/ES/MUNICIPIOS`;

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Error fetching municipios: ${res.status}`);

  const todos = await res.json();

  const query = nombreMunicipio.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const coincidencias = todos
    .filter((m) => {
      const nombre = (m.Nombre || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return nombre.includes(query);
    })
    .map((m) => ({
      nombre: m.Nombre,
      codMunicipio: m.Codigo, // 5 dígitos
      codProvincia: m.Codigo?.substring(0, 2), // primeros 2 dígitos
    }))
    .slice(0, 10);

  return coincidencias;
}

/**
 * Endpoint de Vercel: GET /api/buscar-municipio?q=Valencia
 */
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  if (!q || q.length < 3) {
    return Response.json({ ok: false, error: "Parámetro q requerido (mínimo 3 caracteres)" }, { status: 400 });
  }

  try {
    const resultados = await buscarCodigoMunicipio(q);
    return Response.json({ ok: true, resultados });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// ── TABLA DE REFERENCIA RÁPIDA ────────────────────────────────────────────────
// Municipios más comunes para el mercado flex-living/residencial en España
// (evita tener que hacer lookup para los casos habituales)
export const MUNICIPIOS_COMUNES = {
  // Madrid
  madrid:          { cod: "28079", provincia: "28", ccaa: "13" },
  alcobendas:      { cod: "28006", provincia: "28", ccaa: "13" },
  pozuelo:         { cod: "28115", provincia: "28", ccaa: "13" },
  majadahonda:     { cod: "28080", provincia: "28", ccaa: "13" },

  // Barcelona
  barcelona:       { cod: "08019", provincia: "08", ccaa: "09" },
  hospitalet:      { cod: "08101", provincia: "08", ccaa: "09" },
  badalona:        { cod: "08015", provincia: "08", ccaa: "09" },

  // Valencia
  valencia:        { cod: "46250", provincia: "46", ccaa: "10" },
  alicante:        { cod: "03014", provincia: "03", ccaa: "10" },
  benidorm:        { cod: "03031", provincia: "03", ccaa: "10" },
  la_nucia:        { cod: "03082", provincia: "03", ccaa: "10" }, // Activum La Nucía One

  // Andalucía
  sevilla:         { cod: "41091", provincia: "41", ccaa: "01" },
  malaga:          { cod: "29067", provincia: "29", ccaa: "01" },
  granada:         { cod: "18087", provincia: "18", ccaa: "01" },

  // Otras
  zaragoza:        { cod: "50297", provincia: "50", ccaa: "02" },
  bilbao:          { cod: "48020", provincia: "48", ccaa: "16" },
  valladolid:      { cod: "47186", provincia: "47", ccaa: "07" },
  murcia:          { cod: "30030", provincia: "30", ccaa: "14" },
};
