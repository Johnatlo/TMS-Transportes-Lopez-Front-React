/**
 * Clics que no deben cerrar una lista abierta: los que caen en una barra de
 * desplazamiento (la de la pagina o la de una ventana). Quien no tiene rueda
 * en el raton arrastra esa barra para bajar y ver la lista; si eso la cerrara,
 * no podria llegar a las opciones de abajo.
 */

/** true si el clic cayo en la barra de desplazamiento de la pagina o de un elemento con scroll. */
export function esClicEnBarra(e: MouseEvent): boolean {
  const raiz = document.documentElement;
  // La barra de la pagina: el clic queda fuera del area visible del documento.
  if (e.target === raiz || e.clientX >= raiz.clientWidth || e.clientY >= raiz.clientHeight) return true;
  // La barra de un elemento con scroll (una ventana, una tabla): el clic cae fuera de su contenido.
  const el = e.target as HTMLElement | null;
  if (!el || !(el instanceof HTMLElement)) return false;
  const r = el.getBoundingClientRect();
  const dentroX = e.clientX - r.left - el.clientLeft;
  const dentroY = e.clientY - r.top - el.clientTop;
  return (el.scrollHeight > el.clientHeight && dentroX >= el.clientWidth) || (el.scrollWidth > el.clientWidth && dentroY >= el.clientHeight);
}
