/**
 * Piezas comunes de las tarjetas del Inicio: el marco (encabezado con titulo
 * y acciones, y un cuerpo que se desplaza si no cabe) y el esqueleto de carga.
 */
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

/** Tarjeta con encabezado (icono, titulo y acciones) y un cuerpo que se desplaza si no cabe. */
export function Marco({ titulo, icono, acciones, children }: { titulo: string; icono?: ReactNode; acciones?: ReactNode; children: ReactNode }) {
  return (
    <section className="tarjeta-inicio">
      <header className="tarjeta-inicio-cabeza">
        <h2 className="titulo-tarjeta">
          {icono}
          {titulo}
        </h2>
        {acciones}
      </header>
      <div className="tarjeta-inicio-cuerpo">{children}</div>
    </section>
  );
}

/** Esqueleto gris mientras llegan los datos. */
export function Esqueleto({ filas = 3 }: { filas?: number }) {
  return (
    <div className="esqueleto esqueleto-tarjeta" role="status">
      <span className="solo-lector">Cargando...</span>
      {Array.from({ length: filas }, (_, i) => (
        <span key={i} className="esqueleto-fila" style={{ width: `${[88, 72, 80, 64][i % 4]}%`, animationDelay: `${i * 80}ms` }} />
      ))}
    </div>
  );
}

/** Boton del encabezado que lleva a la pantalla completa. */
export function BotonIr({ ruta, texto = "Ver todo" }: { ruta: string; texto?: string }) {
  const navegar = useNavigate();
  return (
    <button className="boton-suave" onClick={() => navegar(ruta)}>
      {texto}
    </button>
  );
}

/** Error dentro de una tarjeta, con reintentar (no tumba el resto del Inicio). */
export function ErrorTarjeta({ mensaje, alReintentar }: { mensaje: string; alReintentar: () => void }) {
  return (
    <div className="tarjeta-inicio-error">
      <span className="texto-vencido">{mensaje}</span>
      <button className="btn-link" onClick={alReintentar}>
        Reintentar
      </button>
    </div>
  );
}
