/**
 * Excel del reporte de un socio en el mes (Reparto a socios > Reporte por
 * socio): una hoja con el resumen (sus carros y su reparto), otra con los
 * viajes de sus carros (como el cuadro SWK-973), otra con los gastos de cada
 * carro y otra con su cuenta mes a mes.
 */
import type { CuentaSocio, CuentaVehiculo, RepartoSocioUtilidad, UtilidadesMes } from "../../api/cliente";
import type { ColumnaTabla } from "../../componentes/excelTabla";
import { nombreMes } from "./pasos";

type FilaVehiculo = UtilidadesMes["vehiculos"][number];

/** Una columna del Excel. */
const col = (titulo: string, valores: Array<string | number | null>, derecha = false): ColumnaTabla => ({ titulo, valores, derecha });
/** Pesos enteros (el Excel les pone separador de miles y total). */
const pesos = (v: number) => Math.round(v);

/** Descarga el reporte del socio en el mes. */
export async function exportarReporteSocio(d: {
  u: UtilidadesMes;
  socio: { socioId: number; nombre: string };
  carros: FilaVehiculo[];
  parte: (v: FilaVehiculo) => number;
  reparto: RepartoSocioUtilidad | null;
  cuenta: CuentaSocio | null;
  viajes: CuentaVehiculo[];
}): Promise<void> {
  const { u, socio, carros, parte, reparto, cuenta, viajes } = d;
  const { descargarLibro } = await import("../../componentes/excelTabla");
  const suParte = (v: FilaVehiculo) => pesos((v.cascada.utilidad * parte(v)) / 100);

  const resumen: ColumnaTabla[] = [
    col(
      "Vehiculo",
      carros.map((v) => v.placa),
    ),
    col(
      "Empresa",
      carros.map((v) => (v.empresa === "MYC" ? "T. M&C" : "T. Lopez")),
    ),
    col(
      "Su parte (%)",
      carros.map((v) => parte(v)),
    ),
    col(
      "Viajes",
      carros.map((v) => v.cascada.viajes),
    ),
    col(
      "Fletes",
      carros.map((v) => pesos(v.cascada.ingresos)),
      true,
    ),
    col(
      "Descuentos del viaje",
      carros.map((v) => pesos(v.cascada.totalDescuentos)),
      true,
    ),
    col(
      "Anticipos y gastos directos",
      carros.map((v) => pesos(v.cascada.totalDirectos)),
      true,
    ),
    col(
      "Nomina del conductor",
      carros.map((v) => pesos(v.cascada.totalConductor)),
      true,
    ),
    col(
      "Gastos generales",
      carros.map((v) => pesos(v.cascada.totalGenerales)),
      true,
    ),
    col(
      "Utilidad del carro",
      carros.map((v) => pesos(v.cascada.utilidad)),
      true,
    ),
    col(
      "Su utilidad",
      carros.map((v) => suParte(v)),
      true,
    ),
    col(
      "Fondo: saldo anterior",
      carros.map((v) => (v.fondo ? pesos(v.fondo.saldoAnterior) : null)),
      true,
    ),
    col(
      "Fondo: se reparte",
      carros.map((v) => (v.fondo ? pesos(v.fondo.repartimos) : null)),
      true,
    ),
    col(
      "Fondo: saldo al cierre",
      carros.map((v) => (v.fondo ? pesos(v.fondo.saldoFinal) : null)),
      true,
    ),
  ];

  const conceptos: Array<[string, number]> = reparto
    ? [
        ["Su parte de lo repartido", pesos(reparto.repartido)],
        ["4 x 1000 de la transferencia", -pesos(reparto.gmf)],
        ["Su parte de lo liquidado por los viajes", pesos(reparto.liquidado)],
        ["Lo que el recibio de los viajes", -pesos(reparto.recibido)],
        ...reparto.gastosPropios.map((g): [string, number] => [`Gasto propio: ${g.descripcion}`, -pesos(g.monto)]),
      ]
    : [];
  const hojaReparto: ColumnaTabla[] = [
    col("Concepto", [
      ...conceptos.map(([t]) => t),
      reparto ? (reparto.neto < 0 ? "NETO DEL MES (lo debe el)" : "NETO DEL MES (se le debe)") : "Sin reparto en el mes",
    ]),
    col("Valor", [...conceptos.map(([, v]) => v), reparto ? pesos(reparto.neto) : null], true),
  ];

  const filasViajes = viajes.flatMap((v) => v.viajes.map((t) => ({ placa: v.placa, t })));
  const hojaViajes: ColumnaTabla[] = [
    col(
      "Vehiculo",
      filasViajes.map((x) => x.placa),
    ),
    col(
      "Fecha",
      filasViajes.map((x) => x.t.fecha),
    ),
    col(
      "Remision",
      filasViajes.map((x) => x.t.remision ?? x.t.manifiesto),
    ),
    col(
      "Empresa",
      filasViajes.map((x) => x.t.cliente),
    ),
    col(
      "Peso (kg)",
      filasViajes.map((x) => x.t.pesoKg),
    ),
    col(
      "Flete empresa",
      filasViajes.map((x) => pesos(x.t.flete)),
      true,
    ),
    col(
      "Descuentos",
      filasViajes.map((x) => pesos(x.t.descuentos)),
      true,
    ),
    col(
      "Producido",
      filasViajes.map((x) => pesos(x.t.producido)),
      true,
    ),
    col(
      "Anticipo",
      filasViajes.map((x) => pesos(x.t.anticipo)),
      true,
    ),
    col(
      "Saldo",
      filasViajes.map((x) => pesos(x.t.saldo)),
      true,
    ),
    col(
      "Pago saldo",
      filasViajes.map((x) => x.t.fechaPagoSaldo),
    ),
    col(
      "Conductor",
      filasViajes.map((x) => x.t.conductor),
    ),
    col(
      "Flete conductor",
      filasViajes.map((x) => (x.t.fleteConductor === null ? null : pesos(x.t.fleteConductor))),
      true,
    ),
    col(
      "% / integro",
      filasViajes.map((x) => (x.t.pagoConductor === null ? null : pesos(x.t.pagoConductor))),
      true,
    ),
    col(
      "Gastos del viaje",
      filasViajes.map((x) => (x.t.gastosViaje === null ? null : pesos(x.t.gastosViaje))),
      true,
    ),
    col(
      "Rojo",
      filasViajes.map((x) => (x.t.rojo === null ? null : pesos(x.t.rojo))),
      true,
    ),
  ];

  const partidas = carros.flatMap((v) =>
    (
      [
        ["Directo", v.cascada.directos],
        ["Conductor", v.cascada.conductor],
        ["General", v.cascada.generales],
      ] as const
    ).flatMap(([paso, lista]) => lista.map((p) => ({ placa: v.placa, paso, p }))),
  );
  const hojaGastos: ColumnaTabla[] = [
    col(
      "Vehiculo",
      partidas.map((x) => x.placa),
    ),
    col(
      "Tipo",
      partidas.map((x) => x.paso),
    ),
    col(
      "Categoria",
      partidas.map((x) => x.p.categoria),
    ),
    col(
      "Descripcion",
      partidas.map((x) => x.p.descripcion),
    ),
    col(
      "Valor",
      partidas.map((x) => pesos(x.p.monto)),
      true,
    ),
  ];

  const meses = cuenta?.meses ?? [];
  const hojaCuenta: ColumnaTabla[] = [
    col(
      "Mes",
      meses.map((m) => nombreMes(m.mes)),
    ),
    col(
      "Saldo anterior",
      meses.map((m) => pesos(m.saldoAnterior)),
      true,
    ),
    col(
      "Neto del mes",
      meses.map((m) => pesos(m.neto)),
      true,
    ),
    col(
      "Pagos",
      meses.map((m) => pesos(m.pagos)),
      true,
    ),
    col(
      "Saldo",
      meses.map((m) => pesos(m.saldo)),
      true,
    ),
  ];

  await descargarLibro(
    [
      { nombre: "Sus carros", columnas: resumen },
      { nombre: "Reparto", columnas: hojaReparto },
      { nombre: "Viajes", columnas: hojaViajes },
      { nombre: "Gastos de los carros", columnas: hojaGastos },
      { nombre: "Cuenta", columnas: hojaCuenta },
    ],
    `reporte-${socio.nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${u.mes}`,
  );
}
