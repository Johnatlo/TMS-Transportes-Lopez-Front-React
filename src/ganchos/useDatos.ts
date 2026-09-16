import { useCallback, useEffect, useState } from "react";
import { ErrorApi } from "../api/cliente";

/**
 * Carga datos de la API y expone los tres estados que toda pantalla necesita:
 * cargando, error y datos.
 *
 * En Angular esto se resolvia con `subscribe()` dentro de `ngOnInit`. Aqui se
 * encapsula para no repetir el mismo `useState` triple en cada pantalla.
 *
 * `recargar` sirve despues de guardar algo: vuelve a pedir sin recargar la
 * pagina.
 *
 * Ojo con `dependencias`: es el arreglo que decide cuando se vuelve a pedir,
 * igual que en useEffect. Si la funcion usa una variable que cambia (el id de
 * un vehiculo, por ejemplo), esa variable tiene que estar aqui.
 */
export function useDatos<T>(
  cargar: () => Promise<T>,
  dependencias: unknown[] = []
): {
  datos: T | null;
  cargando: boolean;
  error: string | null;
  recargar: () => void;
} {
  const [datos, setDatos] = useState<T | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ejecutar = useCallback(() => {
    let cancelado = false;
    setCargando(true);
    setError(null);

    cargar()
      .then((r) => {
        // Si la pantalla se cerro mientras la peticion iba en camino, escribir
        // el estado provocaria una advertencia y trabajo inutil.
        if (!cancelado) setDatos(r);
      })
      .catch((exc) => {
        if (cancelado) return;
        setError(exc instanceof ErrorApi ? exc.message : "Error inesperado");
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencias);

  useEffect(() => ejecutar(), [ejecutar]);

  return { datos, cargando, error, recargar: ejecutar };
}
