import { describe, expect, test } from "vitest";
import { liquidarTercero, numeroONulo } from "./liquidacionTerceros";

const datos = {
  pesoKg: 33_200,
  valorTerceroTon: null,
  valorTerceroFijo: null,
  anticipoTransferencia: null,
  aplicaDescuentosTercero: false,
  icaPorMil: 3.3,
};

describe("liquidarTercero (las mismas cuentas del backend)", () => {
  test("por tonelada menos efectivo y combustible (Aura TLN-362)", () => {
    const l = liquidarTercero({ ...datos, valorTerceroTon: 100_000 }, { efectivo: 1_100_000, combustible: 1_100_000 });
    expect(l.valorTercero).toBe(3_320_000);
    expect(l.valorAPagar).toBe(1_120_000);
  });

  test("las retenciones solo se restan si se marcan", () => {
    const sin = liquidarTercero({ ...datos, valorTerceroFijo: 5_000_000 }, { efectivo: 0, combustible: 0 });
    expect(sin.totalDescuentos).toBe(50_000 + 16_500 + 5_000 + 3_000);
    expect(sin.valorAPagar).toBe(5_000_000);
    const con = liquidarTercero({ ...datos, valorTerceroFijo: 5_000_000, aplicaDescuentosTercero: true, anticipoTransferencia: 100_000 }, { efectivo: 0, combustible: 0 });
    expect(con.valorAPagar).toBe(5_000_000 - 100_000 - 74_500);
  });

  test("sin pactar no hay valor a pagar", () => {
    expect(liquidarTercero(datos, { efectivo: 0, combustible: 0 }).valorAPagar).toBeNull();
  });

  test("numeroONulo", () => {
    expect(numeroONulo(" ")).toBeNull();
    expect(numeroONulo("4.14")).toBe(4.14);
  });
});
