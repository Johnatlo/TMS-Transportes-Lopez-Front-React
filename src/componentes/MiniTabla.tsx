/**
 * Lista de varios registros dentro de una celda o un detalle (los viajes de
 * un abono, las causaciones de un gasto...) como una tabla pequena: con
 * encabezado, una linea por registro separada de la siguiente, letra legible
 * y los valores alineados a la derecha. Reemplaza los renglones grises pegados
 * ("Remesa 123 · SZP-339 · CLIENTE (16/10/2026) · 2.200.000") que eran dificiles
 * de leer. Con muchos registros muestra los primeros y un boton para ver todos.
 */
import { useState } from "react";
import type { ReactNode } from "react";

/** Una columna de la mini tabla. */
export interface ColumnaMini<T> {
  titulo: string;
  celda: (fila: T) => ReactNode;
  /** Numero (a la derecha). */
  num?: boolean;
}

/** Tabla pequena; con mas de `visibles` filas muestra esas y "Ver los N ..." para desplegar el resto. */
export default function MiniTabla<T>({
  filas,
  columnas,
  clave,
  visibles = 3,
  nombre = "registros",
  total,
}: {
  filas: T[];
  columnas: ColumnaMini<T>[];
  clave: (fila: T, i: number) => string | number;
  /** Cuantas se ven sin desplegar. */
  visibles?: number;
  /** Como se llaman los registros, en plural ("viajes"), para el boton. */
  nombre?: string;
  /** Fila de total (opcional): el texto de cada columna numerica, en orden. */
  total?: ReactNode[];
}) {
  const [todas, setTodas] = useState(false);
  if (!filas.length) return <span className="dato-sec">-</span>;
  const mostradas = todas || filas.length <= visibles + 1 ? filas : filas.slice(0, visibles);
  return (
    <div className="mini-tabla-caja" onClick={(e) => e.stopPropagation()}>
      <table className="mini-tabla">
        <thead>
          <tr>
            {columnas.map((c) => (
              <th key={c.titulo} className={c.num ? "num" : undefined}>
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {mostradas.map((f, i) => (
            <tr key={clave(f, i)}>
              {columnas.map((c) => (
                <td key={c.titulo} className={c.num ? "num" : undefined}>
                  {c.celda(f)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {total && (todas || mostradas.length === filas.length) && (
          <tfoot>
            <tr>
              {total.map((t, i) => (
                <td key={i} className={columnas[i]?.num ? "num" : undefined}>
                  {t}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
      {filas.length > mostradas.length || todas ? (
        <button type="button" className="btn-link mini-tabla-mas" onClick={() => setTodas(!todas)}>
          {todas ? "Ver menos ▴" : `Ver los ${filas.length} ${nombre} ▾`}
        </button>
      ) : null}
    </div>
  );
}
