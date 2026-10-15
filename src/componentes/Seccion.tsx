import type { ReactNode } from "react";

/** Bloque con titulo (y, opcional, algo al lado del titulo) dentro de un detalle. */
export default function Seccion({ titulo, children, extra }: { titulo: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <section className="detalle-seccion">
      <h4>
        {titulo}
        {extra}
      </h4>
      {children}
    </section>
  );
}
