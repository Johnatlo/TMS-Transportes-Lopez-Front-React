import { describe, expect, it } from "vitest";
import type { ViajeTercero } from "../../api/cliente";
import { armarLiquidacion } from "./liquidacionPago";

/** Viaje de prueba con lo que usa la liquidacion. */
const viaje = (c: Partial<ViajeTercero>): ViajeTercero =>
  ({
    id: 1,
    tercero: "JAIRO YESID ESTUPINAN LOPEZ",
    placa: "SPS199",
    fecha: "2026-10-23",
    empresa: "ECOAMBIENTAL RECICLAJE S.A.S.",
    remision: "1190",
    manifiesto: "00006887",
    cuentaCobroTercero: "FE210",
    pesoKg: 34980,
    valorTerceroTon: 110000,
    valorTerceroFijo: null,
    valorTercero: 3847800,
    icaPorMil: 4,
    efectivo: 1099936,
    combustible: 1100064,
    transferencia: 0,
    ...c,
  }) as ViajeTercero;

describe("armarLiquidacion", () => {
  it("da lo mismo que la hoja FE210 del ejemplo", () => {
    const l = armarLiquidacion([viaje({})], { fecha: "2026-10-23", descontar: true, cuenta: "" });
    expect(l.totalViajes).toBe(3847800);
    expect(l.descuentos.map((d) => d.valor)).toEqual([38478, 3848, 15391, 25012]);
    expect(l.descuentos[2].descripcion).toBe("ReteIca. (Ecoambiental Reciclaje S.a.s. x 4/1000)");
    // Anticipo + poliza RCE: 1.099.936 + 1.100.064 + 3.000.
    expect(l.avances).toEqual([{ descripcion: "Anticipo + Poliza RCE (23/10/2026 · 00006887)", valor: 2203000 }]);
    // En el ejemplo: 1.562.070,59 (sin redondear cada descuento).
    expect(l.fleteTotal).toBe(1562071);
  });

  it("agrupa el ICA por cliente y solo resta anticipos si no se descuenta", () => {
    const viajes = [
      viaje({ id: 1, empresa: "CARTONES AMERICA", icaPorMil: 3.3, valorTercero: 1000000, efectivo: 0, combustible: 0 }),
      viaje({ id: 2, empresa: "CARTONES AMERICA", icaPorMil: 3.3, valorTercero: 1000000, efectivo: 0, combustible: 0, transferencia: 200000 }),
      viaje({ id: 3, empresa: "RECOLAM", icaPorMil: 0, valorTercero: 500000, efectivo: 0, combustible: 0 }),
    ];
    const l = armarLiquidacion(viajes, { fecha: "2026-10-23", descontar: true, cuenta: "" });
    expect(l.descuentos.filter((d) => d.descripcion.startsWith("ReteIca")).map((d) => [d.descripcion, d.valor])).toEqual([
      ["ReteIca. (Cartones America x 3,3/1000)", 6600],
      ["ReteIca. (Recolam x No presenta ICA)", 0],
    ]);
    const sin = armarLiquidacion(viajes, { fecha: "2026-10-23", descontar: false, cuenta: "" });
    expect(sin.descuentos).toEqual([]);
    // Los tres son del mismo manifiesto: un solo renglon.
    expect(sin.avances).toEqual([{ descripcion: "Adicional por transferencia (23/10/2026 · 00006887)", valor: 200000 }]);
    expect(l.avances).toEqual([
      { descripcion: "Poliza RCE (23/10/2026 · 00006887)", valor: 3000 },
      { descripcion: "Adicional por transferencia (23/10/2026 · 00006887)", valor: 200000 },
    ]);
    expect(sin.fleteTotal).toBe(2300000);
  });

  it("deja fuera los viajes sin pactar y usa la cuenta escrita si el viaje no tiene", () => {
    const l = armarLiquidacion([viaje({ cuentaCobroTercero: null }), viaje({ id: 2, valorTercero: null })], {
      fecha: "2026-10-23",
      descontar: true,
      cuenta: "FE211",
    });
    expect(l.filas).toHaveLength(1);
    expect(l.filas[0].factura).toBe("FE211");
  });
});
