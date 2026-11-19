import { describe, expect, test } from "vitest";
import type { Gasto } from "../../api/cliente";
import { facturasCredito, rangoDe } from "./facturasCredito";

const gasto = (id: number, causaDesde: string, tipoFactura: Gasto["tipoFactura"], extra: Partial<Gasto> = {}) =>
  ({ id, causaDesde, tipoFactura, empresa: "LOPEZ", anulado: false, ...extra }) as Gasto;

describe("reporte de facturas credito", () => {
  test("rango del mes y de cada quincena", () => {
    expect(rangoDe("2026-11")).toEqual({ desde: "2026-11-01", hasta: "2026-11-30" });
    expect(rangoDe("2026-11-Q1")).toEqual({ desde: "2026-11-01", hasta: "2026-11-15" });
    expect(rangoDe("2026-02-Q2")).toEqual({ desde: "2026-02-16", hasta: "2026-02-28" });
  });
  test("solo las credito, no anuladas, de la empresa y del periodo, por fecha", () => {
    const gastos = [
      gasto(1, "2026-11-20", "CREDITO"),
      gasto(2, "2026-11-03", "CREDITO"),
      gasto(3, "2026-11-04", "DEBITO"),
      gasto(4, "2026-11-05", null),
      gasto(5, "2026-11-06", "CREDITO", { anulado: true }),
      gasto(6, "2026-11-07", "CREDITO", { empresa: "MYC" }),
      gasto(7, "2026-10-31", "CREDITO"),
    ];
    expect(facturasCredito(gastos, "2026-11", "LOPEZ").map((g) => g.id)).toEqual([2, 1]);
    expect(facturasCredito(gastos, "2026-11-Q1", "TODAS").map((g) => g.id)).toEqual([2, 6]);
    expect(facturasCredito(gastos, "2026-11-Q2", "LOPEZ").map((g) => g.id)).toEqual([1]);
  });
});
