/**
 * Altura de una tabla para que quepa en la pantalla sin bajar la pagina: asi
 * su barra de desplazamiento horizontal queda siempre a la vista (antes estaba
 * al final de todas las filas).
 */
import { useCallback, useEffect, useRef } from "react";

/** En el celular las tablas se ven como tarjetas: no se limita la altura. */
const ES_CELULAR = "(max-width: 820px)";
/** Lo minimo que se le deja a la tabla aunque haya mucho contenido encima. */
const MINIMO = 260;

/**
 * Devuelve una ref para el contenedor con scroll de la tabla. Le pone de
 * altura maxima lo que queda de pantalla desde donde empieza la tabla (con la
 * pagina arriba del todo), menos `reserva` px para lo que va debajo (la
 * paginacion, el margen). Se recalcula al cambiar el tamano de la ventana o
 * cuando cambia lo que hay encima (un aviso que aparece, filtros...).
 */
export function useAltoTabla<T extends HTMLElement>(reserva = 80) {
  const elemento = useRef<T | null>(null);

  const calcular = useCallback(() => {
    const el = elemento.current;
    if (!el) return;
    if (window.matchMedia(ES_CELULAR).matches) {
      el.style.maxHeight = "";
      return;
    }
    // Posicion en la pagina (no en la pantalla): no depende de cuanto se haya bajado.
    const inicio = el.getBoundingClientRect().top + window.scrollY;
    const alto = Math.max(MINIMO, Math.floor(window.innerHeight - inicio - reserva));
    const nuevo = `${alto}px`;
    if (el.style.maxHeight !== nuevo) el.style.maxHeight = nuevo;
  }, [reserva]);

  useEffect(() => {
    calcular();
    window.addEventListener("resize", calcular);
    // Lo que cambia encima de la tabla (avisos, barras) mueve donde empieza.
    const observador = new ResizeObserver(() => calcular());
    observador.observe(document.body);
    return () => {
      window.removeEventListener("resize", calcular);
      observador.disconnect();
    };
  }, [calcular]);

  return elemento;
}
