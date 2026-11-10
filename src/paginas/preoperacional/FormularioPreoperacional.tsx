/**
 * Ventana de la inspeccion preoperacional de un viaje (o suelta): las 38
 * preguntas del formulario por secciones, ya contestadas con lo sugerido (todo
 * en Si / Cumple, con los datos del vehiculo y el conductor). Sale sola al
 * expedir un manifiesto; "Despues" la deja pendiente en el modulo
 * Preoperacional, sin frenar el despacho.
 */
import { useEffect, useState } from "react";
import { apiPreoperacional } from "../../api/cliente";
import type { Preoperacional } from "../../api/cliente";
import Modal from "../../componentes/Modal";
import { Cargando } from "../../componentes/Estado";
import { faltantes, PREGUNTAS, respuestasIniciales, SECCIONES } from "./preguntasPreoperacional";
import type { Pregunta } from "./preguntasPreoperacional";

/** Ventana del formulario. Con `existente` corrige esa inspeccion. */
export default function FormularioPreoperacional({
  viajeId,
  titulo,
  existente,
  alCerrar,
  alGuardar,
}: {
  viajeId: number | null;
  /** "Manifiesto 00006950 · SPS199" */
  titulo?: string;
  existente?: Preoperacional;
  alCerrar: () => void;
  alGuardar: (p: Preoperacional) => void;
}) {
  const [r, setR] = useState<Record<string, string> | null>(existente ? respuestasIniciales(existente.respuestas) : null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [intento, setIntento] = useState(false);

  // Las respuestas sugeridas para el viaje.
  useEffect(() => {
    if (existente) return;
    let vivo = true;
    apiPreoperacional
      .sugerido({ viajeId })
      .then((s) => vivo && setR(respuestasIniciales(s)))
      .catch((exc) => {
        if (!vivo) return;
        setError(exc instanceof Error ? exc.message : "No se pudieron traer las respuestas sugeridas.");
        setR(respuestasIniciales({}));
      });
    return () => {
      vivo = false;
    };
  }, [viajeId, existente]);

  const sinContestar = r ? faltantes(r) : [];

  async function guardar() {
    if (!r) return;
    setIntento(true);
    if (sinContestar.length) {
      setError(`Faltan ${sinContestar.length} respuesta(s): ${sinContestar.map((p) => p.titulo).join(", ")}.`);
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const p = existente ? await apiPreoperacional.actualizar(existente.id, viajeId, r) : await apiPreoperacional.guardar(viajeId, r);
      alGuardar(p);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
      setEnviando(false);
    }
  }

  const cambiar = (clave: string, valor: string) => r && setR({ ...r, [clave]: valor });

  /** Campo de una pregunta (lista, texto o fecha). */
  const campo = (p: Pregunta) => {
    const valor = r?.[p.clave] ?? "";
    const falta = intento && p.requerida && !valor.trim();
    const estilo = falta ? { borderColor: "var(--error-500, #d33)" } : undefined;
    if (p.tipo === "opcion") {
      const otroValor = p.otro && valor && !p.opciones!.includes(valor);
      return (
        <>
          <select aria-label={p.titulo} style={estilo} value={otroValor ? "__otro" : valor} onChange={(e) => cambiar(p.clave, e.target.value === "__otro" ? " " : e.target.value)}>
            {!valor && <option value="">Elige...</option>}
            {p.opciones!.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
            {p.otro && <option value="__otro">Otro...</option>}
          </select>
          {otroValor && <input aria-label={`${p.titulo} (otro)`} value={valor.trimStart()} onChange={(e) => cambiar(p.clave, e.target.value || " ")} placeholder="Escribe cual" />}
        </>
      );
    }
    if (p.tipo === "largo") return <textarea aria-label={p.titulo} rows={3} value={valor} onChange={(e) => cambiar(p.clave, e.target.value)} />;
    return <input aria-label={p.titulo} style={estilo} type={p.tipo === "fecha" ? "date" : "text"} value={valor} onChange={(e) => cambiar(p.clave, e.target.value)} />;
  };

  return (
    <Modal
      ancho="pantalla"
      titulo={`Inspeccion preoperacional${titulo ? ` · ${titulo}` : ""}`}
      alCerrar={alCerrar}
      pie={
        <>
          <button className="btn-secondary" onClick={alCerrar}>
            {existente ? "Cancelar" : "Despues"}
          </button>
          <button className="btn-primary" onClick={guardar} disabled={!r || enviando}>
            {enviando ? "Guardando..." : "Guardar inspeccion"}
          </button>
        </>
      }
    >
      {error && <div className="alert danger">{error}</div>}
      {!r ? (
        <Cargando que="las respuestas sugeridas" />
      ) : (
        <>
          <div className="dato-sec" style={{ marginBottom: "0.6rem" }}>
            Todo viene en Si / Cumple con los datos del vehiculo y del conductor (de su ultima inspeccion o de la matriz). Cambia solo lo
            que tenga novedad.{!existente && " \"Despues\" la deja pendiente en el modulo Preoperacional."}
          </div>
          {SECCIONES.map((s) => (
            <section key={s}>
              <h4>{s}</h4>
              {s === "Inspeccion" ? (
                <table className="tabla tabla-compacta" style={{ maxWidth: 900 }}>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Estado</th>
                      <th>Si presenta novedad, amplie la informacion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PREGUNTAS.filter((p) => p.seccion === s).map((p) => (
                      <tr key={p.clave}>
                        <td>
                          {p.titulo}
                          {p.requerida && " *"}
                        </td>
                        <td style={{ width: 170 }}>{campo(p)}</td>
                        <td>
                          <input aria-label={`${p.titulo} - novedad`} value={r[p.novedad!] ?? ""} onChange={(e) => cambiar(p.novedad!, e.target.value)} placeholder="Sin novedad" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="campos-cuadro">
                  {PREGUNTAS.filter((p) => p.seccion === s).map((p) => (
                    <div key={p.clave} style={p.tipo === "largo" ? { gridColumn: "1 / -1" } : undefined}>
                      <label>
                        {p.titulo}
                        {p.requerida && " *"}
                      </label>
                      {campo(p)}
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </>
      )}
    </Modal>
  );
}
