/**
 * Ventana de filtros de una tabla (TablaDatos), como en el ejemplo de
 * docs/filtros y comportamiento de las tablas ui.mp4: se abre a la derecha,
 * la pagina se pone gris detras, y cada filtro es una lista de seleccion
 * multiple con "chips". Los cambios se aplican con "Filtrar"; "Limpiar"
 * quita todos. Escape o clic afuera la cierran sin aplicar.
 */
import { useEffect, useMemo, useRef, useState } from "react";

/** Un filtro: la columna y los valores que se pueden elegir. */
export interface FiltroColumna {
  id: string;
  titulo: string;
  opciones: string[];
}

/** Valores elegidos por columna (vacio = sin filtro). */
export type ValoresFiltro = Record<string, string[]>;

/** Ventana de filtros. */
export default function FiltrosTabla({
  filtros,
  valores,
  alAplicar,
  alCerrar,
}: {
  filtros: FiltroColumna[];
  valores: ValoresFiltro;
  alAplicar: (v: ValoresFiltro) => void;
  alCerrar: () => void;
}) {
  // Borrador: no toca la tabla hasta "Filtrar".
  const [borrador, setBorrador] = useState<ValoresFiltro>(valores);
  const [cerrando, setCerrando] = useState(false);

  /** Cierra con la animacion de salida. */
  const cerrar = (despues?: () => void) => {
    setCerrando(true);
    window.setTimeout(() => {
      despues?.();
      alCerrar();
    }, 160);
  };

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && cerrar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activos = Object.values(borrador).reduce((s, v) => s + (v?.length ? 1 : 0), 0);

  return (
    <div className={`filtros-capa ${cerrando ? "saliendo" : ""}`} onMouseDown={(e) => e.target === e.currentTarget && cerrar()}>
      <aside className="filtros-panel" role="dialog" aria-label="Filtros">
        <header className="filtros-cabecera">
          <h3>Filtros</h3>
          <button className="boton-suave" onClick={() => cerrar()}>
            Cerrar
          </button>
        </header>
        <div className="filtros-cuerpo">
          <p className="dato-sec">Elige uno o varios valores por campo. La tabla muestra solo las filas que cumplen todos los filtros.</p>
          {filtros.map((f) => (
            <SeleccionMultiple
              key={f.id}
              titulo={f.titulo}
              opciones={f.opciones}
              elegidos={borrador[f.id] ?? []}
              alCambiar={(v) => setBorrador({ ...borrador, [f.id]: v })}
            />
          ))}
        </div>
        <footer className="filtros-pie">
          <button className="btn-primary" onClick={() => cerrar(() => alAplicar(borrador))}>
            Filtrar{activos ? ` (${activos})` : ""}
          </button>
          <button
            className="boton-suave"
            onClick={() => {
              setBorrador({});
              cerrar(() => alAplicar({}));
            }}
          >
            Limpiar
          </button>
        </footer>
      </aside>
    </div>
  );
}

/**
 * Lista de seleccion multiple: muestra los elegidos como chips (con x para
 * quitarlos) y, al abrirla, las opciones con casillas y un buscador si son
 * muchas.
 */
function SeleccionMultiple({
  titulo,
  opciones,
  elegidos,
  alCambiar,
}: {
  titulo: string;
  opciones: string[];
  elegidos: string[];
  alCambiar: (v: string[]) => void;
}) {
  const [abierta, setAbierta] = useState(false);
  const [buscar, setBuscar] = useState("");
  const caja = useRef<HTMLDivElement>(null);

  // Clic fuera de la lista la cierra.
  useEffect(() => {
    if (!abierta) return;
    const fuera = (e: MouseEvent) => caja.current && !caja.current.contains(e.target as Node) && setAbierta(false);
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierta]);

  const visibles = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return q ? opciones.filter((o) => o.toLowerCase().includes(q)) : opciones;
  }, [opciones, buscar]);
  const alternar = (o: string) => alCambiar(elegidos.includes(o) ? elegidos.filter((x) => x !== o) : [...elegidos, o]);

  return (
    <div className="filtro-campo" ref={caja}>
      <label>{titulo}</label>
      <div className={`filtro-selector ${abierta ? "abierto" : ""}`} onClick={() => setAbierta(!abierta)} role="button" tabIndex={0}>
        {elegidos.length === 0 ? (
          <span className="dato-sec">Todos</span>
        ) : (
          elegidos.map((e) => (
            <span key={e} className="filtro-chip">
              {e}
              <button
                type="button"
                aria-label={`Quitar ${e}`}
                onClick={(ev) => {
                  ev.stopPropagation();
                  alternar(e);
                }}
              >
                ×
              </button>
            </span>
          ))
        )}
        <span className="filtro-flecha">▾</span>
      </div>
      {abierta && (
        <div className="filtro-lista">
          {opciones.length > 8 && (
            <input className="filtro-buscar" autoFocus placeholder="Buscar..." value={buscar} onChange={(e) => setBuscar(e.target.value)} />
          )}
          {visibles.map((o) => (
            <label key={o} className="filtro-opcion">
              <input type="checkbox" checked={elegidos.includes(o)} onChange={() => alternar(o)} />
              <span>{o}</span>
            </label>
          ))}
          {visibles.length === 0 && <div className="dato-sec" style={{ padding: "0.4rem 0.6rem" }}>Sin coincidencias.</div>}
        </div>
      )}
    </div>
  );
}
