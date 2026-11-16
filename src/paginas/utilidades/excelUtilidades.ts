/**
 * Excel de las utilidades de un mes: la cascada (un vehiculo por fila con
 * cada paso y cada descuento) y el detalle (cada viaje y cada partida del
 * libro con su paso), para cuadrarlo contra el Excel de la empresa; y el
 * reparto por socio.
 */
import type { UtilidadesMes } from "../../api/cliente";
import { DESCUENTOS, NOMBRE_PASO } from "./pasos";

/** Descarga la cascada por vehiculo del mes. */
export async function exportarCascada(u: UtilidadesMes): Promise<void> {
  const { descargarTabla } = await import("../../componentes/excelTabla");
  const v = u.vehiculos;
  const col = (titulo: string, valores: Array<string | number | null>, derecha = false) => ({ titulo, valores, derecha });
  await descargarTabla(
    [
      col(
        "Vehiculo",
        v.map((x) => x.placa),
      ),
      col(
        "Empresa",
        v.map((x) => (x.empresa === "MYC" ? "T. M&C" : "T. Lopez")),
      ),
      col(
        "Participacion",
        v.map((x) => x.participaciones.map((p) => `${p.socio} ${p.porcentaje} %`).join(" + ") || "Sin participacion"),
      ),
      col(
        "Viajes",
        v.map((x) => x.cascada.viajes),
        true,
      ),
      col(
        "1. Ingresos por fletes",
        v.map((x) => x.cascada.ingresos),
        true,
      ),
      ...DESCUENTOS.map(([k, t]) =>
        col(
          t,
          v.map((x) => x.cascada.descuentos[k]),
          true,
        ),
      ),
      col(
        "2. Total descuentos del viaje",
        v.map((x) => x.cascada.totalDescuentos),
        true,
      ),
      col(
        "Anticipos de los viajes",
        v.map((x) => x.cascada.anticipos),
        true,
      ),
      col(
        "Gastos directos del libro",
        v.map((x) => Math.round((x.cascada.totalDirectos - x.cascada.anticipos) * 100) / 100),
        true,
      ),
      col(
        "3. Total costos directos",
        v.map((x) => x.cascada.totalDirectos),
        true,
      ),
      col(
        "4. Nomina del conductor",
        v.map((x) => x.cascada.totalConductor),
        true,
      ),
      col(
        "5. Gastos generales prorrateados",
        v.map((x) => x.cascada.totalGenerales),
        true,
      ),
      col(
        "6. Utilidad neta",
        v.map((x) => x.cascada.utilidad),
        true,
      ),
      col(
        "Saldo liquidado al dueno (viajes)",
        v.map((x) => x.cascada.saldoViajes),
        true,
      ),
    ],
    `Cascada ${u.mes}`,
    `utilidades-cascada-${u.mes}`,
  );
}

/** Descarga el detalle del mes: cada viaje y cada partida del libro con su paso. */
export async function exportarDetalle(u: UtilidadesMes): Promise<void> {
  const { descargarTabla } = await import("../../componentes/excelTabla");
  const filas: Array<{ placa: string; paso: string; fecha: string | null; concepto: string; categoria: string; monto: number }> = [];
  for (const v of u.vehiculos) {
    for (const t of v.detalleViajes) {
      const desc = DESCUENTOS.reduce((s, [k]) => s + t[k], 0);
      filas.push({
        placa: v.placa,
        paso: "1. Flete",
        fecha: t.fecha,
        concepto: `${t.manifiesto ?? ""} ${t.cliente}`.trim(),
        categoria: "Viaje",
        monto: t.flete,
      });
      filas.push({
        placa: v.placa,
        paso: "2. Descuentos del viaje",
        fecha: t.fecha,
        concepto: `${t.manifiesto ?? ""} ${t.cliente}`.trim(),
        categoria: "Viaje",
        monto: -desc,
      });
      if (t.anticipo)
        filas.push({
          placa: v.placa,
          paso: "3. Anticipo del viaje",
          fecha: t.fecha,
          concepto: `${t.manifiesto ?? ""} ${t.cliente}`.trim(),
          categoria: "Viaje",
          monto: -t.anticipo,
        });
    }
    for (const p of [...v.cascada.directos, ...v.cascada.conductor, ...v.cascada.generales])
      filas.push({ placa: v.placa, paso: NOMBRE_PASO[p.paso], fecha: null, concepto: p.descripcion, categoria: p.categoria, monto: -p.monto });
  }
  const col = (titulo: string, valores: Array<string | number | null>, derecha = false) => ({ titulo, valores, derecha });
  await descargarTabla(
    [
      col(
        "Vehiculo",
        filas.map((f) => f.placa),
      ),
      col(
        "Paso",
        filas.map((f) => f.paso),
      ),
      col(
        "Fecha del viaje",
        filas.map((f) => f.fecha),
      ),
      col(
        "Concepto",
        filas.map((f) => f.concepto),
      ),
      col(
        "Categoria",
        filas.map((f) => f.categoria),
      ),
      col(
        "Valor (+ suma, - resta)",
        filas.map((f) => f.monto),
        true,
      ),
    ],
    `Detalle ${u.mes}`,
    `utilidades-detalle-${u.mes}`,
  );
}

/** Descarga el reparto por socio del mes. */
export async function exportarReparto(u: UtilidadesMes): Promise<void> {
  const { descargarTabla } = await import("../../componentes/excelTabla");
  const placa = (id: number) => u.vehiculos.find((v) => v.vehiculoId === id)?.placa ?? "?";
  const s = u.socios;
  const col = (titulo: string, valores: Array<string | number | null>, derecha = false) => ({ titulo, valores, derecha });
  await descargarTabla(
    [
      col(
        "Socio",
        s.map((x) => x.nombre),
      ),
      col(
        "Vehiculos",
        s.map((x) => x.porVehiculo.map((v) => `${placa(v.vehiculoId)} ${v.porcentaje} %`).join(", ")),
      ),
      col(
        "Utilidad de sus vehiculos",
        s.map((x) => x.utilidadVehiculos),
        true,
      ),
      col(
        "Gastos propios",
        s.map((x) => x.totalGastosPropios),
        true,
      ),
      col(
        "Gastos propios (detalle)",
        s.map((x) => x.gastosPropios.map((g) => g.descripcion).join("; ")),
      ),
      col(
        "Utilidad del socio",
        s.map((x) => x.total),
        true,
      ),
      col(
        "Ya liquidado en los viajes",
        s.map((x) => x.saldoViajes),
        true,
      ),
      col(
        "Diferencia (+ por darle, - debe)",
        s.map((x) => x.diferencia),
        true,
      ),
    ],
    `Reparto ${u.mes}`,
    `utilidades-reparto-${u.mes}`,
  );
}
