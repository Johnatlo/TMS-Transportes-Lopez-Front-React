/**
 * Modo de la pantalla: claro u oscuro (tema.css define los colores de cada uno
 * sobre el atributo data-tema de <html>).
 *
 * Por defecto es AUTOMATICO segun la hora de Colombia: de dia (5:00 a.m. a
 * 4:59 p.m.) claro y de noche (5:00 p.m. a 4:59 a.m.) oscuro. El cambio pasa
 * solo, aunque la aplicacion este abierta. El login siempre va en automatico.
 *
 * Cada usuario puede fijar uno con el boton sol/luna (o volver a automatico
 * desde su menu): se guarda en su usuario (PUT /auth/preferencias) y lo sigue
 * a cualquier computador. El navegador recuerda la ultima eleccion para pintar
 * bien desde el primer instante (index.html usa la misma clave y la misma regla).
 */
import { useEffect, useState } from "react";

/** Los dos modos que se ven. */
export type Tema = "oscuro" | "claro";
/** Lo que elige el usuario: un modo fijo o automatico por la hora. */
export type PreferenciaTema = Tema | "auto";

/** Clave en el navegador (la misma que lee index.html). */
export const CLAVE_TEMA = "sofi-tema";
/** Hora (de Colombia) en que empieza el dia y en que empieza la noche. */
export const HORA_DIA = 5;
export const HORA_NOCHE = 17;

/** Aviso a la aplicacion de que cambio el modo. */
const EVENTO_TEMA = "sofi:tema";

/** El texto si es un modo fijo valido; si no, null. */
export const temaValido = (t: unknown): Tema | null => (t === "oscuro" || t === "claro" ? t : null);

/** La preferencia guardada; cualquier otra cosa (o nada) es automatico. */
export const preferenciaValida = (p: unknown): PreferenciaTema => temaValido(p) ?? "auto";

/** El otro modo (lo que hace el boton sol/luna). */
export const otroTema = (t: Tema): Tema => (t === "oscuro" ? "claro" : "oscuro");

/** Hora (0 a 23) en Colombia, sin importar la zona del computador. */
export function horaColombia(fecha: Date): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Bogota", hour: "numeric", hourCycle: "h23" }).format(fecha)) % 24;
}

/** El modo que toca a esa hora: claro de 5 a.m. a 5 p.m., oscuro el resto. */
export const temaPorHora = (fecha: Date): Tema => {
  const h = horaColombia(fecha);
  return h >= HORA_DIA && h < HORA_NOCHE ? "claro" : "oscuro";
};

/** El modo que se ve con una preferencia, en ese momento. */
export const temaDe = (p: PreferenciaTema, fecha = new Date()): Tema => (p === "auto" ? temaPorHora(fecha) : p);

/** Lo que eligio el usuario (o automatico). */
export function preferenciaActual(): PreferenciaTema {
  return preferenciaValida(document.documentElement.dataset.preferenciaTema);
}

/** El modo que se ve ahora. */
export function temaActual(): Tema {
  return temaValido(document.documentElement.dataset.tema) ?? temaDe(preferenciaActual());
}

/** Pinta la aplicacion con esa preferencia y la recuerda en este navegador. */
export function aplicarPreferencia(p: PreferenciaTema): void {
  const raiz = document.documentElement;
  raiz.dataset.preferenciaTema = p;
  raiz.dataset.tema = temaDe(p);
  try {
    localStorage.setItem(CLAVE_TEMA, p);
  } catch {
    // Navegador sin almacenamiento (modo privado): igual queda pintado.
  }
  window.dispatchEvent(new CustomEvent(EVENTO_TEMA));
}

/**
 * Pinta en automatico (por la hora) SIN cambiar lo que recuerda el navegador:
 * lo usa el login, que siempre va con el dia y la noche.
 */
export function pintarAutomatico(): void {
  const raiz = document.documentElement;
  raiz.dataset.preferenciaTema = "auto";
  raiz.dataset.tema = temaPorHora(new Date());
  window.dispatchEvent(new CustomEvent(EVENTO_TEMA));
}

/** En automatico, revisa la hora cada minuto: a las 5 cambia solo. */
function vigilarHora(): () => void {
  const id = window.setInterval(() => {
    const raiz = document.documentElement;
    if (preferenciaActual() !== "auto") return;
    const toca = temaPorHora(new Date());
    if (raiz.dataset.tema !== toca) {
      raiz.dataset.tema = toca;
      window.dispatchEvent(new CustomEvent(EVENTO_TEMA));
    }
  }, 60_000);
  return () => window.clearInterval(id);
}

/** El modo que se ve y la preferencia; se vuelve a pintar cuando cambian (o cuando llega la hora). */
export function useTema(): { tema: Tema; preferencia: PreferenciaTema } {
  const leer = () => ({ tema: temaActual(), preferencia: preferenciaActual() });
  const [estado, setEstado] = useState(leer);
  useEffect(() => {
    const alCambiar = () => setEstado(leer());
    window.addEventListener(EVENTO_TEMA, alCambiar);
    const parar = vigilarHora();
    return () => {
      window.removeEventListener(EVENTO_TEMA, alCambiar);
      parar();
    };
  }, []);
  return estado;
}
