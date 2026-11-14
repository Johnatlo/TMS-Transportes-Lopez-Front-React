import { describe, expect, test } from "vitest";
import { puede, puedeRuta } from "./permisos";

describe("permisos por rol", () => {
  test("administrativo: lo operativo sin cuentas ni usuarios", () => {
    expect(["/cuadro", "/anticipos", "/cartera", "/terceros", "/despacho", "/configuracion"].every((r) => puedeRuta("ADMINISTRATIVO", r))).toBe(true);
    expect([puedeRuta("ADMINISTRATIVO", "/rentabilidad"), puedeRuta("ADMINISTRATIVO", "/usuarios")]).toEqual([false, false]);
  });

  test("M&C: RNDC y sus cuentas, sin lo operativo de las dos empresas", () => {
    expect(["/despacho", "/historial", "/flota", "/vehiculos/SKX202", "/rentabilidad", "/preoperacional"].every((r) => puedeRuta("MYC", r))).toBe(true);
    expect(["/cuadro", "/anticipos", "/cartera", "/terceros", "/configuracion", "/usuarios"].some((r) => puedeRuta("MYC", r))).toBe(false);
  });

  test("total: todo; sin rol, como administrativo", () => {
    expect(["/usuarios", "/rentabilidad", "/cuadro"].every((r) => puedeRuta("TOTAL", r))).toBe(true);
    expect([puede(null, "OPERACION"), puede(null, "CUENTAS")]).toEqual([true, false]);
  });
});
