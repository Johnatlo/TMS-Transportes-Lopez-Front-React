import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

/**
 * Tabla de listados del sistema (ver GUIA-UI.md, "Tablas").
 *
 * Arriba: pestanas de estado con su contador, buscador, boton de filtros y
 * exportar. En el encabezado se ordena al hacer clic. Abajo, paginas de 50.
 *
 * Cada columna dice como pintarse (`celda`) y, aparte, su valor en texto
 * plano (`valor`): con ese se busca, se ordena, se filtra y se exporta, asi
 * que lo que se ve y lo que se compara pueden ser distintos (un monto con
 * formato se ordena por su numero).
 */
export interface Columna<T> {
  id: string;
  titulo: string;
  celda: (fila: T) => ReactNode;
  /** Valor para buscar, ordenar, filtrar y exportar. Sin el, la columna no participa. */
  valor?: (fila: T) => string | number | null | undefined;
  /** Ofrece un filtro con los valores distintos de la columna. */
  filtrable?: boolean;
  alinear?: "derecha";
  /** Clase de la celda (por ejemplo para la vista de tarjetas en el celular). */
  claseCelda?: string | ((fila: T) => string);
  /** Titulo del dato en la vista de tarjetas. null = sin titulo. Por defecto, `titulo`. */
  etiquetaMovil?: string | null;
}

export interface PestanaTabla<T> {
  id: string;
  etiqueta: string;
  incluye: (fila: T) => boolean;
}

const POR_PAGINA = 50;

const texto = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function TablaDatos<T>({
  filas,
  columnas,
  clave,
  pestanas,
  pestanaInicial,
  nombreArchivo,
  placeholderBusqueda = "Buscar...",
  acciones,
  vacio = "Sin resultados.",
  claseTabla = "",
  alClicFila,
}: {
  filas: T[];
  columnas: Columna<T>[];
  clave: (fila: T) => string | number;
  pestanas?: PestanaTabla<T>[];
  pestanaInicial?: string;
  /** Si se da, aparece "Exportar" y descarga un CSV con lo filtrado. */
  nombreArchivo?: string;
  placeholderBusqueda?: string;
  /** Botones propios de la pantalla, a la derecha de la barra (ej. "+"). */
  acciones?: ReactNode;
  vacio?: string;
  claseTabla?: string;
  alClicFila?: (fila: T) => void;
}) {
  const [pestana, setPestana] = useState(pestanaInicial ?? pestanas?.[0]?.id ?? "");
  const [busqueda, setBusqueda] = useState("");
  const [verFiltros, setVerFiltros] = useState(false);
  const [filtros, setFiltros] = useState<Record<string, string>>({});
  const [orden, setOrden] = useState<{ id: string; asc: boolean } | null>(null);
  const [pagina, setPagina] = useState(0);

  // Cualquier cambio de criterio vuelve a la primera pagina.
  useEffect(() => setPagina(0), [pestana, busqueda, filtros, orden]);

  const conValor = columnas.filter((c) => c.valor);
  const filtrables = columnas.filter((c) => c.filtrable && c.valor);
  const filtrosActivos = Object.values(filtros).filter(Boolean).length;

  /** Filas de cada pestana, para los contadores. */
  const porPestana = useMemo(() => {
    const m = new Map<string, T[]>();
    for (const p of pestanas ?? []) m.set(p.id, filas.filter(p.incluye));
    return m;
  }, [filas, pestanas]);

  const base = pestanas ? porPestana.get(pestana) ?? filas : filas;

  /** Valores distintos de cada columna filtrable (dentro de la pestana actual). */
  const opcionesFiltro = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const c of filtrables) {
      const set = new Set(base.map((f) => texto(c.valor!(f))).filter(Boolean));
      m.set(c.id, [...set].sort((a, b) => a.localeCompare(b, "es")));
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, columnas]);

  const visibles = useMemo(() => {
    const q = sinTildes(busqueda.trim());
    let r = base.filter((f) =>
      Object.entries(filtros).every(([id, v]) => {
        if (!v) return true;
        const col = columnas.find((c) => c.id === id);
        return col?.valor ? texto(col.valor(f)) === v : true;
      })
    );
    if (q) r = r.filter((f) => conValor.some((c) => sinTildes(texto(c.valor!(f))).includes(q)));
    if (orden) {
      const col = columnas.find((c) => c.id === orden.id);
      if (col?.valor) {
        r = [...r].sort((a, b) => {
          const va = col.valor!(a);
          const vb = col.valor!(b);
          const cmp =
            typeof va === "number" && typeof vb === "number"
              ? va - vb
              : texto(va).localeCompare(texto(vb), "es", { numeric: true });
          return orden.asc ? cmp : -cmp;
        });
      }
    }
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, busqueda, filtros, orden, columnas]);

  const paginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, paginas - 1);
  const desde = paginaActual * POR_PAGINA;
  const enPagina = visibles.slice(desde, desde + POR_PAGINA);

  function ordenarPor(c: Columna<T>) {
    if (!c.valor) return;
    setOrden((o) => (o?.id !== c.id ? { id: c.id, asc: true } : o.asc ? { id: c.id, asc: false } : null));
  }

  function exportar() {
    const cols = conValor;
    const campo = (v: unknown) => `"${texto(v).replace(/"/g, '""')}"`;
    const lineas = [
      cols.map((c) => campo(c.titulo)).join(";"),
      ...visibles.map((f) => cols.map((c) => campo(c.valor!(f))).join(";")),
    ];
    // BOM para que Excel abra bien las tildes; ";" es el separador de Excel en espanol.
    const blob = new Blob(["﻿" + lineas.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nombreArchivo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const clase = (c: Columna<T>, f: T) =>
    [typeof c.claseCelda === "function" ? c.claseCelda(f) : c.claseCelda, c.alinear === "derecha" ? "num" : ""]
      .filter(Boolean)
      .join(" ");

  return (
    <div className="tabla-datos">
      <div className="tabla-barra">
        {pestanas && (
          <div className="tabla-pestanas" role="tablist">
            {pestanas.map((p) => (
              <button
                key={p.id}
                role="tab"
                aria-selected={pestana === p.id}
                className={pestana === p.id ? "activa" : ""}
                onClick={() => setPestana(p.id)}
              >
                {p.etiqueta}
                <span className="contador">{porPestana.get(p.id)?.length ?? 0}</span>
              </button>
            ))}
          </div>
        )}
        <div className="tabla-herramientas">
          <input
            className="tabla-buscar"
            type="search"
            placeholder={placeholderBusqueda}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          {filtrables.length > 0 && (
            <button
              type="button"
              className={`boton-barra ${verFiltros || filtrosActivos ? "activo" : ""}`}
              onClick={() => setVerFiltros(!verFiltros)}
            >
              <IconoFiltro /> Filtros{filtrosActivos ? ` (${filtrosActivos})` : ""}
            </button>
          )}
          {nombreArchivo && (
            <button type="button" className="boton-barra" onClick={exportar} disabled={visibles.length === 0}>
              <IconoExportar /> Exportar
            </button>
          )}
          {acciones}
        </div>
      </div>

      {verFiltros && filtrables.length > 0 && (
        <div className="tabla-filtros">
          {filtrables.map((c) => (
            <label key={c.id}>
              <span>{c.titulo}</span>
              <select
                value={filtros[c.id] ?? ""}
                onChange={(e) => setFiltros({ ...filtros, [c.id]: e.target.value })}
              >
                <option value="">Todos</option>
                {(opcionesFiltro.get(c.id) ?? []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
          ))}
          {filtrosActivos > 0 && (
            <button type="button" className="btn-link" onClick={() => setFiltros({})}>
              Quitar filtros
            </button>
          )}
        </div>
      )}

      <div className="tabla-scroll">
        <table className={`tabla ${claseTabla}`}>
          <thead>
            <tr>
              {columnas.map((c) => (
                <th
                  key={c.id}
                  className={[c.valor ? "ordenable" : "", c.alinear === "derecha" ? "num" : ""].join(" ")}
                  onClick={() => ordenarPor(c)}
                  aria-sort={orden?.id === c.id ? (orden.asc ? "ascending" : "descending") : undefined}
                >
                  {c.titulo}
                  {orden?.id === c.id && <span className="flecha-orden">{orden.asc ? "↑" : "↓"}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {enPagina.map((f) => (
              <tr
                key={clave(f)}
                className={alClicFila ? "fila-clic" : undefined}
                onClick={alClicFila ? () => alClicFila(f) : undefined}
              >
                {columnas.map((c) => {
                  const etiqueta = c.etiquetaMovil === undefined ? c.titulo : c.etiquetaMovil;
                  return (
                    <td key={c.id} className={clase(c, f)} data-label={etiqueta || undefined}>
                      {c.celda(f)}
                    </td>
                  );
                })}
              </tr>
            ))}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={columnas.length} className="empty-row">
                  {vacio}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Paginacion
        total={visibles.length}
        desde={desde}
        hasta={desde + enPagina.length}
        pagina={paginaActual}
        paginas={paginas}
        alCambiar={setPagina}
      />
    </div>
  );
}

/** "1-50 de 312" y los botones de pagina. Tambien la usan tablas que no son TablaDatos. */
export function Paginacion({
  total,
  desde,
  hasta,
  pagina,
  paginas,
  alCambiar,
}: {
  total: number;
  desde: number;
  hasta: number;
  pagina: number;
  paginas: number;
  alCambiar: (p: number) => void;
}) {
  const pie = useRef<HTMLDivElement>(null);
  if (total === 0) return null;
  /** Al cambiar de pagina se vuelve al comienzo de la tabla. */
  const ir = (p: number) => {
    alCambiar(p);
    const tabla = pie.current?.parentElement?.querySelector("table") ?? pie.current?.parentElement;
    tabla?.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  // Paginas a la vista: la primera, la ultima y dos a cada lado de la actual.
  const numeros = [...new Set([0, paginas - 1, pagina - 1, pagina, pagina + 1])]
    .filter((p) => p >= 0 && p < paginas)
    .sort((a, b) => a - b);
  return (
    <div className="tabla-paginacion" ref={pie}>
      <span>
        {desde + 1}–{hasta} de {total}
      </span>
      {paginas > 1 && (
        <div className="tabla-paginas">
          <button type="button" onClick={() => ir(pagina - 1)} disabled={pagina === 0} aria-label="Pagina anterior">
            ‹
          </button>
          {numeros.map((p, i) => (
            <span key={p}>
              {i > 0 && p - numeros[i - 1] > 1 && <span className="puntos">…</span>}
              <button
                type="button"
                className={p === pagina ? "actual" : ""}
                onClick={() => ir(p)}
                aria-current={p === pagina ? "page" : undefined}
              >
                {p + 1}
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => ir(pagina + 1)}
            disabled={pagina >= paginas - 1}
            aria-label="Pagina siguiente"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}

/** Pastilla de estado con punto de color (ver GUIA-UI.md, "Estados"). */
export type TonoPastilla =
  | "ok" | "aviso" | "error" | "info" | "neutro"
  // Colores del cuadro pagos (los mismos significados del Excel).
  | "morado" | "verde" | "azul" | "naranja" | "amarillo";

export function Pastilla({ tono, children }: { tono: TonoPastilla; children: ReactNode }) {
  return <span className={`pastilla pastilla-${tono}`}>{children}</span>;
}

const IconoFiltro = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M4 6h16M7 12h10M10 18h4" />
  </svg>
);
const IconoExportar = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </svg>
);
