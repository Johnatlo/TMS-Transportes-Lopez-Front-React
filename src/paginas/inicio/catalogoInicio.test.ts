import { describe, expect, test } from "vitest";
import { CATALOGO, COLUMNAS, inicioDelRol, inicioUsable, ordenLectura, tarjetasDelRol } from "./catalogoInicio";

describe("catalogo del inicio", () => {
  test("los ids son unicos y validos para el backend, y caben en la rejilla", () => {
    const ids = CATALOGO.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of CATALOGO) {
      expect(t.id).toMatch(/^[a-z0-9:-]{1,40}$/);
      expect(t.w).toBeLessThanOrEqual(COLUMNAS);
      expect(t.minW).toBeLessThanOrEqual(t.w);
      expect(t.minH).toBeLessThanOrEqual(t.h);
    }
  });

  test("el inicio de cada rol no se pisa ni se sale de la rejilla", () => {
    for (const rol of ["TOTAL", "ADMINISTRATIVO", "MYC"] as const) {
      const inicio = inicioDelRol(rol);
      expect(inicio.length).toBeGreaterThan(0);
      const permitidas = new Set(tarjetasDelRol(rol).map((t) => t.id));
      const ocupadas = new Set<string>();
      for (const t of inicio) {
        expect(permitidas.has(t.id)).toBe(true);
        expect(t.x + t.w).toBeLessThanOrEqual(COLUMNAS);
        for (let x = t.x; x < t.x + t.w; x++)
          for (let y = t.y; y < t.y + t.h; y++) {
            expect(ocupadas.has(`${x},${y}`)).toBe(false);
            ocupadas.add(`${x},${y}`);
          }
      }
    }
  });

  test("sin inicio guardado se usa el del rol", () => {
    expect(inicioUsable(null, "TOTAL")).toEqual(inicioDelRol("TOTAL"));
    expect(inicioUsable(undefined, "MYC")).toEqual(inicioDelRol("MYC"));
  });

  test("del inicio guardado se quitan tarjetas que ya no existen o repetidas y se corrigen tamanos", () => {
    const usable = inicioUsable(
      [
        { id: "mapa", x: 11, y: 0, w: 1, h: 1 },
        { id: "tarjeta-vieja", x: 0, y: 0, w: 3, h: 2 },
        { id: "mapa", x: 0, y: 4, w: 4, h: 4 },
        { id: "hoy", x: 0, y: 2, w: 12, h: 6 },
      ],
      "ADMINISTRATIVO",
    );
    expect(usable).toEqual([
      { id: "mapa", x: 9, y: 0, w: 3, h: 3 },
      { id: "hoy", x: 0, y: 2, w: 12, h: 6 },
    ]);
    // Un inicio vacio se respeta (el usuario quito todo).
    expect(inicioUsable([], "TOTAL")).toEqual([]);
  });

  test("en el celular van de arriba a abajo y de izquierda a derecha", () => {
    const orden = ordenLectura([
      { id: "c", x: 0, y: 3, w: 4, h: 1 },
      { id: "b", x: 6, y: 0, w: 3, h: 2 },
      { id: "a", x: 0, y: 0, w: 3, h: 2 },
    ]).map((t) => t.id);
    expect(orden).toEqual(["a", "b", "c"]);
  });
});
