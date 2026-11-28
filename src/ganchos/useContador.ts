/**
 * Cifra que "cuenta" hasta su valor al aparecer o al cambiar (Inicio y
 * tarjetas de indicadores).
 */
import { useEffect, useRef, useState } from "react";

/** Si el computador pide reducir el movimiento (o no hay matchMedia, como en las pruebas). */
function sinMovimiento(): boolean {
  return typeof window === "undefined" || typeof window.matchMedia !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Devuelve el numero que se muestra mientras sube (o baja) desde el valor
 * anterior hasta `valor` en `ms` milisegundos, frenando al final. Sin
 * animacion si se pide reducir el movimiento. Los decimales se redondean
 * como el valor final (enteros si el valor es entero).
 */
export function useContador(valor: number, ms = 700): number {
  const [visto, setVisto] = useState(() => (sinMovimiento() ? valor : 0));
  const desde = useRef(visto);
  useEffect(() => {
    if (sinMovimiento() || !Number.isFinite(valor)) {
      desde.current = valor;
      setVisto(valor);
      return;
    }
    const inicio = performance.now();
    const origen = desde.current;
    const entero = Number.isInteger(valor);
    let cuadro = 0;
    const paso = (t: number) => {
      const f = Math.min(1, (t - inicio) / ms);
      const suave = 1 - Math.pow(1 - f, 3);
      const n = origen + (valor - origen) * suave;
      desde.current = n;
      setVisto(f >= 1 ? valor : entero ? Math.round(n) : n);
      if (f < 1) cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [valor, ms]);
  return visto;
}
