/**
 * Bloques que se repiten en toda pantalla que consulta la API: el mensaje de
 * "cargando", el de error y el de lista vacia.
 */

/**
 * Mientras llegan los datos: un esqueleto gris que brilla (la forma de una
 * tabla: barra, encabezado y filas), en vez de un texto. Los lectores de
 * pantalla oyen "Cargando ...".
 */
export function Cargando({ que = "datos" }: { que?: string }) {
  return (
    <div className="esqueleto" role="status">
      <span className="solo-lector">Cargando {que}...</span>
      <span className="esqueleto-barra" />
      <span className="esqueleto-cabeza" />
      {[0.92, 0.78, 0.86, 0.7, 0.82, 0.74].map((ancho, i) => (
        <span key={i} className="esqueleto-fila" style={{ width: `${ancho * 100}%`, animationDelay: `${i * 80}ms` }} />
      ))}
    </div>
  );
}

/** Mensaje de error al cargar datos, con boton "Reintentar" si se da alReintentar. */
export function ErrorCarga({ mensaje, alReintentar }: { mensaje: string; alReintentar?: () => void }) {
  return (
    <div className="alert danger">
      {mensaje}
      {alReintentar && (
        <button type="button" className="btn-link" onClick={alReintentar}>
          Reintentar
        </button>
      )}
    </div>
  );
}

/** Mensaje para una lista sin resultados. */
export function Vacio({ mensaje }: { mensaje: string }) {
  return <p className="section-desc">{mensaje}</p>;
}

/**
 * Los avisos del backend no son errores: la operacion salio bien pero hay algo
 * que el despachador debe saber (manifiesto tardio, coordenada sin precision).
 */
export function Avisos({ avisos }: { avisos: string[] }) {
  if (avisos.length === 0) return null;
  return (
    <div className="alert warning">
      <strong>Ten en cuenta:</strong>
      <ul style={{ margin: "0.4rem 0 0 1rem" }}>
        {avisos.map((a, i) => (
          <li key={i}>{a}</li>
        ))}
      </ul>
    </div>
  );
}
