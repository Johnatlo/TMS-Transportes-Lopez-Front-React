/**
 * Reportes de la bomba (como un programa contable), por periodo:
 * - Resumen: deuda al inicio, lo que presto la bomba (efectivo y combustible),
 *   lo que se le pago (la empresa y los abonos de los socios) y la deuda al
 *   final.
 * - Por mes, por bomba y por empresa del vehiculo.
 * - Estado de cuenta: cada movimiento con el saldo de la deuda.
 * Todo se exporta a Excel (una hoja por tabla).
 */
import { useState } from "react";
import { apiCuadro, moneda } from "../../api/cliente";
import type { ReporteBomba as Reporte, TotalPrestado } from "../../api/cliente";
import { useDatos } from "../../ganchos/useDatos";
import { Cargando, ErrorCarga } from "../../componentes/Estado";
import Indicador from "../../componentes/Indicador";
import Modal from "../../componentes/Modal";
import { Pastilla } from "../../componentes/TablaDatos";
import type { TonoPastilla } from "../../componentes/TablaDatos";
import { periodosRapidos } from "../../componentes/periodos";
import { descargarReporte } from "../../componentes/excelReporte";
import { fechaCorta, hoyColombia } from "./estadosCuadro";

/** Como se ve cada tipo de movimiento. */
const TIPO: Record<string, { etiqueta: string; tono: TonoPastilla }> = {
  PRESTAMO: { etiqueta: "Prestamo", tono: "naranja" },
  ABONO_SOCIO: { etiqueta: "Abono socio", tono: "morado" },
  PAGO_EMPRESA: { etiqueta: "Pago empresa", tono: "ok" },
  PAGO: { etiqueta: "Pago", tono: "ok" },
};

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
/** "2026-09" -> "septiembre 2026". */
const nombreMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

/** Ventana de reportes de la bomba. */
export default function ReporteBomba({ alCerrar }: { alCerrar: () => void }) {
  const periodos = periodosRapidos(hoyColombia());
  const [desde, setDesde] = useState(periodos[0].desde);
  const [hasta, setHasta] = useState(periodos[0].hasta);
  const datos = useDatos(() => apiCuadro.reporteBomba(desde, hasta), [desde, hasta]);
  const r = datos.datos;
  const subtitulo = `Del ${fechaCorta(desde)} al ${fechaCorta(hasta)}`;

  function exportar(rep: Reporte) {
    const prestado = (nombre: string, lista: TotalPrestado[]) => ({
      nombre,
      columnas: [
        { titulo: nombre === "Por bomba" ? "Bomba" : "Empresa del vehiculo", ancho: 22 },
        { titulo: "Anticipos", formato: "numero" as const, ancho: 11 },
        { titulo: "Efectivo", formato: "pesos" as const },
        { titulo: "Combustible", formato: "pesos" as const },
        { titulo: "Total prestado", formato: "pesos" as const },
      ],
      filas: lista.map((b) => [b.nombre, b.anticipos, b.efectivo, b.combustible, b.total]),
      totales: ["TOTAL", lista.reduce((s, b) => s + b.anticipos, 0), rep.resumen.prestadoEfectivo, rep.resumen.prestadoCombustible, rep.resumen.prestado],
    });
    descargarReporte(
      {
        titulo: "TRANSPORTES LOPEZ C SAS - Cuenta con la bomba",
        subtitulo,
        hojas: [
          {
            nombre: "Resumen",
            columnas: [{ titulo: "Concepto", ancho: 40 }, { titulo: "Valor", formato: "pesos" }],
            filas: [
              ["Deuda con la bomba al inicio", rep.resumen.saldoInicial],
              ["Prestado en efectivo", rep.resumen.prestadoEfectivo],
              ["Prestado en combustible", rep.resumen.prestadoCombustible],
              ["Total prestado por la bomba", rep.resumen.prestado],
              ["Pagado por la empresa", rep.resumen.pagadoEmpresa],
              ["Abonado por los socios", rep.resumen.abonadoSocios],
              ["Total pagado a la bomba", rep.resumen.totalPagado],
              ["Deuda con la bomba al final", rep.resumen.saldoFinal],
            ],
          },
          {
            nombre: "Por mes",
            columnas: [
              { titulo: "Mes", ancho: 18 },
              { titulo: "Prestado", formato: "pesos" },
              { titulo: "Pagado empresa", formato: "pesos" },
              { titulo: "Abonado socios", formato: "pesos" },
              { titulo: "Total pagado", formato: "pesos" },
            ],
            filas: rep.porMes.map((m) => [nombreMes(m.mes), m.prestado, m.pagadoEmpresa, m.abonadoSocios, m.pagadoEmpresa + m.abonadoSocios]),
            totales: ["TOTAL", rep.resumen.prestado, rep.resumen.pagadoEmpresa, rep.resumen.abonadoSocios, rep.resumen.totalPagado],
          },
          prestado("Por bomba", rep.porBomba),
          prestado("Por empresa del vehiculo", rep.porEmpresaVehiculo),
          {
            nombre: "Estado de cuenta",
            columnas: [
              { titulo: "Fecha", formato: "fecha" },
              { titulo: "Movimiento", ancho: 16 },
              { titulo: "Descripcion", ancho: 44 },
              { titulo: "Prestamo (cargo)", formato: "pesos" },
              { titulo: "Pago (abono)", formato: "pesos" },
              { titulo: "Deuda", formato: "pesos" },
            ],
            filas: [
              [rep.estado.desde, "", "Deuda al inicio", null, null, rep.estado.saldoInicial],
              ...rep.estado.movimientos.map((m) => [m.fecha, TIPO[m.tipo]?.etiqueta ?? m.tipo, m.descripcion, m.cargo || null, m.abono || null, m.saldo]),
            ],
            totales: ["", "", "TOTALES / DEUDA AL FINAL", rep.estado.totalCargos, rep.estado.totalAbonos, rep.estado.saldoFinal],
          },
        ],
      },
      `reporte-bomba-${desde}-a-${hasta}`
    );
  }

  const tablaPrestado = (titulo: string, lista: TotalPrestado[]) => (
    <div>
      <h4 style={{ margin: "0 0 0.4rem" }}>{titulo}</h4>
      <table className="tabla">
        <thead>
          <tr>
            <th>{titulo === "Por bomba" ? "Bomba" : "Empresa del vehiculo"}</th>
            <th className="num">Anticipos</th>
            <th className="num">Efectivo</th>
            <th className="num">Combustible</th>
            <th className="num">Total</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((b) => (
            <tr key={b.nombre}>
              <td>{b.nombre}</td>
              <td className="num">{b.anticipos}</td>
              <td className="num">{moneda(b.efectivo)}</td>
              <td className="num">{moneda(b.combustible)}</td>
              <td className="num">
                <strong>{moneda(b.total)}</strong>
              </td>
            </tr>
          ))}
          {lista.length === 0 && (
            <tr>
              <td colSpan={5} className="empty-row">
                Sin anticipos en el periodo.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <Modal
      ancho="pantalla"
      titulo="Reportes de la bomba"
      alCerrar={alCerrar}
      pie={
        <>
          <button className="btn-secondary" onClick={alCerrar}>
            Cerrar
          </button>
          <button className="btn-primary" disabled={!r} onClick={() => r && exportar(r)}>
            Exportar Excel
          </button>
        </>
      }
    >
      <div className="barra-envio" style={{ marginBottom: "0.8rem" }}>
        <div className="tabla-pestanas" style={{ marginBottom: 0 }}>
          {periodos.map((p) => (
            <button
              key={p.id}
              className={p.desde === desde && p.hasta === hasta ? "activa" : ""}
              onClick={() => {
                setDesde(p.desde);
                setHasta(p.hasta);
              }}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>
        <label className="filas-por-pagina" style={{ marginLeft: "auto" }}>
          Desde
          <input type="date" value={desde} onChange={(e) => e.target.value && setDesde(e.target.value)} />
        </label>
        <label className="filas-por-pagina">
          Hasta
          <input type="date" value={hasta} onChange={(e) => e.target.value && setHasta(e.target.value)} />
        </label>
      </div>

      {datos.cargando && !r && <Cargando que="el reporte" />}
      {datos.error && <ErrorCarga mensaje={datos.error} alReintentar={datos.recargar} />}
      {r && (
        <>
          {r.fechasRaras.length > 0 && (
            <div className="alert danger">
              <strong>
                Hay {r.fechasRaras.length} anticipo{r.fechasRaras.length === 1 ? "" : "s"} con la fecha de pago a la bomba mal escrita.
              </strong>{" "}
              Descuadran el reporte (un pago con fecha de 1909 cuenta como pagado antes de deberle a la bomba). Corrigelos en
              el cuadro de Anticipos, en el tanqueo y su "Pago a la bomba":
              <ul style={{ margin: "0.4rem 0 0" }}>
                {r.fechasRaras.map((f, i) => (
                  <li key={i}>
                    Anticipo del {fechaCorta(f.fechaAnticipo)} · {f.placa} · {f.bomba} · {moneda(f.valor)}: fecha de pago{" "}
                    <strong>{f.fechaPago.split("-").reverse().join("/")}</strong> ({f.motivo})
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="tarjeta indicadores" style={{ marginBottom: "0.8rem" }}>
            <Indicador dinero titulo="Deuda al inicio" valor={moneda(r.resumen.saldoInicial)} detalle={fechaCorta(desde)} />
            <Indicador
              dinero
              titulo="Presto la bomba"
              valor={moneda(r.resumen.prestado)}
              detalle={`${r.resumen.anticipos} anticipos · efectivo ${moneda(r.resumen.prestadoEfectivo)} · combustible ${moneda(r.resumen.prestadoCombustible)}`}
            />
            <Indicador
              dinero
              titulo="Se le pago"
              valor={moneda(r.resumen.totalPagado)}
              detalle={`empresa ${moneda(r.resumen.pagadoEmpresa)} · socios ${moneda(r.resumen.abonadoSocios)}`}
            />
            <Indicador dinero titulo="Deuda al final" valor={moneda(r.resumen.saldoFinal)} detalle={fechaCorta(hasta)} alerta={r.resumen.saldoFinal > r.resumen.saldoInicial} />
          </div>

          <div className="reporte-columnas">
            <div>
              <h4 style={{ margin: "0 0 0.4rem" }}>Por mes</h4>
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th className="num">Presto</th>
                    <th className="num">Pago empresa</th>
                    <th className="num">Abono socios</th>
                    <th className="num">Total pagado</th>
                  </tr>
                </thead>
                <tbody>
                  {r.porMes.map((m) => (
                    <tr key={m.mes}>
                      <td>{nombreMes(m.mes)}</td>
                      <td className="num">{moneda(m.prestado)}</td>
                      <td className="num">{moneda(m.pagadoEmpresa)}</td>
                      <td className="num">{moneda(m.abonadoSocios)}</td>
                      <td className="num">
                        <strong>{moneda(m.pagadoEmpresa + m.abonadoSocios)}</strong>
                      </td>
                    </tr>
                  ))}
                  {r.porMes.length === 0 && (
                    <tr>
                      <td colSpan={5} className="empty-row">
                        Sin movimientos en el periodo.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {tablaPrestado("Por bomba", r.porBomba)}
            {tablaPrestado("Por empresa del vehiculo", r.porEmpresaVehiculo)}
          </div>

          <h4 style={{ margin: "1rem 0 0.4rem" }}>Estado de cuenta</h4>
          <table className="tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Movimiento</th>
                <th>Descripcion</th>
                <th className="num">Prestamo</th>
                <th className="num">Pago</th>
                <th className="num">Deuda</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{fechaCorta(desde)}</td>
                <td />
                <td>
                  <strong>Deuda al inicio</strong>
                </td>
                <td />
                <td />
                <td className="num">
                  <strong>{moneda(r.estado.saldoInicial)}</strong>
                </td>
              </tr>
              {r.estado.movimientos.map((m, i) => (
                <tr key={i}>
                  <td>{fechaCorta(m.fecha)}</td>
                  <td>
                    <Pastilla tono={TIPO[m.tipo]?.tono ?? "neutro"}>{TIPO[m.tipo]?.etiqueta ?? m.tipo}</Pastilla>
                  </td>
                  <td>{m.descripcion}</td>
                  <td className="num">{m.cargo ? moneda(m.cargo) : ""}</td>
                  <td className="num">{m.abono ? moneda(m.abono) : ""}</td>
                  <td className="num">{moneda(m.saldo)}</td>
                </tr>
              ))}
              <tr>
                <td />
                <td />
                <td>
                  <strong>Totales y deuda al final</strong>
                </td>
                <td className="num">
                  <strong>{moneda(r.estado.totalCargos)}</strong>
                </td>
                <td className="num">
                  <strong>{moneda(r.estado.totalAbonos)}</strong>
                </td>
                <td className="num">
                  <strong>{moneda(r.estado.saldoFinal)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </>
      )}
    </Modal>
  );
}
