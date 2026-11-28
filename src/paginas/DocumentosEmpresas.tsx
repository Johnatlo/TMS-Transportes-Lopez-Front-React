/**
 * Configuracion > Empresa: documentos con vencimiento de las dos empresas
 * (Transportes Lopez y M&C), como la camara de comercio, la habilitacion o
 * las polizas. Se guarda el nombre, el numero y la fecha (no el archivo) y
 * avisan en "Sofi te cuenta" 30 dias antes de vencer.
 */
import { useState } from "react";
import { api, soloDia } from "../api/cliente";
import type { DocumentoEmpresa } from "../api/cliente";
import { useDatos } from "../ganchos/useDatos";
import { Cargando, ErrorCarga } from "../componentes/Estado";

/** Nombre de cada empresa. */
const EMPRESAS: Record<DocumentoEmpresa["empresa"], string> = { LOPEZ: "Transportes Lopez", MYC: "Transportes M&C" };

/** Documento vacio para el formulario. */
const VACIO: Omit<DocumentoEmpresa, "id"> = { empresa: "LOPEZ", nombre: "", numero: null, fechaVencimiento: null, nota: null };

/** Dias que faltan para una fecha "AAAA-MM-DD" (negativo si ya paso). */
function diasHasta(fecha: string): number {
  const hoy = new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10);
  return Math.round((Date.parse(`${fecha}T12:00:00Z`) - Date.parse(`${hoy}T12:00:00Z`)) / 86_400_000);
}

/** El vencimiento con su aviso: rojo si vencio o faltan 7 dias o menos, amarillo a 30. */
function Vence({ fecha }: { fecha: string | null }) {
  if (!fecha) return <span className="dato-sec">Sin fecha</span>;
  const dias = diasHasta(fecha);
  const texto = dias < 0 ? `vencio hace ${-dias} dias` : dias === 0 ? "vence hoy" : `en ${dias} dias`;
  return (
    <span>
      {soloDia(fecha)} <span className={dias <= 7 ? "texto-vencido" : dias <= 30 ? "texto-aviso" : "dato-sec"}>({texto})</span>
    </span>
  );
}

/** Lista y formulario de los documentos de las empresas. */
export default function DocumentosEmpresas() {
  const { datos, cargando, error, recargar } = useDatos(() => api.documentosEmpresa(), []);
  const [lista, setLista] = useState<DocumentoEmpresa[] | null>(null);
  // null = sin formulario; 0 = nuevo; otro = editando ese id.
  const [editando, setEditando] = useState<number | null>(null);
  const [borrador, setBorrador] = useState<Omit<DocumentoEmpresa, "id">>(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const docs = lista ?? datos;
  if (cargando && !docs) return <Cargando que="los documentos" />;
  if (error && !docs) return <ErrorCarga mensaje={error} alReintentar={recargar} />;

  const abrir = (d?: DocumentoEmpresa) => {
    setAviso(null);
    setEditando(d ? d.id : 0);
    setBorrador(d ? { empresa: d.empresa, nombre: d.nombre, numero: d.numero, fechaVencimiento: d.fechaVencimiento, nota: d.nota } : VACIO);
  };

  const guardar = async () => {
    setGuardando(true);
    setAviso(null);
    try {
      setLista(editando ? await api.guardarDocumentoEmpresa(editando, borrador) : await api.crearDocumentoEmpresa(borrador));
      setEditando(null);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (d: DocumentoEmpresa) => {
    if (!window.confirm(`¿Borrar "${d.nombre}" de ${EMPRESAS[d.empresa]}? Queda en la papelera de Control interno.`)) return;
    try {
      setLista(await api.borrarDocumentoEmpresa(d.id));
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se pudo borrar.");
    }
  };

  const texto = (v: string) => (v.trim() ? v : null);

  return (
    <div className="form-section">
      <div>
        <div className="section-title">Documentos de las empresas</div>
        <div className="section-desc">
          Camara de comercio, habilitacion, polizas y demas documentos con vencimiento de Transportes Lopez y de Transportes M&C. Se guarda solo el nombre, el
          numero y la fecha (no el archivo). Avisan en "Sofi te cuenta" 30 dias antes de vencer.
        </div>
      </div>
      <div>
        {aviso && <div className="alert danger">{aviso}</div>}
        <table className="tabla tabla-compacta">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Documento</th>
              <th>Numero</th>
              <th>Vence</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(docs ?? []).map((d) => (
              <tr key={d.id}>
                <td>{EMPRESAS[d.empresa]}</td>
                <td>
                  {d.nombre}
                  {d.nota && <span className="dato-sec"> · {d.nota}</span>}
                </td>
                <td>{d.numero ?? "-"}</td>
                <td>
                  <Vence fecha={d.fechaVencimiento} />
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="btn-link" onClick={() => abrir(d)}>
                    Editar
                  </button>{" "}
                  <button className="btn-link" onClick={() => borrar(d)}>
                    Borrar
                  </button>
                </td>
              </tr>
            ))}
            {docs?.length === 0 && (
              <tr>
                <td colSpan={5} className="dato-sec">
                  Aun no hay documentos. Agrega los de cada empresa para que SOFI avise antes de que venzan.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {editando === null ? (
          <button className="btn-secondary" style={{ marginTop: "0.6rem" }} onClick={() => abrir()}>
            Agregar documento
          </button>
        ) : (
          <div className="tarjeta" style={{ marginTop: "0.6rem", padding: "0.8rem" }}>
            <label>Empresa</label>
            <select value={borrador.empresa} onChange={(e) => setBorrador({ ...borrador, empresa: e.target.value as DocumentoEmpresa["empresa"] })}>
              <option value="LOPEZ">Transportes Lopez</option>
              <option value="MYC">Transportes M&C</option>
            </select>
            <label>Documento</label>
            <input
              value={borrador.nombre}
              placeholder="Camara de comercio, habilitacion, poliza RC..."
              onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
            />
            <label>Numero (opcional)</label>
            <input value={borrador.numero ?? ""} onChange={(e) => setBorrador({ ...borrador, numero: texto(e.target.value) })} />
            <label>Vence</label>
            <input
              type="date"
              value={borrador.fechaVencimiento ?? ""}
              onChange={(e) => setBorrador({ ...borrador, fechaVencimiento: e.target.value || null })}
            />
            <label>Nota (opcional)</label>
            <input value={borrador.nota ?? ""} onChange={(e) => setBorrador({ ...borrador, nota: texto(e.target.value) })} />
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem" }}>
              <button className="btn-primary" onClick={guardar} disabled={guardando || !borrador.nombre.trim()}>
                {guardando ? "Guardando..." : editando ? "Guardar cambios" : "Agregar"}
              </button>
              <button className="btn-secondary" onClick={() => setEditando(null)} disabled={guardando}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
