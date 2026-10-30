import { describe, expect, it } from "vitest";
import type { FilaRentabilidad, LiquidacionDueno } from "../../api/cliente";
import { armarLiquidacionDueno, conceptosAutomaticos, evaluarExpresion, limpiarExpresion, tituloCuenta } from "./liquidacionDuenos";

/** Viaje de prueba con lo que usa la liquidacion. */
const viaje = (c: Partial<FilaRentabilidad>): FilaRentabilidad =>
  ({ id: 1, fecha: "2026-05-13", placa: "SZP-339", remision: "1230033", manifiesto: null, saldoBeneficiario: 1_000_000, otrosDescuentos: 0, rentOtrosConcepto: null, ...c }) as FilaRentabilidad;

describe("evaluarExpresion", () => {
  it("hace las cuentas del ejemplo", () => {
    expect(evaluarExpresion("(82000/12)*2")).toBeCloseTo(13666.67, 2);
    expect(evaluarExpresion("(74763*3)+111554")).toBe(335843);
    expect(evaluarExpresion("-1700000*2")).toBe(-3400000);
  });

  it("acepta puntos de mil y coma decimal", () => {
    expect(evaluarExpresion("1.700.000")).toBe(1700000);
    expect(evaluarExpresion("1500,5")).toBe(1500.5);
    expect(limpiarExpresion(" 5.711.800 / 14 ")).toBe("5711800/14");
  });

  it("rechaza lo que no es una cuenta", () => {
    for (const t of ["", "abc", "2+", "(1+2", "1/0", "alert(1)"]) expect(evaluarExpresion(t)).toBeNull();
  });
});

describe("armarLiquidacionDueno", () => {
  const base = { grupo: "MILLER", nombre: "MILLER", fecha: "2026-07-01", pagado: null };

  it("ordena por fecha y deja los otros descuentos como concepto, sin contarlos dos veces", () => {
    const viajes = [viaje({ id: 2, fecha: "2026-06-10", saldoBeneficiario: 450_000, otrosDescuentos: 50_000, rentOtrosConcepto: "Bateria" }), viaje({})];
    const conceptos = conceptosAutomaticos(viajes, null);
    expect(conceptos).toEqual([{ descripcion: "Bateria SZP-339 (1230033)", expresion: "", valor: -50_000 }]);
    const l = armarLiquidacionDueno(viajes, conceptos, base);
    expect(l.filas.map((f) => f.id)).toEqual([1, 2]);
    expect(l.totalViajes).toBe(1_500_000);
    expect(l.total).toBe(1_450_000);
    expect(l.saldoPendiente).toBe(0);
  });

  it("arrastra el saldo pendiente de la anterior", () => {
    const anterior = { nombre: "MILLER", fecha: "2026-06-24", saldoPendiente: 4_000_000 } as LiquidacionDueno;
    const [c] = conceptosAutomaticos([], anterior);
    expect(c).toEqual({ descripcion: "SALDO PENDIENTE CUENTAS MILLER A 24-JUNIO - 2026", expresion: "", valor: 4_000_000 });
    expect(armarLiquidacionDueno([viaje({})], [c], { ...base, pagado: 3_000_000 }).saldoPendiente).toBe(2_000_000);
  });

  it("con total negativo no se paga nada", () => {
    const l = armarLiquidacionDueno([viaje({})], [{ descripcion: "Llanta", expresion: "", valor: -1_500_000 }], base);
    expect([l.total, l.pagado, l.saldoPendiente]).toEqual([-500_000, 0, -500_000]);
  });

  it("titulo como el del ejemplo", () => {
    expect(tituloCuenta("Miller", "2026-07-08")).toBe("CUENTAS MILLER A 08-JULIO - 2026");
  });
});
