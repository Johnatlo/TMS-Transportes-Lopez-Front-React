import { describe, expect, test } from "vitest";
import { puede, puedeRuta } from "./permisos";

describe("permisos por rol", () => {
  test("administrativo: lo operativo y Rentabilidad, sin liquidaciones ni usuarios", () => {
    expect(["/cuadro", "/anticipos", "/cartera", "/terceros", "/despacho", "/configuracion", "/rentabilidad"].every((r) => puedeRuta("ADMINISTRATIVO", r))).toBe(true);
    expect([puedeRuta("ADMINISTRATIVO", "/usuarios"), puede("ADMINISTRATIVO", "LIQUIDACION")]).toEqual([false, false]);
    // Los tres roles entran a Gastos (M&C solo ve los de su empresa: lo filtra el servidor).
    expect(["TOTAL", "ADMINISTRATIVO", "MYC"].every((r) => puedeRuta(r as never, "/gastos") && puedeRuta(r as never, "/nomina"))).toBe(true);
    // Utilidades (cascada y reparto): total y M&C; las administrativas no.
    expect(["TOTAL", "ADMINISTRATIVO", "MYC"].map((r) => puedeRuta(r as never, "/utilidades"))).toEqual([true, false, true]);
  });

  test("M&C: RNDC y sus cuentas, sin lo operativo de las dos empresas", () => {
    expect(["/despacho", "/historial", "/flota", "/vehiculos/SKX202", "/rentabilidad", "/preoperacional"].every((r) => puedeRuta("MYC", r))).toBe(true);
    expect(["/cuadro", "/anticipos", "/cartera", "/terceros", "/configuracion", "/usuarios"].some((r) => puedeRuta("MYC", r))).toBe(false);
  });

  test("total: todo; sin rol, como administrativo", () => {
    expect(["/usuarios", "/rentabilidad", "/cuadro"].every((r) => puedeRuta("TOTAL", r))).toBe(true);
    expect([puede(null, "OPERACION"), puede(null, "LIQUIDACION")]).toEqual([true, false]);
  });
});
