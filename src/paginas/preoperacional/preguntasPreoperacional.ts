/**
 * Preguntas de la inspeccion preoperacional, en el orden del formulario de
 * Google "Inspeccion Preoperacional de Vehiculos" (Resolucion 40595), con sus
 * opciones y la respuesta por defecto (todo en "Si" / "Cumple", como estaban
 * los enlaces precargados).
 *
 * Tambien: como se leen los enlaces precargados de la Matriz Control Integral
 * (entry.N de Google Forms -> clave) y las respuestas sugeridas.
 * No depende de React: se prueba aparte (preguntasPreoperacional.test.ts).
 */

/** Como se contesta una pregunta. */
export type TipoPregunta = "opcion" | "texto" | "fecha" | "largo";

/** Una pregunta del formulario. */
export interface Pregunta {
  clave: string;
  titulo: string;
  seccion: "Viaje" | "Conductor y vehiculo" | "Documentos y equipo" | "Inspeccion" | "Cierre";
  tipo: TipoPregunta;
  opciones?: string[];
  /** Acepta otro valor escrito (el "Otros:" del formulario). */
  otro?: boolean;
  defecto?: string;
  requerida: boolean;
  /** Clave de su "Si presenta novedad amplie la informacion". */
  novedad?: string;
}

export const SI_NO = ["Sí", "No"];
const SI_NO_NA = ["Sí", "No", "No aplica"];
const CUMPLE = ["Cumple", "No cumple"];
const CUMPLE_NA = ["Cumple", "No cumple", "No aplica"];
export const CIUDADES = ["SOACHA", "BARRANQUILLA", "BUENAVENTURA", "BUCARAMANGA", "CARTAGENA", "CALI", "MEDELLIN", "IBAGUE", "ZIPAQUIRA", "MONTERIA", "BOGOTA"];

/** Codigo DANE (5 digitos) de las ciudades del formulario, para el origen que reporta el RNDC (76001000 -> CALI). */
export const CODIGOS_CIUDAD: Record<string, string> = {
  "25754": "SOACHA",
  "08001": "BARRANQUILLA",
  "76109": "BUENAVENTURA",
  "68001": "BUCARAMANGA",
  "13001": "CARTAGENA",
  "76001": "CALI",
  "05001": "MEDELLIN",
  "73001": "IBAGUE",
  "25899": "ZIPAQUIRA",
  "23001": "MONTERIA",
  "11001": "BOGOTA",
};

/** Item de la inspeccion con su novedad. */
const item = (clave: string, titulo: string, opciones: string[], requerida = true): Pregunta => ({
  clave,
  titulo,
  seccion: "Inspeccion",
  tipo: "opcion",
  opciones,
  defecto: opciones[0],
  requerida,
  novedad: `${clave}Novedad`,
});

export const PREGUNTAS: Pregunta[] = [
  { clave: "ciudadOrigen", titulo: "Ciudad de origen", seccion: "Viaje", tipo: "opcion", opciones: CIUDADES, otro: true, requerida: true },
  { clave: "placa", titulo: "Placa del vehiculo", seccion: "Viaje", tipo: "texto", requerida: true },
  { clave: "fechaInspeccion", titulo: "Fecha de inspeccion", seccion: "Viaje", tipo: "fecha", requerida: true },
  { clave: "fechaMantenimiento", titulo: "Fecha del ultimo mantenimiento del vehiculo", seccion: "Viaje", tipo: "fecha", requerida: true },
  { clave: "conductor", titulo: "Nombre y apellido del conductor", seccion: "Viaje", tipo: "texto", requerida: true },
  { clave: "kilometraje", titulo: "Kilometraje", seccion: "Viaje", tipo: "texto", requerida: false },
  { clave: "saludOptima", titulo: "Antes de iniciar la ruta, ¿se encuentra en optimas condiciones de salud para conducir?", seccion: "Conductor y vehiculo", tipo: "opcion", opciones: SI_NO, defecto: "Sí", requerida: true },
  {
    clave: "descanso",
    titulo: "Descanso previo para iniciar su ruta (horas)",
    seccion: "Conductor y vehiculo",
    tipo: "opcion",
    opciones: ["MAS DE 7 HORAS", "DE 3 A 6 HORAS", "DE 1 A 3 HORAS", "NO DESCANSO"],
    defecto: "MAS DE 7 HORAS",
    requerida: true,
  },
  { clave: "responsable", titulo: "Responsable (quien realiza la inspeccion)", seccion: "Conductor y vehiculo", tipo: "texto", requerida: true },
  {
    clave: "tipoVehiculo",
    titulo: "Tipo de vehiculo",
    seccion: "Conductor y vehiculo",
    tipo: "opcion",
    opciones: ["TRACTOMULA TRES TROQUES", "TRACTOMULA DOS TROQUES", "DOBLE TROQUE", "MINI MULA"],
    otro: true,
    requerida: true,
  },
  { clave: "carroceria", titulo: "Carroceria", seccion: "Conductor y vehiculo", tipo: "opcion", opciones: ["ESTACAS", "PLANCHÓN", "REMOLQUE"], requerida: true },
  {
    clave: "arl",
    titulo: "ARL a la cual esta afiliado el conductor",
    seccion: "Conductor y vehiculo",
    tipo: "opcion",
    opciones: ["ARL SURA", "ARL POSITIVA", "ARL AXA COLPATRIA", "ARL COLMENA", "ARL BOLIVAR", "ARL LA EQUIDAD"],
    otro: true,
    requerida: true,
  },
  { clave: "eps", titulo: "EPS a la cual esta afiliado el conductor", seccion: "Conductor y vehiculo", tipo: "texto", requerida: true },
  { clave: "pension", titulo: "Fondo de pension al cual esta afiliado el conductor", seccion: "Conductor y vehiculo", tipo: "texto", requerida: true },
  { clave: "epp", titulo: "EPP: elementos de proteccion personal en buenas condiciones y elementos basicos de bioseguridad", seccion: "Documentos y equipo", tipo: "opcion", opciones: SI_NO, defecto: "Sí", requerida: true },
  { clave: "botiquin", titulo: "Inspeccion botiquin", seccion: "Documentos y equipo", tipo: "opcion", opciones: SI_NO, defecto: "Sí", requerida: true },
  { clave: "extintor", titulo: "Inspeccion extintor", seccion: "Documentos y equipo", tipo: "opcion", opciones: SI_NO, defecto: "Sí", requerida: true },
  { clave: "vencExtintor", titulo: "Fecha de vencimiento del extintor", seccion: "Documentos y equipo", tipo: "fecha", requerida: true },
  { clave: "vencSoat", titulo: "Fecha de vencimiento del SOAT", seccion: "Documentos y equipo", tipo: "fecha", requerida: true },
  { clave: "vencTecno", titulo: "Fecha de vencimiento de la tecnomecanica", seccion: "Documentos y equipo", tipo: "fecha", requerida: true },
  { clave: "gps", titulo: "¿Cuenta con GPS?", seccion: "Documentos y equipo", tipo: "opcion", opciones: SI_NO, defecto: "Sí", requerida: true },
  item("cabina", "Inspeccion cabina", SI_NO_NA),
  item("direccionales", "Inspeccion direccionales", SI_NO),
  item("luces", "Inspeccion luces", CUMPLE_NA),
  item("cinturon", "Inspeccion cinturon de seguridad", SI_NO),
  item("limpiabrisas", "Inspeccion limpiabrisas", CUMPLE_NA),
  item("frenos", "Inspeccion de frenos", CUMPLE_NA),
  item("espejos", "Inspeccion de espejos", CUMPLE),
  item("equipoCarretera", "Inspeccion equipo de carretera", CUMPLE),
  item("llantas", "Inspeccion de llantas", CUMPLE_NA),
  item("presionLlantas", "Presion de aire en las llantas", CUMPLE_NA, false),
  item("bastidores", "Inspeccion estado de bastidores", CUMPLE_NA),
  item("tanque", "Inspeccion tanque de combustible", CUMPLE_NA),
  item("paredesPisos", "Paredes y pisos del vehiculo", CUMPLE_NA),
  item("puertas", "Puertas del vehiculo", CUMPLE_NA),
  item("parachoques", "El parachoques", CUMPLE),
  { clave: "aprobo", titulo: "¿Aprobo la inspeccion?", seccion: "Cierre", tipo: "opcion", opciones: SI_NO, defecto: "Sí", requerida: true },
  { clave: "otrasNovedades", titulo: "Otras novedades (vehiculo, conductor o la ruta)", seccion: "Cierre", tipo: "largo", requerida: false },
];

export const SECCIONES: Pregunta["seccion"][] = ["Viaje", "Conductor y vehiculo", "Documentos y equipo", "Inspeccion", "Cierre"];

/**
 * entry.N de los enlaces precargados del formulario de Google -> clave. Las
 * dos novedades del parachoques del formulario quedan en una sola.
 */
export const ENTRADAS_FORMULARIO: Record<string, string> = {
  "entry.2100619182": "placa",
  "entry.955491889": "conductor",
  "entry.1093538174": "saludOptima",
  "entry.1478229700": "descanso",
  "entry.1515941534": "responsable",
  "entry.1268337379": "tipoVehiculo",
  "entry.326503096": "carroceria",
  "entry.1980625643": "arl",
  "entry.1271760777": "eps",
  "entry.7447639": "pension",
  "entry.1784398751": "epp",
  "entry.95453688": "botiquin",
  "entry.647209154": "extintor",
  "entry.1050497175": "vencExtintor",
  "entry.1797181906": "vencSoat",
  "entry.1302396047": "vencTecno",
  "entry.1407804330": "gps",
  "entry.2006203297": "cabina",
  "entry.67723341": "cabinaNovedad",
  "entry.1111967255": "direccionales",
  "entry.223100895": "direccionalesNovedad",
  "entry.1331567504": "luces",
  "entry.2001470888": "lucesNovedad",
  "entry.2020564262": "cinturon",
  "entry.1843962279": "cinturonNovedad",
  "entry.985010631": "limpiabrisas",
  "entry.472776904": "limpiabrisasNovedad",
  "entry.1354527998": "frenos",
  "entry.231390309": "frenosNovedad",
  "entry.419653940": "espejos",
  "entry.1470021943": "espejosNovedad",
  "entry.2040224589": "equipoCarretera",
  "entry.825470904": "equipoCarreteraNovedad",
  "entry.1016931560": "llantas",
  "entry.1912784896": "llantasNovedad",
  "entry.1476025845": "presionLlantas",
  "entry.430615680": "presionLlantasNovedad",
  "entry.613432086": "bastidores",
  "entry.152933271": "bastidoresNovedad",
  "entry.135222159": "tanque",
  "entry.1203344565": "tanqueNovedad",
  "entry.1261310187": "paredesPisos",
  "entry.316706356": "paredesPisosNovedad",
  "entry.258137388": "puertas",
  "entry.204482445": "puertasNovedad",
  "entry.1824277354": "parachoques",
  "entry.1056983702": "parachoquesNovedad",
  "entry.1762655798": "parachoquesNovedad",
  "entry.1396717297": "aprobo",
};

/** Texto sin tildes, en mayuscula y sin espacios de mas, para comparar. */
const normal = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

/**
 * Una respuesta como la escribe el formulario: "Si" / "SI" -> "Sí", la opcion
 * con su forma exacta si coincide sin tildes, y "NO" en una novedad -> vacio.
 */
export function respuestaNormal(p: Pregunta | undefined, clave: string, valor: string): string {
  const v = valor.trim();
  if (clave.endsWith("Novedad")) return /^NO\.?$/i.test(v) ? "" : v;
  if (!p?.opciones) return v;
  return p.opciones.find((o) => normal(o) === normal(v)) ?? v;
}

/** Pregunta por clave. */
const porClave = new Map(PREGUNTAS.map((p) => [p.clave, p]));

/** Ciudad del formulario para el origen del viaje ("SOACHA CUNDINAMARCA" -> SOACHA, "BOGOTA, D.C." -> BOGOTA). */
export function ciudadDeOrigen(origen: string | null | undefined): string {
  if (!origen) return "";
  const o = normal(origen).replace(/[^A-Z ]/g, " ");
  return CIUDADES.find((c) => o.split(" ").includes(normal(c))) ?? normal(origen).split(",")[0];
}

/**
 * Respuestas para el formulario: las de por defecto (todo en Si / Cumple), y
 * encima las sugeridas por el servidor (ultima inspeccion de la placa o la
 * matriz importada, y lo del viaje).
 */
export function respuestasIniciales(sugeridas: Record<string, string>): Record<string, string> {
  const r: Record<string, string> = {};
  for (const p of PREGUNTAS) {
    r[p.clave] = p.defecto ?? "";
    if (p.novedad) r[p.novedad] = "";
  }
  for (const [k, v] of Object.entries(sugeridas)) {
    if (k === "ciudadOrigenViaje" || k === "ciudadOrigenCodigo") continue;
    if (k in r) r[k] = respuestaNormal(porClave.get(k), k, v);
  }
  // Ciudad: la del origen del viaje (por su codigo DANE o su nombre); si no, la de la inspeccion anterior.
  const delViaje = CODIGOS_CIUDAD[(sugeridas.ciudadOrigenCodigo ?? "").slice(0, 5)] ?? ciudadDeOrigen(sugeridas.ciudadOrigenViaje);
  if (delViaje) r.ciudadOrigen = delViaje;
  return r;
}

/** Preguntas obligatorias sin contestar. */
export function faltantes(r: Record<string, string>): Pregunta[] {
  return PREGUNTAS.filter((p) => p.requerida && !(r[p.clave] ?? "").trim());
}

/** Respuestas de un enlace precargado de Google Forms (las entry.N conocidas). */
export function respuestasDeEnlace(url: string): Record<string, string> {
  const r: Record<string, string> = {};
  let params: URLSearchParams;
  try {
    params = new URL(url).searchParams;
  } catch {
    return r;
  }
  for (const [entrada, valor] of params) {
    const clave = ENTRADAS_FORMULARIO[entrada];
    if (!clave) continue;
    const v = respuestaNormal(porClave.get(clave), clave, valor);
    // Las dos novedades del parachoques se juntan.
    r[clave] = r[clave] && v ? `${r[clave]} / ${v}` : r[clave] || v;
  }
  return r;
}
