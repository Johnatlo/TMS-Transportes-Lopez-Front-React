import { describe, expect, test } from "vitest";
import type { AnticipoBomba, RelacionBomba } from "../../api/cliente";
import { filasVales, resumenPago } from "./excelVales";

const relacion = (numero: string, vales: Array<Partial<RelacionBomba["vales"][number]>>): RelacionBomba => ({
  id: 1,
  numero,
  fecha: "2026-09-16",
  fechaVencimiento: "2026-10-08",
  pagoId: null,
  total: 0,
  fechaPago: null,
  nota: null,
  vales: vales.map((v, i) => ({ id: i + 1, tipo: "COMBUSTIBLE", eds: "EDS CHUSACA", vale: `V${i}`, fecha: "2026-09-01", hora: null, placa: "SWO594", galones: 98, valor: 0, tramoId: null, ...v })),
});

const tramo = { id: 10, fecha: "2026-09-01", placa: "SWO594", bomba: "CHUSACA", flota: "LOPEZ" } as AnticipoBomba;

describe("filasVales", () => {
  test("una fila por tanqueo y factura con el efectivo y el combustible de sus vales", () => {
    const filas = filasVales(
      [relacion("AE5043413", [{ tipo: "COMBUSTIBLE", valor: 1_100_000, tramoId: 10 }, { tipo: "EFECTIVO", valor: 1_100_000, tramoId: 10, galones: null }])],
      [tramo],
      "2026-10-08"
    );
    expect(filas).toEqual([
      {
        fecha: "2026-09-01",
        placa: "SWO-594",
        efectivo: 1_100_000,
        combustible: 1_100_000,
        descuento: 0,
        total: 2_200_000,
        eds: "CHUSACA",
        factura: "AE5043413",
        fechaFactura: "2026-09-16",
        venceFactura: "2026-10-08",
        empresaVehiculo: "LOPEZ",
        fechaPago: "2026-10-08",
      },
    ]);
  });

  test("un vale sin tanqueo en el TMS sale solo, con sus datos", () => {
    const [f] = filasVales([relacion("AE1", [{ valor: 500_000, placa: "SYK456", eds: "EDS RETORNO" }])], [], null);
    expect([f.placa, f.eds, f.combustible, f.empresaVehiculo]).toEqual(["SYK-456", "RETORNO", 500_000, ""]);
  });
});

describe("resumenPago", () => {
  test("totales y valor a pagar menos los abonos (ejemplo Vales Coesco)", () => {
    const filas = [{ efectivo: 64_038_621, combustible: 61_615_191, total: 125_653_812 }] as Parameters<typeof resumenPago>[0];
    expect(resumenPago(filas, [{ valor: 13_200_000 }, { valor: 15_400_000 }, { valor: 13_200_000 }])).toEqual({
      efectivo: 64_038_621,
      combustible: 61_615_191,
      total: 125_653_812,
      totalAbonos: 41_800_000,
      aPagar: 83_853_812,
    });
  });
});
