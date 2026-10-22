/**
 * Campo de fecha que guarda solo (en tablas y detalles, sin boton Guardar).
 *
 * Un <input type="date"> avisa en cada tecla: al escribir el año pasa por
 * "0002", "0020", "0202" antes de "2026". Si cada cambio se guardaba, se
 * guardaban fechas a medias y la pantalla se refrescaba mientras se escribia
 * (el campo "se portaba extraño"). Aqui:
 * - lo escrito se queda en el campo (no lo pisa el refresco mientras se edita);
 * - guarda al salir del campo, o solo un momento despues si la fecha esta
 *   completa (lo que pasa al elegirla en el calendario);
 * - nunca guarda un año a medias (fuera de 2000-2100); vacio si se guarda
 *   (quita la fecha).
 */
import { useEffect, useRef, useState } from "react";

/** Espera tras el ultimo cambio antes de guardar una fecha completa. */
const ESPERA_MS = 800;

/** "AAAA-MM-DD" con un año de verdad; "" (quitar la fecha) tambien vale. */
export const fechaCompleta = (v: string) => v === "" || (/^\d{4}-\d{2}-\d{2}$/.test(v) && Number(v.slice(0, 4)) >= 2000 && Number(v.slice(0, 4)) <= 2100);

/** Campo de fecha que guarda solo, sin guardar fechas a medias (ver arriba). */
export default function CampoFecha({
  valor,
  alGuardar,
  className,
  disabled,
}: {
  valor: string | null;
  /** Se llama con la fecha nueva ("" para quitarla) cuando cambia de verdad. */
  alGuardar: (fecha: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  const [texto, setTexto] = useState(valor ?? "");
  const editando = useRef(false);
  const reloj = useRef<number | null>(null);
  const guardado = useRef(valor ?? "");

  // Si el valor cambia desde afuera (se guardo, se recargo), se muestra; no mientras se escribe.
  useEffect(() => {
    guardado.current = valor ?? "";
    if (!editando.current) setTexto(valor ?? "");
  }, [valor]);

  useEffect(() => () => {
    if (reloj.current) window.clearTimeout(reloj.current);
  }, []);

  const guardar = (v: string) => {
    if (reloj.current) window.clearTimeout(reloj.current);
    reloj.current = null;
    if (!fechaCompleta(v) || v === guardado.current) return;
    guardado.current = v;
    alGuardar(v);
  };

  return (
    <input
      type="date"
      className={className}
      disabled={disabled}
      value={texto}
      onClick={(e) => e.stopPropagation()}
      onFocus={() => (editando.current = true)}
      onChange={(e) => {
        const v = e.target.value;
        setTexto(v);
        if (reloj.current) window.clearTimeout(reloj.current);
        if (v !== "" && fechaCompleta(v)) reloj.current = window.setTimeout(() => guardar(v), ESPERA_MS);
      }}
      onBlur={(e) => {
        editando.current = false;
        guardar(e.target.value);
        // Si quedo a medias, vuelve a lo guardado.
        if (!fechaCompleta(e.target.value)) setTexto(guardado.current);
      }}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}
