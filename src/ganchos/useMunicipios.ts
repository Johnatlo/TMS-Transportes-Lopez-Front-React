import { useMemo } from "react";
import { api } from "../api/cliente";
import { useDatos } from "./useDatos";
import type { Municipio, Tercero } from "../api/tipos";

/**
 * Municipios para elegir y mostrar la ruta de una plantilla.
 *
 * La fuente principal es el catalogo DIVIPOLA del backend. Si todavia no se
 * importo (tabla vacia), se arma una lista con los municipios de los terceros
 * que ya se conocen, para que el despachador pueda buscar por nombre igual.
 *
 * `useMemo` evita recalcular la lista en cada render: solo se rehace cuando
 * cambia el catalogo o la lista de terceros. Sin el, cada tecla escrita en
 * cualquier campo del formulario volveria a recorrer cientos de terceros.
 */
export function useMunicipios(terceros: Tercero[] | null | undefined): {
  lista: Municipio[];
  /** Nombre legible de un codigo, o el codigo mismo si no se conoce. */
  nombre: (codigo: string | null | undefined) => string;
} {
  const catalogo = useDatos(() => api.getMunicipios(), []);

  const lista = useMemo(() => {
    if (catalogo.datos && catalogo.datos.length > 0) return catalogo.datos;

    const porCodigo = new Map<string, Municipio>();
    for (const t of terceros ?? []) {
      if (t.codMunicipioRndc && !porCodigo.has(t.codMunicipioRndc)) {
        porCodigo.set(t.codMunicipioRndc, {
          codigo: t.codMunicipioRndc,
          nombre: t.ciudad ?? t.codMunicipioRndc,
          departamento: null,
        });
      }
    }
    return [...porCodigo.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [catalogo.datos, terceros]);

  const nombre = (codigo: string | null | undefined) => {
    if (!codigo) return "-";
    const m = lista.find((x) => x.codigo === codigo);
    return m ? `${m.nombre} (${codigo})` : codigo;
  };

  return { lista, nombre };
}
