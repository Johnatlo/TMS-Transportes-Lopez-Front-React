import { describe, expect, test } from "vitest";
import type { OpcionesGastos } from "../../api/cliente";
import { aDestinos, aSeleccion, vehiculosDe, vistaPrevia } from "./destinos";

const opciones: OpcionesGastos = {
  vehiculos: [
    { id: 1, placa: "JTY219", empresa: "LOPEZ", dueno: "MAURICIO", activo: true },
    { id: 2, placa: "SKX202", empresa: "MYC", dueno: "MILLER", activo: true },
    { id: 3, placa: "SZP339", empresa: "MYC", dueno: "MILLER", activo: true },
    { id: 4, placa: "VIEJO1", empresa: "LOPEZ", dueno: null, activo: false },
  ],
  socios: [{ id: 2, nombre: "CELSO" }],
  categorias: ["OFICINA"],
  corte: "2026-10-01",
  cerrados: [],
};

describe("destinos del gasto", () => {
  test("atajos Lopez, M&C y Todos (solo vehiculos activos)", () => {
    expect([vehiculosDe(opciones, "LOPEZ"), vehiculosDe(opciones, "MYC"), vehiculosDe(opciones, "TODOS")]).toEqual([[1], [2, 3], [1, 2, 3]]);
  });

  test("lo marcado se envia como una parte por carro; las partes de socio incompletas se omiten", () => {
    const seleccion = {
      vehiculos: [2, 3],
      socios: [
        { socioId: 2, modo: "FIJO" as const, valor: "536264" },
        { socioId: null, modo: "FIJO" as const, valor: "" },
      ],
    };
    const destinos = aDestinos(seleccion);
    expect(destinos).toEqual([
      { tipo: "SOCIO", id: 2, modo: "FIJO", valor: 536264 },
      { tipo: "VEHICULO", id: 2, modo: "PARTE", valor: 1 },
      { tipo: "VEHICULO", id: 3, modo: "PARTE", valor: 1 },
    ]);
    expect(aSeleccion(destinos)).toEqual({ vehiculos: [2, 3], socios: [{ socioId: 2, modo: "FIJO", valor: "536264" }], empresa: false });
  });

  test("vista previa del credito Chelo: 536.264 directo y 322.510 por carro entre 13", () => {
    const v = vistaPrevia(4_728_889, { vehiculos: Array.from({ length: 13 }, (_, i) => i + 1), socios: [{ socioId: 2, modo: "FIJO", valor: "536264" }] });
    expect([v.directo, v.resto, v.partes, Math.round(v.porParte), v.problema]).toEqual([536_264, 4_192_625, 13, 322_510, null]);
  });

  test("avisa lo que falta", () => {
    expect(vistaPrevia(1000, { vehiculos: [], socios: [] }).problema).toMatch(/Marca los vehiculos/);
    // Lo asume la empresa: una parte, como un carro.
    expect(vistaPrevia(1000, { vehiculos: [1], socios: [], empresa: true })).toMatchObject({ partes: 2, porParte: 500, problema: null });
    expect(aDestinos({ vehiculos: [], socios: [], empresa: true })).toEqual([{ tipo: "EMPRESA", id: 0, modo: "PARTE", valor: 1 }]);
    expect(aSeleccion([{ tipo: "EMPRESA", id: 0, modo: "PARTE", valor: 1 }]).empresa).toBe(true);
    expect(vistaPrevia(1000, { vehiculos: [], socios: [{ socioId: 2, modo: "FIJO", valor: "400" }] }).problema).toMatch(/Falta repartir/);
    expect(vistaPrevia(1000, { vehiculos: [1], socios: [{ socioId: 2, modo: "FIJO", valor: "1400" }] }).problema).toMatch(/suman mas/);
    expect(vistaPrevia(1000, { vehiculos: [], socios: [{ socioId: 2, modo: "PORCENTAJE", valor: "100" }] }).problema).toBeNull();
  });
});
