import { describe, expect, it } from "vitest";
import { tipoDe, valorCelda } from "./excelTabla";

describe("tipoDe", () => {
  it("montos a la derecha son pesos; numeros con decimales, numero", () => {
    expect(tipoDe({ titulo: "Valor", valores: [4_500_000, null, 0], derecha: true })).toBe("pesos");
    expect(tipoDe({ titulo: "Toneladas", valores: [34.98, 33], derecha: true })).toBe("numero");
    expect(tipoDe({ titulo: "Viajes", valores: [3, 5] })).toBe("numero");
  });

  it("fechas y texto", () => {
    expect(tipoDe({ titulo: "Fecha", valores: ["2026-10-05", "", "2026-11-01T15:00:00.000Z"] })).toBe("fecha");
    expect(tipoDe({ titulo: "Placa", valores: ["SPS199", "2026-10-05"] })).toBe("texto");
    expect(tipoDe({ titulo: "Vacia", valores: [null, ""] })).toBe("texto");
  });
});

describe("valorCelda", () => {
  it("las fechas pasan a Date a mediodia y lo vacio queda vacio", () => {
    const d = valorCelda("2026-10-05", "fecha") as Date;
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 9, 5, 12]);
    expect(valorCelda("", "texto")).toBeNull();
    expect(valorCelda(1500, "pesos")).toBe(1500);
  });
});
