/**
 * Partes del camion segun su configuracion RNDC: "3S3" es un tracto de 3 ejes
 * con un semirremolque de 3 (22 llantas), "2S2" uno de 2 + 2, "3" un
 * dobletroque y "2" un sencillo. El eje delantero lleva 2 llantas y los demas
 * 4 (dobles). Cada parte tiene un id (el mismo de la pieza en el modelo 3D),
 * su grupo y las preguntas del preoperacional que la revisan. No depende de
 * React ni de Three.js: se prueba aparte (esquemaCamion.test.ts).
 */

/** Grupos de partes que se pueden iluminar juntas. */
export type GrupoParte = "llantas" | "motor" | "ejes" | "estructura" | "seguridad";

export const GRUPOS: Array<{ id: GrupoParte; nombre: string }> = [
  { id: "llantas", nombre: "Llantas" },
  { id: "motor", nombre: "Motor y transmision" },
  { id: "ejes", nombre: "Ejes y frenos" },
  { id: "estructura", nombre: "Cabina, chasis y carroceria" },
  { id: "seguridad", nombre: "Luces, espejos y parachoques" },
];

/** Una parte del camion. */
export interface Parte {
  id: string;
  nombre: string;
  grupo: GrupoParte;
  /** Preguntas del preoperacional que la revisan (vacio: no se revisa ahi). */
  preop: string[];
  /** Va por dentro (motor, transmision...): se ve con rayos X. */
  interna?: boolean;
}

/** Las partes del camion y sus cuentas. */
export interface Esquema {
  articulado: boolean;
  llantas: number;
  ejes: number;
  partes: Parte[];
}

/** Ejes del tracto y del remolque segun la configuracion ("3S3" -> 3 y 3; "3" -> 3 y 0). Sin dato, 3S3. */
export function ejesDe(configuracion: string | null | undefined): { tracto: number; remolque: number } {
  const c = String(configuracion ?? "")
    .toUpperCase()
    .replace(/\s/g, "");
  const art = /^(\d)S(\d)$/.exec(c);
  if (art) return { tracto: Math.max(2, Number(art[1])), remolque: Math.max(1, Number(art[2])) };
  const rig = /^(\d)$/.exec(c);
  if (rig) return { tracto: Math.max(2, Number(rig[1])), remolque: 0 };
  return { tracto: 3, remolque: 3 };
}

/** Tipo del vehiculo en palabras, como en el preoperacional. */
export function tipoDe(configuracion: string | null | undefined): string {
  const { tracto, remolque } = ejesDe(configuracion);
  if (remolque) return tracto >= 3 ? "Tractomula de tres troques" : remolque >= 2 ? "Tractomula de dos troques" : "Minimula";
  return tracto >= 3 ? "Dobletroque" : "Camion sencillo";
}

const LLANTA = ["llantas", "presionLlantas"];
const LUCES = ["luces", "direccionales"];

/** Nombre de un eje (0 es el delantero). */
function nombreEje(i: number, traseros: number): string {
  if (i === 0) return "eje delantero";
  return i > traseros ? `eje ${i - traseros} del remolque` : `eje de traccion ${i}`;
}

/** Arma la lista de partes del camion para su configuracion. */
export function esquemaCamion(configuracion: string | null | undefined): Esquema {
  const { tracto, remolque } = ejesDe(configuracion);
  const articulado = remolque > 0;
  const traseros = tracto - 1;
  const totalEjes = tracto + remolque;
  const partes: Parte[] = [];
  const parte = (id: string, nombre: string, grupo: GrupoParte, preop: string[] = [], interna = false) =>
    partes.push({ id, nombre, grupo, preop, ...(interna ? { interna } : {}) });

  // Llantas: el delantero, una por lado; los demas, dobles. Numeradas de adelante hacia atras, de izquierda a derecha.
  let n = 0;
  for (let i = 0; i < totalEjes; i++) {
    const eje = nombreEje(i, traseros);
    const lados = i === 0 ? ["izquierda", "derecha"] : ["izquierda afuera", "izquierda adentro", "derecha adentro", "derecha afuera"];
    for (const lado of lados) {
      n += 1;
      parte(`llanta-${n}`, `Llanta ${n} (${eje}, ${lado})`, "llantas", LLANTA);
    }
  }
  for (let i = 0; i < totalEjes; i++) {
    const eje = nombreEje(i, traseros);
    parte(`eje-${i + 1}`, `${eje[0].toUpperCase()}${eje.slice(1)} y frenos`, "ejes", ["frenos"]);
  }
  for (let i = 1; i <= traseros; i++) parte(`diferencial-${i}`, `Diferencial del eje de traccion ${i}`, "ejes", [], true);

  parte("radiador", "Radiador (rejilla)", "motor");
  parte("motor", "Motor", "motor", [], true);
  parte("transmision", "Transmision (caja)", "motor", [], true);
  parte("cardan", "Cardan", "motor", [], true);
  parte("tanque", "Tanque de combustible izquierdo", "motor", ["tanque"]);
  parte("tanque-der", "Tanque de combustible derecho", "motor", ["tanque"]);
  parte("baterias", "Caja de baterias", "motor");
  if (articulado) parte("quinta-rueda", "Quinta rueda", "motor");

  parte("cabina", articulado ? "Cabina y dormitorio (cinturon, limpiabrisas, puertas)" : "Cabina (cinturon, limpiabrisas, puertas)", "estructura", [
    "cabina",
    "cinturon",
    "limpiabrisas",
  ]);
  parte("chasis-izq", "Chasis (bastidor izquierdo)", "estructura", ["bastidores"]);
  parte("chasis-der", "Chasis (bastidor derecho)", "estructura", ["bastidores"]);
  parte("plataforma", articulado ? "Plataforma del remolque (paredes y piso)" : "Carroceria de estacas (paredes y piso)", "estructura", [
    "paredesPisos",
    "puertas",
  ]);

  parte("parachoques", "Parachoques", "seguridad", ["parachoques"]);
  parte("espejo-izq", "Espejo izquierdo", "seguridad", ["espejos"]);
  parte("espejo-der", "Espejo derecho", "seguridad", ["espejos"]);
  parte("luz-del-izq", "Luz delantera izquierda (luces y direccionales)", "seguridad", LUCES);
  parte("luz-del-der", "Luz delantera derecha (luces y direccionales)", "seguridad", LUCES);
  parte("luz-tras-izq", "Luz trasera izquierda (luces y direccionales)", "seguridad", LUCES);
  parte("luz-tras-der", "Luz trasera derecha (luces y direccionales)", "seguridad", LUCES);

  return { articulado, llantas: n, ejes: totalEjes, partes };
}

/** Estado de una parte segun las respuestas del ultimo preoperacional. */
export type EstadoParte = "ok" | "novedad" | "sinDato";

const BIEN = ["Sí", "Cumple", "No aplica"];

/** Ok si todas sus preguntas quedaron en Si / Cumple / No aplica y sin novedad escrita; sin dato si no tiene preguntas o no hay inspeccion. */
export function estadoParte(p: Pick<Parte, "preop">, respuestas: Record<string, string> | null | undefined): EstadoParte {
  if (!respuestas || !p.preop.length) return "sinDato";
  const valores = p.preop.map((c) => respuestas[c]).filter((v) => v !== undefined && v !== "");
  if (!valores.length) return "sinDato";
  const conNovedad = p.preop.some((c) => (respuestas[c] && !BIEN.includes(respuestas[c])) || (respuestas[`${c}Novedad`] ?? "").trim());
  return conNovedad ? "novedad" : "ok";
}

const CORTOS: Record<string, string> = {
  tanque: "Tanque izq.",
  "tanque-der": "Tanque der.",
  "chasis-izq": "Chasis izq.",
  "chasis-der": "Chasis der.",
  "espejo-izq": "Espejo izq.",
  "espejo-der": "Espejo der.",
  "luz-del-izq": "Luz del. izq.",
  "luz-del-der": "Luz del. der.",
  "luz-tras-izq": "Luz tras. izq.",
  "luz-tras-der": "Luz tras. der.",
  baterias: "Baterias",
  transmision: "Transmision",
  radiador: "Radiador",
};

/** Nombre corto de una parte para la lista ("Llanta 7", "Eje 2", "Tanque der."). */
export function nombreCorto(p: Pick<Parte, "id" | "nombre">): string {
  const m = /^(llanta|eje|diferencial)-(\d+)$/.exec(p.id);
  if (m) return `${m[1][0].toUpperCase()}${m[1].slice(1)} ${m[2]}`;
  return CORTOS[p.id] ?? p.nombre.replace(/ \(.*\)$/, "");
}
