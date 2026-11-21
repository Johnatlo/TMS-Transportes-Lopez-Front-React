import { describe, expect, test } from "vitest";
import { puede, puedeRuta } from "./permisos";

/** Todas las pantallas del menu. */
const RUTAS = ["/dashboard", "/despacho", "/historial", "/cuadro", "/anticipos", "/cartera", "/terceros", "/rentabilidad", "/gastos", "/nomina", "/utilidades", "/cuentas-vehiculos", "/preoperacional", "/vehiculos", "/plantillas", "/clientes", "/flota", "/conductores", "/configuracion", "/usuarios"];

describe("permisos por rol (17/11/2026)", () => {
  test("administrativo: todo menos el reparto de los socios y el cambio de roles", () => {
    // La liquidacion de conductores es solo de total y M&C (21/11/2026).
    expect(RUTAS.filter((r) => !puedeRuta("ADMINISTRATIVO", r))).toEqual(["/cuentas-vehiculos", "/usuarios"]);
    expect([puede("ADMINISTRATIVO", "REPARTO"), puede("ADMINISTRATIVO", "LIQUIDACION")]).toEqual([false, true]);
  });

  test("M&C: todo menos el cambio de roles (la rentabilidad de terceros la quita el servidor)", () => {
    expect(RUTAS.filter((r) => !puedeRuta("MYC", r))).toEqual(["/usuarios"]);
    expect(puede("MYC", "REPARTO")).toBe(true);
  });

  test("total: todo; sin rol, como administrativo", () => {
    expect(RUTAS.every((r) => puedeRuta("TOTAL", r))).toBe(true);
    expect([puede(null, "OPERACION"), puede(null, "REPARTO")]).toEqual([true, false]);
  });
});
