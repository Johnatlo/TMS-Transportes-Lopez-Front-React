/**
 * Carga inicial de los anticipos desde el Excel de las EDS (una sola vez).
 *
 * 1. Se elige el archivo; el navegador lee las filas de anticipos.
 * 2. El servidor propone el viaje de cada anticipo (misma placa, fecha
 *    cercana y mismo cliente: "EMPRESA PROV").
 * 3. Se revisan las dudosas y se confirma. Las que ya estaban cargadas (misma
 *    placa, fecha y valores) se saltan; las que quedan sin viaje no se cargan.
 */
import { useState } from "react";
import { apiCuadro, moneda } from "../../api/cliente";
import type { AnticipoPropuesto, CandidatoViaje } from "../../api/cliente";
import Modal from "../../componentes/Modal";
import { Pastilla } from "../../componentes/TablaDatos";
import { fechaCorta } from "./estadosCuadro";
import { anticiposDesdeFilas, leerHojas } from "../seguimiento/cargaExcel";

/** Anticipo en revision: la propuesta con el viaje elegido (null = no cargar). */
interface AnticipoRevision extends AnticipoPropuesto {
  viajeId: number | null;
}

type Vista = "revisar" | "todas";

/** Texto de un viaje del cuadro para la lista (fecha, cliente, manifiesto). */
const etiquetaViaje = (c: CandidatoViaje) =>
  [fechaCorta(c.fecha), c.empresa, c.manifiesto ? `man. ${c.manifiesto}` : "sin manifiesto", c.mismoCliente ? null : "(otro cliente)"]
    .filter(Boolean)
    .join(" · ");

/** Ventana de la carga de anticipos: leer el Excel, revisar el viaje de cada fila y cargar. */
export default function ImportarAnticipos({ alCerrar, alCambiar }: { alCerrar: () => void; alCambiar: () => void }) {
  const [filas, setFilas] = useState<AnticipoRevision[] | null>(null);
  const [vista, setVista] = useState<Vista>("revisar");
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function leer(archivo: File | undefined) {
    if (!archivo) return;
    setError(null);
    setAviso(null);
    setTrabajando(true);
    try {
      const hojas = await leerHojas(archivo);
      // La hoja de anticipos es la que tiene la columna "FECHA ANTICIPO".
      const hoja = hojas.find((h) => h.filas.some((f) => f.some((v) => /fecha anticipo/i.test(String(v ?? "")))));
      if (!hoja) throw new Error('No se encontro una hoja con la columna "FECHA ANTICIPO".');
      const leidas = anticiposDesdeFilas(hoja.filas);
      if (leidas.length === 0) throw new Error("La hoja no trae anticipos.");
      const propuesta = await apiCuadro.previaAnticipos(leidas);
      setFilas(propuesta.map((a) => ({ ...a, viajeId: a.yaImportado ? null : a.propuesto })));
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo leer el archivo.");
    } finally {
      setTrabajando(false);
    }
  }

  const porRevisar = (a: AnticipoRevision) => !a.yaImportado && (!a.seguro || a.viajeId === null || a.viajeId !== a.propuesto);
  const aCargar = (filas ?? []).filter((a) => !a.yaImportado && a.viajeId !== null);
  const visibles = (filas ?? []).filter((a) => (vista === "revisar" ? porRevisar(a) : true));

  async function cargar() {
    if (!window.confirm(`¿Cargar ${aCargar.length} anticipos a sus viajes?`)) return;
    setError(null);
    setTrabajando(true);
    try {
      // Solo la fila y el viaje elegido (sin la lista de candidatos).
      const r = await apiCuadro.importarAnticipos(
        aCargar.map(({ candidatos: _c, propuesto: _p, seguro: _s, yaImportado: _y, ...fila }) => ({ ...fila, viajeId: fila.viajeId! }))
      );
      setAviso(`Listo: ${r.cargados} anticipo(s) cargados${r.repetidos ? ` y ${r.repetidos} que ya estaban se saltaron` : ""}.`);
      setFilas(null);
      alCambiar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudieron cargar los anticipos.");
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <Modal
      titulo="Importar anticipos desde Excel"
      ancho="pantalla"
      alCerrar={alCerrar}
      pie={
        <>
          {filas && (
            <span className="dato-sec" style={{ marginRight: "auto" }}>
              {aCargar.length} de {filas.length} anticipos se cargan ·{" "}
              {moneda(aCargar.reduce((s, a) => s + a.efectivo + a.combustible, 0))}
              {filas.some((a) => a.yaImportado) && ` · ${filas.filter((a) => a.yaImportado).length} ya estaban`}
            </span>
          )}
          <button className="btn-secondary" onClick={alCerrar}>
            Cerrar
          </button>
          {filas && (
            <button className="btn-primary" onClick={cargar} disabled={trabajando || aCargar.length === 0}>
              {trabajando ? "Cargando..." : "Cargar anticipos"}
            </button>
          )}
        </>
      }
    >
      <div className="section-desc" style={{ marginBottom: "0.6rem" }}>
        Sube el Excel de anticipos. Cada fila es el anticipo de un viaje y el sistema propone el viaje de la misma
        placa en esa fecha y del mismo cliente. Revisa los que dicen "Revisar" o "Sin viaje"; los que dejes
        sin viaje no se cargan. Las bombas (CHUSACA, S. ESTEBAN...) se crean solas si no existen.
      </div>
      {error && <div className="alert danger">{error}</div>}
      {aviso && <div className="alert success">{aviso}</div>}
      {!filas && (
        <label className="btn-primary boton-con-texto" style={{ cursor: "pointer", alignSelf: "flex-start" }}>
          {trabajando ? "Leyendo..." : "Elegir el Excel de anticipos"}
          <input
            type="file"
            accept=".xlsx"
            style={{ display: "none" }}
            disabled={trabajando}
            onChange={(e) => {
              leer(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      )}
      {filas && (
        <>
          <div className="tabla-pestanas" style={{ marginBottom: "0.5rem" }}>
            <button className={vista === "revisar" ? "activa" : ""} onClick={() => setVista("revisar")}>
              Por revisar <span className="contador">{filas.filter(porRevisar).length}</span>
            </button>
            <button className={vista === "todas" ? "activa" : ""} onClick={() => setVista("todas")}>
              Todas <span className="contador">{filas.length}</span>
            </button>
          </div>
          <div className="tabla-envio">
            <table className="tabla tabla-compacta" style={{ width: 1260 }}>
              <colgroup>
                <col style={{ width: 60 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 170 }} />
                <col style={{ width: 150 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 460 }} />
                <col style={{ width: 110 }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Fila</th>
                  <th>Fecha</th>
                  <th>Placa</th>
                  <th>Cliente (Excel)</th>
                  <th>Efectivo + combustible</th>
                  <th>EDS</th>
                  <th>Viaje del cuadro pagos</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((a) => (
                  <tr key={a.fila} className={a.yaImportado || a.viajeId === null ? "fila-inactiva" : ""}>
                    <td>{a.fila}</td>
                    <td>{fechaCorta(a.fecha)}</td>
                    <td className="codigo">{a.placa}</td>
                    <td>{a.cliente || "-"}</td>
                    <td>
                      {moneda(a.efectivo + a.combustible)}
                      <span className="dato-sec">
                        {moneda(a.efectivo)} + {moneda(a.combustible)}
                      </span>
                    </td>
                    <td>
                      {a.eds || "-"}
                      {a.facturaBomba && <span className="dato-sec">Fact. {a.facturaBomba}</span>}
                    </td>
                    <td>
                      {a.yaImportado ? (
                        <span className="dato-sec">Ya estaba cargado: no se repite.</span>
                      ) : a.candidatos.length === 0 ? (
                        <span className="texto-vencido">No hay viajes de esta placa cerca de la fecha: no se carga.</span>
                      ) : (
                        <select
                          value={a.viajeId ?? ""}
                          onChange={(e) =>
                            setFilas((fs) =>
                              (fs ?? []).map((x) => (x.fila === a.fila ? { ...x, viajeId: e.target.value ? Number(e.target.value) : null } : x))
                            )
                          }
                        >
                          <option value="">No cargar este anticipo</option>
                          {a.candidatos.map((c) => (
                            <option key={c.id} value={c.id}>
                              {etiquetaViaje(c)}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td>
                      {a.yaImportado ? (
                        <Pastilla tono="neutro">Ya cargado</Pastilla>
                      ) : a.viajeId === null ? (
                        <Pastilla tono="error">Sin viaje</Pastilla>
                      ) : a.seguro && a.viajeId === a.propuesto ? (
                        <Pastilla tono="ok">Seguro</Pastilla>
                      ) : (
                        <Pastilla tono="aviso">Revisar</Pastilla>
                      )}
                    </td>
                  </tr>
                ))}
                {visibles.length === 0 && (
                  <tr>
                    <td colSpan={8} className="dato-sec">
                      No queda nada por revisar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}
