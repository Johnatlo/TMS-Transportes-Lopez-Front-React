/**
 * Vistas de mantenimiento del camion segun su marca: izquierda, frente y
 * derecha, de los renders sin fondo de la flota (Kenworth, International,
 * Shacman y Volvo). Las marcas sin render usan la mula de mantenimiento
 * (Peterbilt); como de ella solo hay un costado, el otro es la misma imagen
 * en espejo, con sus zonas volteadas (izquierda <-> derecha).
 * Cada vista tiene sus zonas: el rectangulo (en % de la imagen) de cada parte
 * que se ve ahi, para iluminarla y elegirla. Las llantas se ubican por grupo
 * de ejes (delantero, traccion, remolque), numero de eje y lado, porque su
 * numero depende de la configuracion del vehiculo.
 */
import kenworthFrente from "./imagenes/kenworth-frente.webp";
import kenworthIzq from "./imagenes/kenworth-izq.webp";
import kenworthDer from "./imagenes/kenworth-der.webp";
import internationalFrente from "./imagenes/international-frente.webp";
import internationalIzq from "./imagenes/international-izq.webp";
import internationalDer from "./imagenes/international-der.webp";
import shacmanFrente from "./imagenes/shacman-frente.webp";
import shacmanIzq from "./imagenes/shacman-izq.webp";
import shacmanDer from "./imagenes/shacman-der.webp";
import volvoFrente from "./imagenes/volvo-frente.webp";
import volvoIzq from "./imagenes/volvo-izq.webp";
import volvoDer from "./imagenes/volvo-der.webp";
import peterbiltFrente from "./imagenes/peterbilt-frente.webp";
import peterbiltLado from "./imagenes/peterbilt-lado.webp";
import { ejesDe } from "./esquemaCamion";

/** Lado del camion (el del conductor es el izquierdo). */
export type Lado = "izq" | "der";

/** Llanta de afuera por grupo de ejes, numero de eje dentro del grupo (desde 1, de adelante hacia atras) y lado. */
export interface LlantaEn {
  grupo: "del" | "traccion" | "remolque";
  n: number;
  lado: Lado;
}

/** Zona de una parte en una vista (en % del ancho y alto de la imagen). */
export interface Zona {
  parte: string | LlantaEn;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Una imagen con sus zonas. */
interface Imagen {
  src: string;
  ancho: number;
  alto: number;
  zonas: Zona[];
  /** Dibujo sobre papel (sus bordes se funden con el fondo). */
  papel?: boolean;
}

/** Una vista lista para mostrar. */
export interface Vista extends Imagen {
  id: "izquierda" | "frente" | "derecha";
  nombre: string;
  /** La imagen va en espejo (es la foto del otro costado). */
  espejo: boolean;
}

/** Imagenes de una marca; un costado que falta se arma en espejo con el otro. */
interface ImagenesMarca {
  frente: Imagen;
  izquierda?: Imagen;
  derecha?: Imagen;
}

/** Arma una zona desde sus bordes (izquierda, arriba, derecha, abajo) en %. */
const z = (parte: string | LlantaEn, x0: number, y0: number, x1: number, y1: number): Zona => ({ parte, x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
/** Llanta de afuera de un eje. */
const ll = (grupo: LlantaEn["grupo"], n: number, lado: Lado): LlantaEn => ({ grupo, n, lado });

/** Imagenes por marca (la clave se busca dentro del nombre de la marca). Las zonas grandes van primero. */
const MARCAS: Record<string, ImagenesMarca> = {
  KENWORTH: {
    frente: {
      src: kenworthFrente,
      ancho: 400,
      alto: 696,
      zonas: [
        z("cabina", 14, 40, 86, 57),
        z("radiador", 31, 71, 70, 89),
        z("parachoques", 7, 88, 93, 97),
        z("luz-del-der", 8, 80, 22, 86),
        z("luz-del-izq", 77, 80, 92, 86),
        z("espejo-der", 0, 45, 10, 62),
        z("espejo-izq", 90, 45, 100, 62),
        z(ll("del", 1, "der"), 7, 96, 18, 100),
        z(ll("del", 1, "izq"), 82, 96, 93, 100),
      ],
    },
    izquierda: {
      src: kenworthIzq,
      ancho: 1400,
      alto: 628,
      zonas: [
        z("plataforma", 30, 2, 99, 60),
        z("cabina", 12, 30, 42, 75),
        z("motor", 3, 56, 22, 72),
        z("radiador", 1, 62, 9, 88),
        z("parachoques", 1, 84, 15, 95),
        z("luz-del-izq", 11, 78, 15, 85),
        z("espejo-izq", 9.5, 30, 12, 50),
        z("baterias", 21, 78, 30, 88),
        z("tanque", 30, 72, 40, 83),
        z(ll("del", 1, "izq"), 15, 78, 22, 99),
        z(ll("traccion", 1, "izq"), 42, 66, 49, 88),
        z(ll("traccion", 2, "izq"), 50, 64, 57, 85),
        z(ll("remolque", 1, "izq"), 78, 53, 84, 71),
        z(ll("remolque", 2, "izq"), 84, 50, 90, 67),
        z(ll("remolque", 3, "izq"), 90.5, 47, 97, 64),
      ],
    },
    derecha: {
      src: kenworthDer,
      ancho: 1400,
      alto: 354,
      zonas: [
        z("plataforma", 0, 3, 67, 72),
        z("cabina", 70, 22, 89, 80),
        z("motor", 89, 42, 98, 72),
        z("parachoques", 97, 68, 100, 82),
        z("espejo-der", 86, 32, 88.5, 50),
        z("tanque-der", 79, 72, 88, 86),
        z("luz-tras-der", 0, 66, 2, 74),
        z(ll("del", 1, "der"), 89, 72, 96.5, 99),
        z(ll("traccion", 1, "der"), 61, 72, 68.5, 99),
        z(ll("traccion", 2, "der"), 54, 72, 61, 99),
        z(ll("remolque", 1, "der"), 17, 72, 24, 99),
        z(ll("remolque", 2, "der"), 10, 72, 17, 99),
        z(ll("remolque", 3, "der"), 3, 72, 10, 99),
      ],
    },
  },
  INTERNATIONAL: {
    frente: {
      src: internationalFrente,
      ancho: 218,
      alto: 398,
      zonas: [
        z("cabina", 18, 42, 82, 60),
        z("radiador", 30, 70, 70, 87),
        z("parachoques", 6, 87, 94, 95),
        z("luz-del-der", 8, 80, 22, 85),
        z("luz-del-izq", 78, 80, 92, 85),
        z("espejo-der", 0, 46, 9, 62),
        z("espejo-izq", 91, 46, 100, 62),
        z(ll("del", 1, "der"), 7, 95, 18, 100),
        z(ll("del", 1, "izq"), 82, 95, 93, 100),
      ],
    },
    izquierda: {
      src: internationalIzq,
      ancho: 793,
      alto: 402,
      zonas: [
        z("plataforma", 29, 2, 99, 66),
        z("cabina", 11, 40, 40, 77),
        z("motor", 3, 60, 20, 73),
        z("radiador", 1, 66, 8, 88),
        z("parachoques", 1, 85, 14, 95),
        z("luz-del-izq", 10, 80, 14, 86),
        z("espejo-izq", 9.5, 40, 11.5, 56),
        z("baterias", 20, 80, 29, 90),
        z("tanque", 29, 75, 40, 86),
        z(ll("del", 1, "izq"), 14, 80, 22, 99),
        z(ll("traccion", 1, "izq"), 43, 70, 50, 89),
        z(ll("traccion", 2, "izq"), 50, 68, 57, 86),
        z(ll("remolque", 1, "izq"), 77, 55, 83, 73),
        z(ll("remolque", 2, "izq"), 83.5, 53, 90, 70),
        z(ll("remolque", 3, "izq"), 90.5, 51, 97, 68),
      ],
    },
    derecha: {
      src: internationalDer,
      ancho: 1084,
      alto: 290,
      zonas: [
        z("plataforma", 0, 3, 66, 74),
        z("cabina", 70, 20, 89, 80),
        z("motor", 89, 44, 99, 74),
        z("parachoques", 97, 70, 100, 84),
        z("espejo-der", 86.5, 36, 89, 52),
        z("tanque-der", 79, 72, 88, 86),
        z("luz-tras-der", 0, 66, 2, 74),
        z(ll("del", 1, "der"), 89, 72, 97, 99),
        z(ll("traccion", 1, "der"), 61, 72, 69, 99),
        z(ll("traccion", 2, "der"), 54, 72, 61, 99),
        z(ll("remolque", 1, "der"), 17, 72, 24, 99),
        z(ll("remolque", 2, "der"), 10, 72, 17, 99),
        z(ll("remolque", 3, "der"), 2.5, 72, 10, 99),
      ],
    },
  },
  SHACMAN: {
    frente: {
      src: shacmanFrente,
      ancho: 592,
      alto: 674,
      zonas: [
        z("cabina", 9, 18, 91, 46),
        z("radiador", 21, 52, 79, 66),
        z("parachoques", 8, 70, 92, 92),
        z("luz-del-der", 10, 74, 22, 86),
        z("luz-del-izq", 78, 74, 90, 86),
        z("espejo-der", 0, 22, 10, 48),
        z("espejo-izq", 90, 22, 100, 48),
        z(ll("del", 1, "der"), 10, 92, 22, 100),
        z(ll("del", 1, "izq"), 78, 92, 90, 100),
      ],
    },
    izquierda: {
      src: shacmanIzq,
      ancho: 1400,
      alto: 474,
      zonas: [
        z("cabina", 0, 0, 20, 70),
        z("plataforma", 29, 20, 99, 72),
        z("espejo-izq", 2, 20, 5, 46),
        z("luz-del-izq", 0, 62, 3, 74),
        z("tanque", 20, 72, 30, 88),
        z(ll("del", 1, "izq"), 8, 70, 17, 100),
        z(ll("traccion", 1, "izq"), 31, 70, 40, 100),
        z(ll("traccion", 2, "izq"), 41, 70, 50, 100),
        z(ll("remolque", 1, "izq"), 69, 70, 78, 100),
        z(ll("remolque", 2, "izq"), 79, 70, 88, 100),
        z(ll("remolque", 3, "izq"), 88.5, 70, 97.5, 100),
      ],
    },
    derecha: {
      src: shacmanDer,
      ancho: 1400,
      alto: 390,
      zonas: [
        z("cabina", 80, 0, 99, 72),
        z("plataforma", 0, 18, 75, 70),
        z("espejo-der", 94, 18, 99, 40),
        z("parachoques", 97, 68, 100, 82),
        z("tanque-der", 72, 70, 80, 86),
        z("luz-tras-der", 0, 60, 2, 70),
        z(ll("del", 1, "der"), 85, 70, 95, 100),
        z(ll("traccion", 1, "der"), 63, 72, 72, 100),
        z(ll("traccion", 2, "der"), 54, 72, 63, 100),
        z(ll("remolque", 1, "der"), 20, 72, 30, 100),
        z(ll("remolque", 2, "der"), 10, 72, 20, 100),
        z(ll("remolque", 3, "der"), 1.5, 72, 10, 100),
      ],
    },
  },
  VOLVO: {
    frente: {
      src: volvoFrente,
      ancho: 560,
      alto: 735,
      zonas: [
        z("cabina", 18, 30, 82, 46),
        z("radiador", 26, 51, 74, 70),
        z("parachoques", 4, 74, 96, 85),
        z("luz-del-der", 8, 61, 18, 70),
        z("luz-del-izq", 82, 61, 92, 70),
        z("espejo-der", 0, 30, 6, 46),
        z("espejo-izq", 94, 30, 100, 46),
        z(ll("del", 1, "der"), 8, 86, 20, 100),
        z(ll("del", 1, "izq"), 80, 86, 92, 100),
      ],
    },
    izquierda: {
      src: volvoIzq,
      ancho: 1400,
      alto: 624,
      zonas: [
        z("plataforma", 35, 0, 100, 72),
        z("cabina", 17, 26, 35, 66),
        z("motor", 1, 44, 17, 68),
        z("parachoques", 0, 72, 3, 82),
        z("espejo-izq", 21, 30, 25, 46),
        z("tanque", 20, 72, 37, 88),
        z(ll("del", 1, "izq"), 4, 72, 18, 100),
        z(ll("traccion", 1, "izq"), 60, 72, 75, 100),
        z(ll("traccion", 2, "izq"), 75, 72, 89, 100),
      ],
    },
    derecha: {
      src: volvoDer,
      ancho: 1400,
      alto: 585,
      zonas: [
        z("plataforma", 0, 0, 65, 70),
        z("cabina", 66, 20, 80, 66),
        z("motor", 80, 42, 99, 68),
        z("parachoques", 97, 70, 100, 85),
        z("espejo-der", 76, 26, 79, 44),
        z("tanque-der", 66, 72, 80, 88),
        z("luz-tras-der", 0, 66, 3, 74),
        z(ll("del", 1, "der"), 84, 72, 97, 100),
        z(ll("traccion", 1, "der"), 28, 72, 42, 100),
        z(ll("traccion", 2, "der"), 11, 72, 25, 100),
      ],
    },
  },
};

/** La mula de mantenimiento (Peterbilt) para las marcas sin render. */
const GENERICA: ImagenesMarca = {
  frente: {
    src: peterbiltFrente,
    ancho: 206,
    alto: 295,
    papel: true,
    zonas: [
      z("cabina", 19, 33, 79, 49),
      z("radiador", 28, 49, 59, 81),
      z("parachoques", 1, 81.5, 99, 97),
      z("luz-del-der", 1, 67, 22, 75),
      z("luz-del-izq", 76, 67, 99, 75),
      z("espejo-der", 2, 33, 12, 53),
      z("espejo-izq", 80, 33, 90, 53),
    ],
  },
  izquierda: {
    src: peterbiltLado,
    ancho: 504,
    alto: 287,
    papel: true,
    zonas: [
      z("cabina", 22, 28, 59, 77.5),
      z("motor", 3.5, 51, 22, 72),
      z("radiador", 0.5, 52, 3.5, 74),
      z("parachoques", 0.5, 78.5, 4, 96),
      z("luz-del-izq", 3, 69.5, 7.5, 75.5),
      z("espejo-izq", 28.5, 35.5, 33, 53),
      z(ll("del", 1, "izq"), 7.5, 72, 23.5, 100),
      z("baterias", 25.5, 78, 40, 96),
      z("tanque", 40, 78, 62.5, 96),
      z("chasis-izq", 62.5, 75, 64.7, 92),
      z("quinta-rueda", 72, 68.5, 88, 73),
      z(ll("traccion", 1, "izq"), 64.7, 73.5, 77.6, 100),
      z(ll("traccion", 2, "izq"), 78.5, 73.5, 92.3, 100),
    ],
  },
};

/** Imagenes de la marca, o la mula generica si no hay. */
export function imagenesDe(marca: string | null | undefined): ImagenesMarca {
  const m = String(marca ?? "").toUpperCase();
  const clave = Object.keys(MARCAS).find((k) => m.includes(k));
  return clave ? MARCAS[clave] : GENERICA;
}

/** La misma parte del otro lado (para la imagen en espejo). */
function otroLado(parte: Zona["parte"]): Zona["parte"] {
  if (typeof parte !== "string") return { ...parte, lado: parte.lado === "izq" ? "der" : "izq" };
  if (parte === "tanque") return "tanque-der";
  if (parte === "tanque-der") return "tanque";
  if (parte.endsWith("-izq")) return parte.replace(/-izq$/, "-der");
  if (parte.endsWith("-der")) return parte.replace(/-der$/, "-izq");
  return parte;
}

/** Zonas de la imagen volteada horizontalmente. */
export function zonasEnEspejo(zonas: Zona[]): Zona[] {
  return zonas.map((zn) => ({ ...zn, parte: otroLado(zn.parte), x: 100 - zn.x - zn.w }));
}

/** La imagen del otro costado: la misma en espejo, con las zonas volteadas. */
function espejo(im: Imagen): Imagen & { espejo: true } {
  return { ...im, zonas: zonasEnEspejo(im.zonas), espejo: true };
}

/** Las tres vistas del camion de la marca: izquierda, frente y derecha. */
export function vistasDe(marca: string | null | undefined): Vista[] {
  const f = imagenesDe(marca);
  const comoVista = (im: Imagen) => ({ espejo: false, ...im });
  const izquierda = f.izquierda ? comoVista(f.izquierda) : f.derecha ? espejo(f.derecha) : null;
  const derecha = f.derecha ? comoVista(f.derecha) : f.izquierda ? espejo(f.izquierda) : null;
  return [
    ...(izquierda ? [{ ...izquierda, id: "izquierda" as const, nombre: "Izquierda" }] : []),
    { ...comoVista(f.frente), id: "frente" as const, nombre: "Frente" },
    ...(derecha ? [{ ...derecha, id: "derecha" as const, nombre: "Derecha" }] : []),
  ];
}

/** Id de la parte de una zona para el vehiculo; null si su configuracion no la tiene (p. ej. un segundo eje de traccion). */
export function parteDeZona(parte: Zona["parte"], configuracion: string | null): string | null {
  if (typeof parte === "string") return parte;
  const { tracto, remolque } = ejesDe(configuracion);
  const traseros = tracto - 1;
  if (parte.grupo === "del") return parte.lado === "izq" ? "llanta-1" : "llanta-2";
  if (parte.grupo === "traccion" && parte.n > traseros) return null;
  if (parte.grupo === "remolque" && parte.n > remolque) return null;
  const eje = parte.grupo === "traccion" ? parte.n : traseros + parte.n;
  const base = 2 + (eje - 1) * 4;
  return `llanta-${base + (parte.lado === "izq" ? 1 : 4)}`;
}
