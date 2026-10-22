import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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

/** Opciones de "Filas por pagina"; la primera es la de siempre. */
export const OPCIONES_POR_PAGINA = [15, 25, 50, 100];

/**
 * Filas por pagina que eligio el usuario (la misma para todas las tablas). Es
 * solo comodidad del navegador: si no se puede leer, 15.
 */
export function usarFilasPorPagina(): [number, (n: number) => void] {
  const [n, setN] = useState(() => {
    try {
      const v = Number(localStorage.getItem("filasPorPagina"));
      return OPCIONES_POR_PAGINA.includes(v) ? v : OPCIONES_POR_PAGINA[0];
    } catch {
      return OPCIONES_POR_PAGINA[0];
    }
  });
  const cambiar = (v: number) => {
    setN(v);
    try {
      localStorage.setItem("filasPorPagina", String(v));
    } catch {
      // Sin almacenamiento solo se pierde la preferencia.
    }
  };
  return [n, cambiar];
}

/** Valor de una celda como texto (null y undefined -> ""). */
const texto = (v: unknown) => (v === null || v === undefined ? "" : String(v));
/** Texto sin tildes y en minuscula, para buscar sin importar acentos ni mayusculas. */
const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Tabla de listados con pestanas, busqueda, filtros, orden, exportacion y paginas.
 *
 * Como funciona (en este orden, con useMemo para no recalcular de mas):
 * 1. Pestanas: filtra por la pestana activa y cuenta las filas de cada una.
 * 2. Busqueda: compara el texto sin tildes contra el 'valor' de cada columna.
 * 3. Filtros: un desplegable por columna 'filtrable' con sus valores reales.
 * 4. Orden: clic en el encabezado (ascendente, descendente, sin orden).
 * 5. Paginas de 15 filas (o las que se elijan en "Filas por pagina"); al
 *    cambiar busqueda, filtros u orden vuelve a la primera.
 * La tabla no tiene scroll vertical propio: crece con la pagina (una sola
 * barra). Los textos largos se cortan con "..." y se leen completos al pasar
 * el mouse (title con el valor de la columna).
 * Exportar descarga un CSV (separado por ';', con BOM para que Excel lea las
 * tildes) con todo lo filtrado, no solo la pagina visible.
 */
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
  claseFila,
  columnasFijas = 1,
  detalle,
  busquedaInicial,
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
  /** Clase extra de cada fila (ej. pintar de verde las que ya estan pagadas). */
  claseFila?: (fila: T) => string | undefined;
  /**
   * Columnas de la izquierda que se quedan quietas al desplazar la tabla de
   * lado (como "inmovilizar" en Excel), para no perder de que fila se trata.
   */
  columnasFijas?: number;
  /**
   * Si se da, clic en la fila la despliega: debajo aparece lo que devuelve
   * (otro clic la recoge). Varias filas pueden quedar abiertas.
   */
  detalle?: (fila: T) => ReactNode;
  /** Texto con que arranca el buscador (por ejemplo, el cliente de una alerta). */
  busquedaInicial?: string;
}) {
  const [porPagina, setPorPagina] = usarFilasPorPagina();
  const tabla = useRef<HTMLTableElement>(null);
  /** Donde empieza cada columna fija (px desde la izquierda). */
  const [izquierdas, setIzquierdas] = useState<number[]>([]);
  const [pestana, setPestana] = useState(pestanaInicial ?? pestanas?.[0]?.id ?? "");
  const [busqueda, setBusqueda] = useState(busquedaInicial ?? "");
  const [verFiltros, setVerFiltros] = useState(false);
  const [filtros, setFiltros] = useState<Record<string, string>>({});
  const [orden, setOrden] = useState<{ id: string; asc: boolean } | null>(null);
  const [pagina, setPagina] = useState(0);
  /** Filas desplegadas (por su clave). */
  const [abiertas, setAbiertas] = useState<Set<string | number>>(new Set());
  const alternar = (k: string | number) =>
    setAbiertas((a) => {
      const n = new Set(a);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  // Cualquier cambio de criterio vuelve a la primera pagina.
  useEffect(() => setPagina(0), [pestana, busqueda, filtros, orden, porPagina]);

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

  const paginas = Math.max(1, Math.ceil(visibles.length / porPagina));
  const paginaActual = Math.min(pagina, paginas - 1);
  const desde = paginaActual * porPagina;
  const enPagina = visibles.slice(desde, desde + porPagina);

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

  // Columnas fijas: cada una empieza donde termina la anterior. Se mide al
  // pintar y cuando la tabla cambia de tamano (otra pagina, otra pestana).
  useLayoutEffect(() => {
    const t = tabla.current;
    if (!t || columnasFijas <= 0) return;
    const medir = () => {
      // Suma de anchos (no offsetLeft: las celdas fijas ya movidas lo cambian).
      const anchos = [...t.querySelectorAll<HTMLTableCellElement>("thead th")].slice(0, columnasFijas).map((th) => th.offsetWidth);
      const nuevas = anchos.map((_, i) => anchos.slice(0, i).reduce((s, a) => s + a, 0));
      setIzquierdas((previas) => (previas.join() === nuevas.join() ? previas : nuevas));
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(t);
    return () => observador.disconnect();
  }, [columnasFijas, columnas]);

  /** Clase y posicion de la columna i si es fija (la ultima lleva la sombra). */
  const fija = (i: number) =>
    i < columnasFijas && izquierdas[i] !== undefined
      ? { clase: i === columnasFijas - 1 ? "col-fija col-fija-ultima" : "col-fija", estilo: { left: izquierdas[i] } }
      : { clase: "", estilo: undefined };

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
        <table className={`tabla ${claseTabla}`} ref={tabla}>
          <thead>
            <tr>
              {columnas.map((c, i) => (
                <th
                  key={c.id}
                  className={[c.valor ? "ordenable" : "", c.alinear === "derecha" ? "num" : "", fija(i).clase].join(" ")}
                  style={fija(i).estilo}
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
            {enPagina.map((f) => {
              const k = clave(f);
              const abierta = !!detalle && abiertas.has(k);
              return (
              <Fragment key={k}>
              <tr
                className={
                  [alClicFila || detalle ? "fila-clic" : "", abierta ? "fila-abierta" : "", claseFila?.(f) ?? ""].filter(Boolean).join(" ") ||
                  undefined
                }
                onClick={detalle ? () => alternar(k) : alClicFila ? () => alClicFila(f) : undefined}
                aria-expanded={detalle ? abierta : undefined}
              >
                {columnas.map((c, i) => {
                  const etiqueta = c.etiquetaMovil === undefined ? c.titulo : c.etiquetaMovil;
                  // Texto completo al pasar el mouse (la celda puede ir cortada con "...").
                  const completo = c.valor ? texto(c.valor(f)) : "";
                  return (
                    <td
                      key={c.id}
                      className={[clase(c, f), fija(i).clase].filter(Boolean).join(" ")}
                      style={fija(i).estilo}
                      data-label={etiqueta || undefined}
                      title={completo.length > 18 ? completo : undefined}
                    >
                      {c.celda(f)}
                    </td>
                  );
                })}
              </tr>
              {abierta && (
                <tr className="fila-detalle">
                  <td colSpan={columnas.length}>{detalle!(f)}</td>
                </tr>
              )}
              </Fragment>
              );
            })}
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
        porPagina={porPagina}
        alCambiarPorPagina={setPorPagina}
      />
    </div>
  );
}

/**
 * Pie de la tabla: "Filas por pagina", "1-15 de 312" y los botones de pagina
 * (primera, anterior, numeros, siguiente, ultima). Tambien la usan tablas que
 * no son TablaDatos.
 */
export function Paginacion({
  total,
  desde,
  hasta,
  pagina,
  paginas,
  alCambiar,
  porPagina,
  alCambiarPorPagina,
}: {
  total: number;
  desde: number;
  hasta: number;
  pagina: number;
  paginas: number;
  alCambiar: (p: number) => void;
  porPagina?: number;
  alCambiarPorPagina?: (n: number) => void;
}) {
  const pie = useRef<HTMLDivElement>(null);
  if (total === 0) return null;
  /** Al cambiar de pagina se vuelve al comienzo de la tabla. */
  const ir = (p: number) => {
    alCambiar(p);
    const tabla = pie.current?.parentElement?.querySelector("table") ?? pie.current?.parentElement;
    tabla?.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  // Paginas a la vista: la primera, la ultima, la actual y una a cada lado.
  const numeros = [...new Set([0, paginas - 1, pagina - 1, pagina, pagina + 1])]
    .filter((p) => p >= 0 && p < paginas)
    .sort((a, b) => a - b);
  return (
    <div className="tabla-paginacion" ref={pie}>
      <div className="tabla-paginacion-info">
        {porPagina && alCambiarPorPagina && (
          <label className="filas-por-pagina">
            Filas por pagina
            <select value={porPagina} onChange={(e) => alCambiarPorPagina(Number(e.target.value))}>
              {OPCIONES_POR_PAGINA.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
        <span>
          {desde + 1}–{hasta} de {total}
        </span>
      </div>
      {paginas > 1 && (
        <div className="tabla-paginas">
          <button type="button" onClick={() => ir(0)} disabled={pagina === 0} aria-label="Primera pagina">
            «
          </button>
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
          <button type="button" onClick={() => ir(paginas - 1)} disabled={pagina >= paginas - 1} aria-label="Ultima pagina">
            »
          </button>
        </div>
      )}
    </div>
  );
}

/** Colores posibles de una pastilla de estado. */
export type TonoPastilla =
  | "ok" | "aviso" | "error" | "info" | "neutro"
  // Colores del cuadro pagos (los mismos significados del Excel).
  | "morado" | "verde" | "azul" | "naranja" | "amarillo" | "turquesa";

/** Pastilla de estado con punto de color (ver GUIA-UI.md, "Estados"). */
export function Pastilla({ tono, children }: { tono: TonoPastilla; children: ReactNode }) {
  return <span className={`pastilla pastilla-${tono}`}>{children}</span>;
}

/** Icono del boton Filtros. */
const IconoFiltro = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M4 6h16M7 12h10M10 18h4" />
  </svg>
);
/** Icono del boton Exportar. */
const IconoExportar = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </svg>
);
