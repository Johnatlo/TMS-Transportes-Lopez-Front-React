/**
 * Bloques que se repiten en toda pantalla que consulta la API: el mensaje de
 * "cargando", el de error y el de lista vacia.
 */

export function Cargando({ que = "datos" }: { que?: string }) {
  return <p className="section-desc">Cargando {que}...</p>;
}

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
