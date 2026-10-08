import { describe, expect, test } from "vitest";
import { fechaHora, moneda, soloDia } from "./cliente";

describe("moneda", () => {
  test("pesos colombianos con punto de miles", () => {
    expect(moneda(4_019_761)).toBe("4.019.761");
    expect(moneda(0)).toBe("0");
  });

  test("sin valor muestra un guion", () => {
    expect(moneda(null)).toBe("-");
    expect(moneda(undefined)).toBe("-");
  });
});

describe("fechaHora", () => {
  test("muestra la hora de Colombia aunque el equipo este en otra zona", () => {
    // 03:00 UTC del 1 de octubre = 22:00 del 30 de septiembre en Colombia.
    expect(fechaHora("2026-10-01T03:00:00Z")).toBe("30/09/2026, 22:00");
  });

  test("sin fecha muestra un guion", () => {
    expect(fechaHora(null)).toBe("-");
  });
});

describe("soloDia", () => {
  test("toma el dia tal cual, sin pasar por la zona horaria", () => {
    expect(soloDia("2026-09-30T00:00:00.000Z")).toBe("30/09/2026");
    expect(soloDia("2026-09-30")).toBe("30/09/2026");
  });

  test("texto vacio o mal formado muestra un guion", () => {
    expect(soloDia("")).toBe("-");
    expect(soloDia("x")).toBe("-");
  });
});
