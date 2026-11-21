/**
 * Desglose de la cascada de un vehiculo en el mes, con los colores del
 * desglose de Rentabilidad: un bloque por paso (fletes, descuentos del viaje,
 * costos directos, nomina del conductor, gastos generales y utilidad) y, en
 * los gastos, uno por tipo de gasto (vehiculo, seguros, impuestos...) con su
 * subtotal, para no perderse al hacer las cuentas.
 */
import { useState } from "react";
import { moneda } from "../../api/cliente";
import type { PartidaUtilidad, UtilidadesMes } from "../../api/cliente";
import { Pastilla } from "../../componentes/TablaDatos";
import type { TonoPastilla } from "../../componentes/TablaDatos";
import { fechaCorta } from "../cuadro/estadosCuadro";
import { NOMBRE_CATEGORIA } from "../gastos/nombres";
import { DESCUENTOS, porCategoria } from "./pasos";
import LinksViaje from "../../componentes/LinksViaje";

type FilaVehiculo = UtilidadesMes["vehiculos"][number];

/** Color de cada tipo de gasto (el mismo en todos los pasos). */
const TONO_CATEGORIA: Record<string, TonoPastilla> = {
  VEHICULO: "naranja",
  SEGUROS: "azul",
  IMPUESTOS: "amarillo",
  CREDITO: "morado",
  NOMINA: "verde",
  OFICINA: "turquesa",
  SERVICIOS: "turquesa",
  SOCIO: "morado",
  OTROS: "neutro",
};
const ORDEN_CATEGORIAS = Object.keys(NOMBRE_CATEGORIA);

/** Un renglon: los que restan con "-", los ingresos repartidos (negativos) con "+"; "=" es un total. */
function Renglon({ etiqueta, valor, signo = "-", sangria = false }: { etiqueta: React.ReactNode; valor: number; signo?: "-" | "=" | ""; sangria?: boolean }) {
  const texto = signo === "=" || signo === "" ? moneda(valor) : valor < 0 ? `+ ${moneda(-valor)}` : valor > 0 ? `- ${moneda(valor)}` : "-";
  return (
    <tr className={signo === "=" ? "desglose-total" : valor ? "" : "desglose-cero"}>
      <td style={sangria ? { paddingLeft: "1.4rem" } : undefined}>{etiqueta}</td>
      <td className="num">{texto}</td>
    </tr>
  );
}

/** Titulo de un bloque. */
const Titulo = ({ texto }: { texto: string }) => (
  <tr className="desglose-titulo">
    <th colSpan={2}>{texto}</th>
  </tr>
);

/** Los gastos del libro de un paso, por tipo de gasto: la categoria con su subtotal y debajo cada gasto. */
function GastosPorTipo({ partidas }: { partidas: PartidaUtilidad[] }) {
  return (
    <>
      {porCategoria(partidas, ORDEN_CATEGORIAS).map((g) => (
        <FilasCategoria key={g.categoria} categoria={g.categoria} partidas={g.partidas} total={g.total} />
      ))}
    </>
  );
}

/** Una categoria: su pastilla de color y subtotal; sus gastos debajo (si son varios). */
function FilasCategoria({ categoria, partidas, total }: { categoria: string; partidas: PartidaUtilidad[]; total: number }) {
  const nombre = <Pastilla tono={TONO_CATEGORIA[categoria] ?? "neutro"}>{NOMBRE_CATEGORIA[categoria] ?? categoria}</Pastilla>;
  if (partidas.length === 1)
    return (
      <Renglon
        etiqueta={
          <>
            {nombre} {partidas[0].descripcion}
          </>
        }
        valor={total}
      />
    );
  return (
    <>
      <Renglon
        etiqueta={
          <>
            {nombre} <strong>{partidas.length} gastos</strong>
          </>
        }
        valor={total}
      />
      {partidas.map((p) => (
        <Renglon key={p.gastoId} etiqueta={<span className="dato-sec">{p.descripcion}</span>} valor={p.monto} sangria />
      ))}
    </>
  );
}

/** Cada paso de la cascada de un vehiculo con su detalle, por colores. */
export default function DesgloseVehiculo({ v }: { v: FilaVehiculo }) {
  const c = v.cascada;
  const [viajes, setViajes] = useState(false);
  const suma = (k: "combustible" | "efectivo" | "transferencia") => v.detalleViajes.reduce((s, t) => s + (t[k] ?? 0), 0);
  const partes = { combustible: suma("combustible"), efectivo: suma("efectivo"), transferencia: suma("transferencia") };
  const conPartes = partes.combustible + partes.efectivo + partes.transferencia > 0;
  return (
    <div className="detalle-tanqueo" onClick={(e) => e.stopPropagation()}>
      <div className="desglose-cascada">
        <table className="tabla tabla-compacta desglose">
          <tbody className="desglose-empresa">
            <Titulo texto={`1. Fletes (${c.viajes} viajes)`} />
            <Renglon etiqueta="Lo que pagan los clientes" valor={c.ingresos} signo="" />
          </tbody>
          <tbody className="desglose-tercero">
            <Titulo texto="2. Descuentos del viaje" />
            {DESCUENTOS.filter(([k]) => c.descuentos[k]).map(([k, t]) => (
              <Renglon key={k} etiqueta={t} valor={c.descuentos[k]} />
            ))}
            <Renglon etiqueta="Total descuentos" valor={c.totalDescuentos} signo="=" />
          </tbody>
          <tbody className="desglose-anticipo">
            <Titulo texto="3. Costos directos" />
            {conPartes ? (
              <>
                <Renglon etiqueta="Anticipos: combustible" valor={partes.combustible} />
                <Renglon etiqueta="Anticipos: efectivo" valor={partes.efectivo} />
                {partes.transferencia > 0 && <Renglon etiqueta="Anticipos: transferencia" valor={partes.transferencia} />}
              </>
            ) : (
              <Renglon etiqueta="Anticipos de los viajes" valor={c.anticipos} />
            )}
            <GastosPorTipo partidas={c.directos} />
            <Renglon etiqueta="Total directos" valor={c.totalDirectos} signo="=" />
          </tbody>
        </table>
        <table className="tabla tabla-compacta desglose">
          <tbody className="desglose-dueno">
            <Titulo texto="4. Nomina del conductor" />
            {c.conductor.length ? (
              <GastosPorTipo partidas={c.conductor} />
            ) : (
              <tr className="desglose-cero">
                <td colSpan={2}>Sin nomina aprobada en el mes.</td>
              </tr>
            )}
            <Renglon etiqueta="Total conductor" valor={c.totalConductor} signo="=" />
          </tbody>
          <tbody className="desglose-generales">
            <Titulo texto="5. Gastos generales prorrateados" />
            {c.generales.length ? (
              <GastosPorTipo partidas={c.generales} />
            ) : (
              <tr className="desglose-cero">
                <td colSpan={2}>Sin gastos generales en el mes.</td>
              </tr>
            )}
            <Renglon etiqueta="Total generales" valor={c.totalGenerales} signo="=" />
          </tbody>
          <tbody className="desglose-resultado">
            <Titulo texto="6. Utilidad neta" />
            <Renglon etiqueta="Fletes - descuentos - directos - conductor - generales" valor={c.utilidad} signo="=" />
            <Renglon etiqueta="Ya liquidado al dueno por los viajes (referencia)" valor={c.saldoViajes} signo="" />
          </tbody>
        </table>
      </div>
      {v.detalleViajes.length > 0 && (
        <>
          <button className="btn-link" onClick={() => setViajes(!viajes)}>
            {viajes ? "Ocultar viajes" : `Ver los ${v.detalleViajes.length} viajes`}
          </button>
          {viajes && (
            <div style={{ overflowX: "auto" }}>
              <table className="tabla tabla-compacta">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Manifiesto</th>
                    <th>Cliente</th>
                    <th className="num">Flete</th>
                    <th className="num">Descuentos</th>
                    <th className="num">Anticipo</th>
                    <th className="num">Saldo al dueno</th>
                  </tr>
                </thead>
                <tbody>
                  {v.detalleViajes.map((t) => (
                    <tr key={t.id}>
                      <td>{fechaCorta(t.fecha)}</td>
                      <td>
                        {t.manifiesto ?? "-"} <LinksViaje remisionUrl={t.remisionUrl} facturaUrl={t.facturaUrl} />
                      </td>
                      <td>{t.cliente}</td>
                      <td className="num">{moneda(t.flete)}</td>
                      <td className="num">{moneda(DESCUENTOS.reduce((s, [k]) => s + t[k], 0))}</td>
                      <td className="num">{moneda(t.anticipo)}</td>
                      <td className="num">{moneda(t.saldoBeneficiario)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
