import type { ReactNode } from "react";
import { api, fechaHora, moneda, soloDia } from "../api/cliente";
import type { TerceroDetalle } from "../api/cliente";
import { useDatos } from "../ganchos/useDatos";
import { Cargando, ErrorCarga } from "./Estado";
import Modal from "./Modal";
import { Pastilla } from "./TablaDatos";
import { ETIQUETA_ESTADO, tonoEstado } from "../paginas/estadosViaje";

/** Pares etiqueta / valor en dos columnas. Lo vacio se muestra como "-". */
function Datos({ filas }: { filas: Array<[string, ReactNode]> }) {
  return (
    <dl className="detalle-datos">
      {filas.map(([etiqueta, valor]) => (
        <div key={etiqueta}>
          <dt>{etiqueta}</dt>
          <dd>{valor === null || valor === undefined || valor === "" ? "-" : valor}</dd>
        </div>
      ))}
    </dl>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="detalle-seccion">
      <h4>{titulo}</h4>
      {children}
    </section>
  );
}

const tercero = (t: TerceroDetalle | null) =>
  t ? (
    <>
      <span className="principal">{t.nombre}</span>
      <span className="dato-sec">
        {t.tipoId} {t.nit} · sede {t.sede}
        {t.ciudad ? ` · ${t.ciudad}` : ""}
      </span>
    </>
  ) : null;

const NOMBRE_TIPO_MANIFIESTO: Record<string, string> = {
  G: "General",
  I: "Ida y regreso",
  M: "Multiparada",
  U: "Municipal",
  D: "Varios viajes en el dia",
  W: "Viaje en vacio",
};

/**
 * Todo lo que se registro al despachar un viaje, de solo lectura: documentos
 * y radicados, vehiculo y conductores, valores, cada remesa con sus partes y
 * su mercancia, y quien expidio, cumplio o anulo.
 */
export default function DetalleViaje({ viajeId, alCerrar }: { viajeId: number; alCerrar: () => void }) {
  const { datos: d, cargando, error, recargar } = useDatos(() => api.getDetalleViaje(viajeId), [viajeId]);
  const v = d?.viaje;

  return (
    <Modal titulo={`Viaje #${viajeId}${v?.consecutivoManifiesto ? ` · manifiesto ${v.consecutivoManifiesto}` : ""}`} ancho="wide" alCerrar={alCerrar}>
      {cargando && !d && <Cargando que="el viaje" />}
      {error && <ErrorCarga mensaje={error} alReintentar={recargar} />}
      {d && v && (
        <div className="detalle-viaje">
          <div className="detalle-cabecera">
            <Pastilla tono={tonoEstado(v.estado)}>{ETIQUETA_ESTADO[v.estado] ?? v.estado}</Pastilla>
            <span className="dato-sec">
              Planillado {fechaHora(v.fechaCreacion as unknown as string)}
              {v.creadoPorNombre ? ` por ${v.creadoPorNombre}` : ""}
            </span>
          </div>
          {v.mensajeError && <div className="alert danger" style={{ whiteSpace: "pre-wrap" }}>{v.mensajeError}</div>}

          <Seccion titulo="Manifiesto">
            <Datos
              filas={[
                ["Numero", <span className="codigo">{v.consecutivoManifiesto}</span>],
                ["Radicado RNDC", v.numeroManifiestoRndc],
                ["Tipo", d.tipoManifiesto ? NOMBRE_TIPO_MANIFIESTO[d.tipoManifiesto] ?? d.tipoManifiesto : null],
                ["Ruta (DIVIPOLA)", d.origen && d.destino ? `${d.origen} → ${d.destino}` : null],
                ["Via", v.codVia],
                ["Empresa de monitoreo (GPS)", d.monitoreo ? `${d.monitoreo.nombre ?? ""} ${d.monitoreo.nit}`.trim() : null],
                ["Cumplido", v.radicadoCumplido ? `radicado ${v.radicadoCumplido}${v.cumplidoPorNombre ? ` · por ${v.cumplidoPorNombre}` : ""}` : null],
                ["Anulacion", v.radicadoAnulacion ? `radicado ${v.radicadoAnulacion}${v.anuladoPorNombre ? ` · por ${v.anuladoPorNombre}` : ""}` : null],
              ]}
            />
          </Seccion>

          <Seccion titulo="Vehiculo y conductores">
            <Datos
              filas={[
                ["Placa", d.vehiculo ? `${d.vehiculo.placa}${d.vehiculo.configuracion ? ` (${d.vehiculo.configuracion})` : ""}` : null],
                ["Remolque", d.remolque?.placa],
                ["Titular del manifiesto", d.vehiculo?.titular ? `${d.vehiculo.titular} · ${d.vehiculo.titularTipoId ?? ""} ${d.vehiculo.titularId ?? ""}` : d.vehiculo?.titularId],
                ["Conductor", d.conductor ? `${d.conductor.nombre} · CC ${d.conductor.cedula}` : null],
                ["Segundo conductor", d.conductor2 ? `${d.conductor2.nombre} · CC ${d.conductor2.cedula}` : null],
              ]}
            />
          </Seccion>

          <Seccion titulo="Valores">
            <Datos
              filas={[
                ["Valor del manifiesto (flete)", moneda(v.valorFleteReal)],
                ["Retencion FOPAT", moneda(v.retencionFopat)],
                ["Anticipo", moneda(v.valorAnticipoManifiesto)],
                ["Fecha de pago del saldo", v.fechaPagoSaldo ? soloDia(v.fechaPagoSaldo as unknown as string) : null],
                ["Trayecto vacio 1", v.vacio1Origen ? `${v.vacio1Origen} → ${v.vacio1Destino ?? ""} · ${moneda(v.vacio1Valor)}` : null],
                ["Trayecto vacio 2", v.vacio2Origen ? `${v.vacio2Origen} → ${v.vacio2Destino ?? ""} · ${moneda(v.vacio2Valor)}` : null],
              ]}
            />
          </Seccion>

          {d.remesas.map((r) => (
            <Seccion key={r.id} titulo={`Remesa ${r.consecutivoRemesa ?? ""}${r.plantilla ? ` · ${r.plantilla}` : ""}`}>
              <Datos
                filas={[
                  ["Radicado RNDC", r.numeroRemesaRndc],
                  ["Estado", r.estado === "CUMPLIDA" ? `Cumplida (radicado ${r.radicadoCumplido ?? "-"})` : r.estado === "CREADA" ? "Creada en el RNDC" : r.estado],
                  ["Producto", r.producto ? `${r.producto}${r.codMercancia ? ` · codigo ${r.codMercancia}` : ""}` : null],
                  ["Peso cargado", r.pesoReal !== null ? `${r.pesoReal.toLocaleString("es-CO")} kg` : null],
                  ["Peso entregado", r.cantidadEntregada !== null ? `${r.cantidadEntregada.toLocaleString("es-CO")} kg` : null],
                  ["Cita de cargue", fechaHora(r.fechaHoraCargue)],
                  ["Cita de descargue", fechaHora(r.fechaHoraDescargue)],
                  ["Tiempos pactados", r.pactoCargue ? `cargue ${r.pactoCargue} · descargue ${r.pactoDescargue}` : null],
                  ["Cliente (propietario de la carga)", tercero(r.contratante)],
                  ["Remitente (cargue)", tercero(r.remitente)],
                  ["Destinatario (descargue)", tercero(r.destinatario)],
                  ["Orden de servicio", r.ordenServicioGenerador],
                ]}
              />
            </Seccion>
          ))}

          {v.avisos && (
            <Seccion titulo="Avisos al despachar">
              <ul className="detalle-avisos">
                {v.avisos.split(" | ").map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </Seccion>
          )}
        </div>
      )}
    </Modal>
  );
}
