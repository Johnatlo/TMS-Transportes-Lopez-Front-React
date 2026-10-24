/**
 * Menu "Más": agrupa las acciones que se usan poco para que la barra no se
 * llene de botones. Se abre con clic; un clic afuera, Escape o elegir una
 * opcion lo cierran.
 */
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/** Una opcion del menu. */
export interface OpcionMenu {
  etiqueta: ReactNode;
  alElegir: () => void;
  /** Marca la opcion como la elegida (por ejemplo, la pestana activa). */
  activa?: boolean;
  deshabilitada?: boolean;
  /** Texto a la derecha (un contador). */
  extra?: ReactNode;
}

/** Boton con su lista desplegable. */
export default function MenuMas({
  opciones,
  etiqueta = "Más",
  clase = "boton-barra",
  activo = false,
}: {
  opciones: OpcionMenu[];
  /** Texto del boton (por defecto "Más"). */
  etiqueta?: ReactNode;
  /** Clase del boton, para que se vea como los de su barra. */
  clase?: string;
  /** Resalta el boton (ej. la pestana activa esta adentro). */
  activo?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => caja.current && !caja.current.contains(e.target as Node) && setAbierto(false);
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("mousedown", fuera);
    window.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fuera);
      window.removeEventListener("keydown", tecla);
    };
  }, [abierto]);

  if (opciones.length === 0) return null;
  return (
    <div className="menu-mas" ref={caja}>
      <button
        type="button"
        className={`${clase} ${activo ? "activa activo" : ""}`}
        aria-haspopup="menu"
        aria-expanded={abierto}
        onClick={() => setAbierto(!abierto)}
      >
        {etiqueta} <span className="menu-mas-flecha">▾</span>
      </button>
      {abierto && (
        <div className="menu-mas-lista" role="menu">
          {opciones.map((o, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              className={o.activa ? "activa" : ""}
              disabled={o.deshabilitada}
              onClick={() => {
                setAbierto(false);
                o.alElegir();
              }}
            >
              <span>{o.etiqueta}</span>
              {o.extra !== undefined && <span className="contador">{o.extra}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
