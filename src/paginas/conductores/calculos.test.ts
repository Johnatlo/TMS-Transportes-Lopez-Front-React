import { describe, expect, test } from "vitest";
import type { ConceptoCuenta } from "../../api/cliente";
import { CONCEPTOS, leerMatrizConductor, mesAnterior, periodoConductores, textoPeriodo, totalesCuenta } from "./calculos";

const vacio = Object.fromEntries(CONCEPTOS.map(([k]) => [k, ""])) as Record<ConceptoCuenta, string>;

describe("cuenta de viaje mientras se escribe", () => {
  test("ACPM vacio = el combustible de los anticipos; saldo = gastos - lo recibido", () => {
    const t = totalesCuenta({ ...vacio, peajes: "726500", cargue: "100000" }, 1_990_041, 4_490_041);
    expect(t).toEqual({ acpm: 1_990_041, total: 2_816_541, saldo: -1_673_500 });
  });
  test("ACPM escrito a mano manda (aunque haya combustible del anticipo)", () => {
    expect(totalesCuenta({ ...vacio, acpm: "2350000", otros: "-70000" }, 2_000_000, 0).total).toBe(2_280_000);
  });
});

describe("matriz de fletes conductor del Excel (hoja TABLAS de SWK-973)", () => {
  test("toma el bloque FLETES CONDUCTOR (no el de la empresa) y lee hasta la primera fila vacia", () => {
    const filas: unknown[][] = [
      ["FLETES EMPRESA", "FLETES EMPRESA", "FLETES EMPRESA", null, null, "FLETES CONDUCTOR", "FLETES CONDUCTOR", "FLETES CONDUCTOR", "FLETES CONDUCTOR"],
      ["EMPRESA", "VALOR", "TIPO", "FECHA VIGENCIA", null, "EMPRESA", "VALOR", "FECHA VIGENCIA", "TIPO"],
      ["CORAME", 165000, "TON", new Date("1999-04-01T00:00:00Z"), null, "CORAME", 4200000, new Date("1999-04-01T00:00:00Z"), "FIJO"],
      ["BODEGAS", 116399, "TON", null, null, "BODEGAS", 100000, "2026-10-01", "TON"],
      [null, null, null, null, null, null, null, null, null],
      ["DESPUES", 1, "TON", null, null, "DESPUES", 1, null, "TON"],
    ];
    expect(leerMatrizConductor(filas)).toEqual([
      { nombre: "CORAME", valor: 4_200_000, tipo: "FIJO", desde: "1999-04-01" },
      { nombre: "BODEGAS", valor: 100_000, tipo: "TON", desde: "2026-10-01" },
    ]);
  });
  test("sin el titulo: una hoja con encabezados EMPRESA y VALOR; sin ellos, nada", () => {
    expect(
      leerMatrizConductor([
        ["EMPRESA", "VALOR"],
        ["ECOPLAST", 3900000],
      ]),
    ).toEqual([{ nombre: "ECOPLAST", valor: 3_900_000, tipo: "TON", desde: null }]);
    expect(leerMatrizConductor([["Otra cosa"]])).toEqual([]);
    expect(mesAnterior("2026-01")).toBe("2025-12");
  });
});

describe("corte de las cuentas de los conductores", () => {
  test("noviembre va del 27 de octubre al 26 de noviembre", () => {
    expect(periodoConductores("2026-11")).toEqual({ desde: "2026-10-27", hasta: "2026-11-26" });
    expect(textoPeriodo("2026-01")).toBe("del 27/12 al 26/01");
  });
});
