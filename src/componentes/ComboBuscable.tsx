import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Select con busqueda: en vez de desplegar la lista completa (placas, nombres
 * de clientes, cedulas...), se escribe encima y se filtra.
 *
 * Reemplaza los <select> que se llenan con datos de la base (vehiculos,
 * conductores, remolques, terceros, plantillas). Los <select> de opciones fijas
 * (tipo de identificacion, tipo de manifiesto) no necesitan esto: son pocas
 * opciones y no hace falta buscar entre ellas.
 *
 * El id suele ser numerico (el id de la base), pero puede ser texto: los
 * codigos DIVIPOLA empiezan por cero (05001000) y como numero lo perderian.
 * `K` es ese tipo; TypeScript lo deduce de `obtenerId`, asi que los usos
 * existentes con ids numericos no cambian.
 */
export default function ComboBuscable<T, K extends number | string = number>({
  opciones,
  valor,
  alCambiar,
  obtenerId,
  obtenerEtiqueta,
  placeholder = "Escribe para buscar...",
  disabled = false,
}: {
  opciones: T[];
  valor: K | null;
  alCambiar: (id: K | null) => void;
  obtenerId: (item: T) => K;
  obtenerEtiqueta: (item: T) => string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const contenedorRef = useRef<HTMLDivElement>(null);

  const seleccionado = useMemo(
    () => opciones.find((o) => obtenerId(o) === valor) ?? null,
    [opciones, valor, obtenerId]
  );

  // Mientras el usuario no esta escribiendo, el cuadro muestra la etiqueta de
  // lo seleccionado. Al escribir, se muestra lo que el usuario tecleo.
  const textoMostrado = abierto ? texto : seleccionado ? obtenerEtiqueta(seleccionado) : "";

  const filtradas = useMemo(() => {
    const q = texto.trim().toLowerCase();
    if (!q) return opciones;
    return opciones.filter((o) => obtenerEtiqueta(o).toLowerCase().includes(q));
  }, [opciones, texto, obtenerEtiqueta]);

  // Clic fuera del combo cierra la lista sin perder la seleccion actual.
  useEffect(() => {
    function alHacerClicFuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false);
        setTexto("");
      }
    }
    document.addEventListener("mousedown", alHacerClicFuera);
    return () => document.removeEventListener("mousedown", alHacerClicFuera);
  }, []);

  function elegir(item: T) {
    alCambiar(obtenerId(item));
    setTexto("");
    setAbierto(false);
  }

  return (
    <div className="combo-buscable" ref={contenedorRef}>
      <input
        type="text"
        disabled={disabled}
        placeholder={placeholder}
        value={textoMostrado}
        onFocus={() => {
          setAbierto(true);
          setTexto("");
        }}
        onChange={(e) => {
          setTexto(e.target.value);
          setAbierto(true);
          // Si el usuario borra todo el texto, se entiende que quita la
          // seleccion en vez de dejar un id que ya no corresponde a lo escrito.
          if (e.target.value === "") alCambiar(null);
        }}
      />
      {abierto && (
        <div className="combo-lista">
          {filtradas.length === 0 && <div className="combo-vacio">Sin resultados.</div>}
          {filtradas.slice(0, 50).map((item) => (
            <div
              key={obtenerId(item)}
              className={obtenerId(item) === valor ? "combo-item activo" : "combo-item"}
              // onMouseDown y no onClick: se dispara antes del blur del input,
              // asi el clic en la opcion no se pierde contra el cierre de la lista.
              onMouseDown={(e) => {
                e.preventDefault();
                elegir(item);
              }}
            >
              {obtenerEtiqueta(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
