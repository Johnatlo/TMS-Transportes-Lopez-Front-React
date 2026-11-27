import { describe, expect, it } from "vitest";
import { contieneBusqueda, esEsencial, formatoTotal, ordenParaOcultar, sumaColumna } from "./TablaDatos";
import type { Columna } from "./TablaDatos";

describe("contieneBusqueda", () => {
  it("encuentra la placa por una parte, con o sin guion", () => {
    expect(contieneBusqueda("SPS199", "199")).toBe(true);
    expect(contieneBusqueda("SPS199", "sps-199")).toBe(true);
    expect(contieneBusqueda("SPS-199", "sps199")).toBe(true);
    expect(contieneBusqueda("SPS199", "198")).toBe(false);
  });

  it("no le importan tildes ni mayusculas", () => {
    expect(contieneBusqueda("GESTIÓN AMBIENTAL", "gestion")).toBe(true);
  });
});

describe("columnas que caben", () => {
  const col = (id: string, titulo: string, extra: Partial<Columna<number>> = {}): Columna<number> => ({ id, titulo, celda: () => null, ...extra });
  const columnas = [
    col("fecha", "Fecha"),
    col("placa", "Placa"),
    col("ruta", "Ruta"),
    col("estado", "Estado"),
    col("flete", "Flete", { prioridad: 0 }),
    col("pagoFactura", "Fecha pago factura"),
    col("remision", "Remision"),
    col("notas", "Notas"),
    col("borrar", ""),
  ];

  it("nunca oculta la primera columna, el estado, los documentos, los botones ni las de prioridad 0", () => {
    expect(esEsencial(columnas[0], 0, 1)).toBe(true);
    expect(esEsencial(columnas[3], 3, 1)).toBe(true);
    expect(esEsencial(columnas[4], 4, 1)).toBe(true);
    expect(esEsencial(columnas[6], 6, 1)).toBe(true);
    expect(esEsencial(columnas[8], 8, 1)).toBe(true);
    // "Fecha pago factura" no es el documento factura: se puede ocultar.
    expect(esEsencial(columnas[5], 5, 1)).toBe(false);
  });

  it("oculta primero las de la derecha, o las de mayor prioridad", () => {
    expect(ordenParaOcultar(columnas, 2)).toEqual(["notas", "pagoFactura", "ruta"]);
    const conPrioridad = columnas.map((c) => (c.id === "ruta" ? { ...c, prioridad: 99 } : c));
    expect(ordenParaOcultar(conPrioridad, 2)).toEqual(["ruta", "notas", "pagoFactura"]);
  });
});

describe("totales", () => {
  const c: Columna<{ v: number | null }> = { id: "v", titulo: "Valor", celda: () => null, valor: (f) => f.v };
  it("suma solo los numeros", () => {
    expect(sumaColumna([{ v: 1000 }, { v: null }, { v: 2500.5 }], c)).toBe(3500.5);
  });
  it("pesos con signo y miles; numeros con decimales", () => {
    expect(formatoTotal(1234567.4, "pesos")).toBe("$1.234.567");
    expect(formatoTotal(1234.5, "numero")).toBe("1.234,5");
  });
});
