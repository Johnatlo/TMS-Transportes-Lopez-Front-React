/**
 * Excel de las utilidades de un mes: la cascada (un vehiculo por fila con
 * cada paso y cada descuento) y el detalle (cada viaje y cada partida del
 * libro con su paso), para cuadrarlo contra el Excel de la empresa; los
 * fondos de los vehiculos y el reparto por socio.
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

/** Descarga los fondos del mes: por vehiculo, saldo anterior, utilidad, lo pagado al dueno, base, disponible, lo repartido y el saldo final. */
export async function exportarFondos(u: UtilidadesMes): Promise<void> {
  const { descargarTabla } = await import("../../componentes/excelTabla");
  const v = u.vehiculos.filter((x) => x.fondo);
  const col = (titulo: string, valores: Array<string | number | null>, derecha = false) => ({ titulo, valores, derecha });
  const f = (k: "saldoAnterior" | "utilidad" | "liquidado" | "antesDeRepartir" | "base" | "disponible" | "repartimos" | "saldoFinal") =>
    v.map((x) => x.fondo![k]);
  await descargarTabla(
    [
      col(
        "Vehiculo",
        v.map((x) => x.placa),
      ),
      col(
        "Participacion",
        v.map((x) => x.participaciones.map((p) => `${p.socio} ${p.porcentaje} %`).join(" + ") || "Sin participacion"),
      ),
      col("Saldo anterior (mes anterior)", f("saldoAnterior"), true),
      col("Utilidad del mes", f("utilidad"), true),
      col("Pagado al dueno por los viajes", f("liquidado"), true),
      col("Antes de repartir", f("antesDeRepartir"), true),
      col("Base", f("base"), true),
      col("Disponible", f("disponible"), true),
      col("Repartimos", f("repartimos"), true),
      col("Saldo final (pasa al mes siguiente)", f("saldoFinal"), true),
    ],
    `Fondos ${u.mes}`,
    `utilidades-fondos-${u.mes}`,
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
        "Tipo",
        s.map((x) => (x.externo ? "Externo" : "De la empresa")),
      ),
      col(
        "Vehiculos",
        s.map((x) => x.porVehiculo.map((v) => `${placa(v.vehiculoId)} ${v.porcentaje} %`).join(", ")),
      ),
      col(
        "Su parte de lo repartido",
        s.map((x) => x.repartido),
        true,
      ),
      col(
        `${u.gmfPorMil} x 1000`,
        s.map((x) => x.gmf),
        true,
      ),
      col(
        "Su parte de lo pagado por viajes",
        s.map((x) => x.liquidado),
        true,
      ),
      col(
        "Lo que el recibio de los viajes",
        s.map((x) => x.recibido),
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
        "Neto del mes (+ se le debe, - debe)",
        s.map((x) => x.neto),
        true,
      ),
    ],
    `Reparto ${u.mes}`,
    `utilidades-reparto-${u.mes}`,
  );
}
