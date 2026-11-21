/**
 * Lo que una linea de nomina carga al gasto (los vehiculos o el reparto del
 * empleado de oficina):
 * - Un checkbox por concepto (sueldo, auxilio, % y viaticos, cada aporte y
 *   cada provision): marcado va al gasto, desmarcado no (por ejemplo, de un
 *   empleado solo cesantias e intereses). Lo que se le paga no cambia. Se
 *   recuerda para la nomina siguiente.
 * - UPC adicional: lo que se paga por cada beneficiario adicional en salud
 *   (puede no ser empleado, por ejemplo un familiar del conductor): su cedula,
 *   su nombre, el valor y el vehiculo al que se carga. El cotizante es el
 *   empleado de la linea. Va con la salud en la planilla y la paga la empresa.
 * - Conductor: el porcentaje de su costo que va a cada vehiculo que manejo
 *   (lo que produjo en cada uno y los dias que tuvo cada uno, aunque en
 *   alguno no haya hecho viajes). Se puede corregir y queda guardado.
 */
import { useEffect, useState } from "react";
import { moneda } from "../../api/cliente";
import type { LineaNomina, OpcionesGastos } from "../../api/cliente";
import { placaConGuion } from "../cuadro/facturacion";

/** Los conceptos que pueden ir o no al gasto (los mismos de backend/src/calculoNomina.ts). */
export const CONCEPTOS_GASTO: Array<[keyof LineaNomina["calculo"], string]> = [
  ["basico", "Sueldo basico"],
  ["auxilio", "Auxilio de transporte"],
  ["variable", "% salarial del producido"],
  ["viaticos", "Viaticos"],
  ["saludEmpleador", "Salud (empresa)"],
  ["upcAdicional", "UPC adicional"],
  ["pensionEmpleador", "Pension (empresa)"],
  ["arl", "ARL"],
  ["caja", "Caja de compensacion"],
  ["prima", "Prima"],
  ["cesantias", "Cesantias"],
  ["interesesCesantias", "Intereses de cesantias"],
  ["vacaciones", "Vacaciones"],
  ["ajuste", "Ajuste"],
];

/** Los conceptos por grupo, con el color de cada uno (los de Rentabilidad). */
const GRUPOS_GASTO: Array<[string, string, string[]]> = [
  ["desglose-empresa", "Sueldo", ["basico", "auxilio", "variable", "viaticos"]],
  ["desglose-tercero", "Aportes", ["saludEmpleador", "upcAdicional", "pensionEmpleador", "arl", "caja"]],
  ["desglose-dueno", "Provisiones", ["prima", "cesantias", "interesesCesantias", "vacaciones", "ajuste"]],
];

/** Cambios que se mandan de una linea. */
export type CambioGasto = {
  excluidos?: string[];
  upcs?: Array<{ cedula: string; nombre: string; valor: number; vehiculoId: number }>;
  reparto?: Array<{ vehiculoId: number; porcentaje: number }> | null;
};

/** El bloque del gasto de una linea. */
export default function GastoLinea({
  l,
  editable,
  opciones,
  alCambiar,
}: {
  l: LineaNomina;
  /** Borrador y el usuario puede cambiar la linea. */
  editable: boolean;
  opciones: OpcionesGastos;
  alCambiar: (d: CambioGasto) => void;
}) {
  const c = l.calculo;
  const conductor = l.tipo === "CONDUCTOR";
  const vehiculos = opciones.vehiculos.filter((v) => v.activo || l.reparto.some((r) => r.vehiculoId === v.id) || l.upcs.some((u) => u.vehiculoId === v.id));
  /** Beneficiarios de UPC mientras se escriben (se guardan con el boton). */
  const aFormulario = () => l.upcs.map((u) => ({ cedula: u.cedula, nombre: u.nombre, valor: String(u.valor), vehiculoId: String(u.vehiculoId) }));
  const [upcs, setUpcs] = useState(aFormulario);
  useEffect(() => setUpcs(aFormulario()), [l.upcs]); // eslint-disable-line react-hooks/exhaustive-deps
  const upcCambio = JSON.stringify(upcs) !== JSON.stringify(aFormulario());
  const cambiarUpc = (i: number, c2: Partial<(typeof upcs)[number]>) => setUpcs(upcs.map((u, j) => (j === i ? { ...u, ...c2 } : u)));
  const vehiculoSugerido = String(l.reparto[0]?.vehiculoId ?? l.vehiculoId ?? "");
  const [reparto, setReparto] = useState(l.reparto.map((r) => ({ vehiculoId: r.vehiculoId, porcentaje: String(r.porcentaje) })));
  useEffect(() => setReparto(l.reparto.map((r) => ({ vehiculoId: r.vehiculoId, porcentaje: String(r.porcentaje) }))), [l.reparto]);
  const sumaReparto = Math.round(reparto.reduce((s, r) => s + (Number(r.porcentaje) || 0), 0) * 100) / 100;
  const repartoCambio =
    JSON.stringify(reparto.map((r) => [r.vehiculoId, Number(r.porcentaje)])) !== JSON.stringify(l.reparto.map((r) => [r.vehiculoId, r.porcentaje]));

  /** Marca o desmarca un concepto. */
  const alternar = (k: string) => alCambiar({ excluidos: l.excluidos.includes(k) ? l.excluidos.filter((x) => x !== k) : [...l.excluidos, k] });

  return (
    <div className="gasto-linea">
      <div className="bloque-nomina">
        <h5>Lo que va al gasto (marcado = se carga a los vehiculos)</h5>
        <table className="tabla tabla-compacta desglose tabla-gasto">
          {GRUPOS_GASTO.map(([tono, titulo, claves]) => {
            const visibles = CONCEPTOS_GASTO.filter(([k]) => claves.includes(k) && ((c[k] ?? 0) !== 0 || k === "upcAdicional"));
            if (!visibles.length) return null;
            return (
              <tbody key={titulo} className={tono}>
                <tr className="desglose-titulo">
                  <th colSpan={2}>{titulo}</th>
                </tr>
                {visibles.map(([k, nombre]) => {
                  const incluido = !l.excluidos.includes(k);
                  return (
                    <tr key={k} className={incluido ? "" : "desglose-cero fuera-gasto"}>
                      <td>
                        <label className="concepto-gasto">
                          <input type="checkbox" checked={incluido} disabled={!editable} onChange={() => alternar(k)} />
                          <span>{nombre}</span>
                        </label>
                      </td>
                      <td className="num">{moneda(c[k] ?? 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            );
          })}
          <tbody className="desglose-resultado">
            <tr className="desglose-total">
              <td>Total al gasto</td>
              <td className="num">{moneda(l.gasto.total)}</td>
            </tr>
          </tbody>
        </table>
        {l.gasto.total !== c.costoTotal && (
          <div className="dato-sec">De un costo total de {moneda(c.costoTotal)}. Lo que se le paga al empleado no cambia.</div>
        )}
      </div>
      <div className="bloque-nomina desglose-anticipo">
        <h5>UPC adicional</h5>
        <div className="dato-sec" style={{ marginBottom: "0.3rem" }}>
          Cotizante: <strong>{l.cotizante.nombre}</strong> ·{" "}
          {l.cotizante.cedula ? `CC ${l.cotizante.cedula}` : <span className="texto-vencido">sin cedula (ponla en Empleados)</span>}
        </div>
        {upcs.map((u, i) => (
          <div key={i} className="fila-upc">
            <input
              value={u.cedula}
              disabled={!editable}
              placeholder="Cedula"
              aria-label="Cedula del beneficiario"
              onChange={(e) => cambiarUpc(i, { cedula: e.target.value })}
            />
            <input
              value={u.nombre}
              disabled={!editable}
              placeholder="Nombre del beneficiario"
              aria-label="Nombre del beneficiario"
              onChange={(e) => cambiarUpc(i, { nombre: e.target.value })}
            />
            <input
              type="number"
              min={0}
              value={u.valor}
              disabled={!editable}
              placeholder="Valor"
              aria-label="Valor de la UPC"
              onChange={(e) => cambiarUpc(i, { valor: e.target.value })}
            />
            <select value={u.vehiculoId} disabled={!editable} aria-label="Vehiculo de la UPC" onChange={(e) => cambiarUpc(i, { vehiculoId: e.target.value })}>
              <option value="">Vehiculo...</option>
              {vehiculos.map((v) => (
                <option key={v.id} value={v.id}>
                  {placaConGuion(v.placa)}
                </option>
              ))}
            </select>
            {editable && (
              <button className="btn-link" onClick={() => setUpcs(upcs.filter((_, j) => j !== i))}>
                Quitar
              </button>
            )}
          </div>
        ))}
        {!upcs.length && <div className="dato-sec">Sin UPC adicional.</div>}
        {editable && (
          <div className="detalle-tanqueo-pie" style={{ marginTop: "0.3rem" }}>
            <button className="btn-link" onClick={() => setUpcs([...upcs, { cedula: "", nombre: "", valor: "", vehiculoId: vehiculoSugerido }])}>
              + Beneficiario
            </button>
            {upcCambio && (
              <button
                className="btn-secondary"
                onClick={() =>
                  alCambiar({ upcs: upcs.map((u) => ({ cedula: u.cedula, nombre: u.nombre, valor: Number(u.valor), vehiculoId: Number(u.vehiculoId) })) })
                }
              >
                Guardar UPC ({moneda(upcs.reduce((s, u) => s + (Number(u.valor) || 0), 0))})
              </button>
            )}
          </div>
        )}
        <div className="dato-sec">
          Por cada beneficiario (puede no ser empleado, por ejemplo un familiar). Va con la salud en la planilla, la paga la empresa y se carga a su vehiculo.
        </div>
      </div>
      {conductor && (
        <div className="bloque-nomina desglose-generales">
          <h5>Reparto entre vehiculos {l.repartoManual ? "(escrito a mano)" : "(automatico)"}</h5>
          {reparto.map((r, i) => (
            <div key={i} className="fila-reparto">
              <select
                value={r.vehiculoId}
                disabled={!editable}
                aria-label="Vehiculo"
                onChange={(e) => setReparto(reparto.map((x, j) => (j === i ? { ...x, vehiculoId: Number(e.target.value) } : x)))}
              >
                {vehiculos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {placaConGuion(v.placa)}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={r.porcentaje}
                disabled={!editable}
                aria-label="Porcentaje"
                onChange={(e) => setReparto(reparto.map((x, j) => (j === i ? { ...x, porcentaje: e.target.value } : x)))}
              />
              <span className="dato-sec">% · {moneda(Math.round(l.gasto.general * (Number(r.porcentaje) || 0)) / 100)}</span>
              {editable && reparto.length > 1 && (
                <button className="btn-link" onClick={() => setReparto(reparto.filter((_, j) => j !== i))}>
                  Quitar
                </button>
              )}
            </div>
          ))}
          {editable && (
            <div className="detalle-tanqueo-pie" style={{ marginTop: "0.3rem" }}>
              <button
                className="btn-link"
                onClick={() =>
                  setReparto([
                    ...reparto,
                    { vehiculoId: vehiculos.find((v) => !reparto.some((r) => r.vehiculoId === v.id))?.id ?? vehiculos[0]?.id, porcentaje: "0" },
                  ])
                }
              >
                + Otro vehiculo
              </button>
              {repartoCambio && (
                <button
                  className="btn-secondary"
                  disabled={Math.abs(sumaReparto - 100) > 0.01}
                  title={Math.abs(sumaReparto - 100) > 0.01 ? `Suman ${sumaReparto} %: deben sumar 100 %` : undefined}
                  onClick={() => alCambiar({ reparto: reparto.map((r) => ({ vehiculoId: r.vehiculoId, porcentaje: Number(r.porcentaje) })) })}
                >
                  Guardar reparto ({sumaReparto} %)
                </button>
              )}
              {l.repartoManual && (
                <button className="btn-link" onClick={() => alCambiar({ reparto: null })}>
                  Volver al automatico
                </button>
              )}
            </div>
          )}
          <div className="dato-sec">
            Automatico: lo del producido segun lo que produjo en cada carro y el resto (sueldo, auxilio y su carga) segun los dias que tuvo cada uno, aunque en
            alguno no haya hecho viajes. Al aprobar queda guardado.
          </div>
        </div>
      )}
    </div>
  );
}
