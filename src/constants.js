// ─── Comunidades Autónomas ────────────────────────────────────────────────────
export const CCAA = [
  { c:'01', n:'Andalucía' },
  { c:'02', n:'Aragón' },
  { c:'03', n:'Asturias, Principado de' },
  { c:'04', n:'Balears, Illes' },
  { c:'05', n:'Canarias' },
  { c:'06', n:'Cantabria' },
  { c:'07', n:'Castilla y León' },
  { c:'08', n:'Castilla-La Mancha' },
  { c:'09', n:'Cataluña' },
  { c:'10', n:'Comunitat Valenciana' },
  { c:'11', n:'Extremadura' },
  { c:'12', n:'Galicia' },
  { c:'13', n:'Madrid, Comunidad de' },
  { c:'14', n:'Murcia, Región de' },
  { c:'15', n:'Navarra, Comunidad Foral de' },
  { c:'16', n:'País Vasco' },
  { c:'17', n:'Rioja, La' },
  { c:'18', n:'Ceuta' },
  { c:'19', n:'Melilla' },
]

// Mapa provincia → CCAA
export const PROV_TO_CCAA = {
  '04':'01','11':'01','14':'01','18':'01','21':'01','23':'01','29':'01','41':'01', // Andalucía
  '22':'02','44':'02','50':'02',                                                   // Aragón
  '33':'03',                                                                       // Asturias
  '07':'04',                                                                       // Baleares
  '35':'05','38':'05',                                                             // Canarias
  '39':'06',                                                                       // Cantabria
  '05':'07','09':'07','24':'07','34':'07','37':'07','40':'07','42':'07','47':'07','49':'07', // CyL
  '02':'08','13':'08','16':'08','19':'08','45':'08',                               // CLM
  '08':'09','17':'09','25':'09','43':'09',                                         // Cataluña
  '03':'10','12':'10','46':'10',                                                   // C. Valenciana
  '06':'11','10':'11',                                                             // Extremadura
  '15':'12','27':'12','32':'12','36':'12',                                         // Galicia
  '28':'13',                                                                       // Madrid
  '30':'14',                                                                       // Murcia
  '31':'15',                                                                       // Navarra
  '01':'16','20':'16','48':'16',                                                   // País Vasco
  '26':'17',                                                                       // La Rioja
  '51':'18',                                                                       // Ceuta
  '52':'19',                                                                       // Melilla
}

// ─── Provincias ───────────────────────────────────────────────────────────────
export const PROVINCES = [
  {c:'01',n:'Álava'},{c:'02',n:'Albacete'},{c:'03',n:'Alicante/Alacant'},
  {c:'04',n:'Almería'},{c:'05',n:'Ávila'},{c:'06',n:'Badajoz'},
  {c:'07',n:'Balears, Illes'},{c:'08',n:'Barcelona'},{c:'09',n:'Burgos'},
  {c:'10',n:'Cáceres'},{c:'11',n:'Cádiz'},{c:'12',n:'Castellón/Castelló'},
  {c:'13',n:'Ciudad Real'},{c:'14',n:'Córdoba'},{c:'15',n:'Coruña, A'},
  {c:'16',n:'Cuenca'},{c:'17',n:'Girona'},{c:'18',n:'Granada'},
  {c:'19',n:'Guadalajara'},{c:'20',n:'Gipuzkoa'},{c:'21',n:'Huelva'},
  {c:'22',n:'Huesca'},{c:'23',n:'Jaén'},{c:'24',n:'León'},
  {c:'25',n:'Lleida'},{c:'26',n:'Rioja, La'},{c:'27',n:'Lugo'},
  {c:'28',n:'Madrid'},{c:'29',n:'Málaga'},{c:'30',n:'Murcia'},
  {c:'31',n:'Navarra/Nafarroa'},{c:'32',n:'Ourense'},{c:'33',n:'Asturias'},
  {c:'34',n:'Palencia'},{c:'35',n:'Palmas, Las'},{c:'36',n:'Pontevedra'},
  {c:'37',n:'Salamanca'},{c:'38',n:'S.C. de Tenerife'},{c:'39',n:'Cantabria'},
  {c:'40',n:'Segovia'},{c:'41',n:'Sevilla'},{c:'42',n:'Soria'},
  {c:'43',n:'Tarragona'},{c:'44',n:'Teruel'},{c:'45',n:'Toledo'},
  {c:'46',n:'Valencia/València'},{c:'47',n:'Valladolid'},{c:'48',n:'Bizkaia'},
  {c:'49',n:'Zamora'},{c:'50',n:'Zaragoza'},{c:'51',n:'Ceuta'},{c:'52',n:'Melilla'}
]

// Provincias filtradas por CCAA
export function provsByCA(ccaaCode) {
  return PROVINCES.filter(p => PROV_TO_CCAA[p.c] === ccaaCode)
}
