import { describe, expect, test } from "vitest";
import { horaColombia, otroTema, preferenciaValida, temaDe, temaPorHora, temaValido } from "./modoPantalla";

/** Una fecha a esa hora de Colombia (UTC-5, sin horario de verano). */
const aLas = (hora: number, minuto = 0) => new Date(Date.UTC(2026, 10, 27, hora + 5, minuto));

describe("modo de la pantalla", () => {
  test("solo acepta oscuro o claro como modo fijo; lo demas es automatico", () => {
    expect(temaValido("oscuro")).toBe("oscuro");
    expect(temaValido("claro")).toBe("claro");
    expect(temaValido("auto")).toBeNull();
    expect(preferenciaValida("claro")).toBe("claro");
    expect(preferenciaValida("auto")).toBe("auto");
    expect(preferenciaValida(null)).toBe("auto");
    expect(preferenciaValida("azul")).toBe("auto");
  });

  test("la hora es la de Colombia", () => {
    expect(horaColombia(aLas(0))).toBe(0);
    expect(horaColombia(aLas(16, 59))).toBe(16);
    expect(horaColombia(aLas(23))).toBe(23);
  });

  test("de 5 a.m. a 5 p.m. es de dia (claro); el resto es de noche (oscuro)", () => {
    expect(temaPorHora(aLas(4, 59))).toBe("oscuro");
    expect(temaPorHora(aLas(5, 0))).toBe("claro");
    expect(temaPorHora(aLas(12))).toBe("claro");
    expect(temaPorHora(aLas(16, 59))).toBe("claro");
    expect(temaPorHora(aLas(17, 0))).toBe("oscuro");
    expect(temaPorHora(aLas(23, 30))).toBe("oscuro");
  });

  test("un modo fijo no cambia con la hora", () => {
    expect(temaDe("auto", aLas(10))).toBe("claro");
    expect(temaDe("auto", aLas(20))).toBe("oscuro");
    expect(temaDe("oscuro", aLas(10))).toBe("oscuro");
    expect(temaDe("claro", aLas(20))).toBe("claro");
  });

  test("el boton sol/luna cambia al otro modo", () => {
    expect(otroTema("oscuro")).toBe("claro");
    expect(otroTema("claro")).toBe("oscuro");
  });
});
