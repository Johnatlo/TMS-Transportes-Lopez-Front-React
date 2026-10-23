import { describe, expect, test } from "vitest";
import { periodosRapidos } from "./periodos";

describe("periodos rapidos", () => {
  test("ultimos 2 meses, este mes, mes anterior, quincena y año", () => {
    const p = Object.fromEntries(periodosRapidos("2026-10-23").map((x) => [x.id, [x.desde, x.hasta]]));
    expect(p).toEqual({
      dosMeses: ["2026-08-23", "2026-10-23"],
      mes: ["2026-10-01", "2026-10-23"],
      mesAnterior: ["2026-09-01", "2026-09-30"],
      quincena: ["2026-10-16", "2026-10-23"],
      anio: ["2026-01-01", "2026-10-23"],
    });
  });

  test("en enero el mes anterior es diciembre; el 31 de un mes corto queda en su ultimo dia", () => {
    const enero = Object.fromEntries(periodosRapidos("2026-01-10").map((x) => [x.id, [x.desde, x.hasta]]));
    expect(enero.mesAnterior).toEqual(["2025-12-01", "2025-12-31"]);
    expect(enero.dosMeses).toEqual(["2025-11-10", "2026-01-10"]);
    expect(Object.fromEntries(periodosRapidos("2026-04-30").map((x) => [x.id, x.desde])).dosMeses).toBe("2026-02-28");
  });
});
