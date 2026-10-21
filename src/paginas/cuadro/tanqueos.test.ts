import { describe, expect, test } from "vitest";
import type { AnticipoBomba } from "../../api/cliente";
import { agruparPorTanqueo, coloresBombas, posiblesVueltas } from "./tanqueos";

/** Tramo de anticipo; cada prueba cambia lo que necesita. */
const tramo = (cambios: Partial<AnticipoBomba>): AnticipoBomba => ({
  id: 1,
  tanqueoId: 1,
  tramo: "IDA",
  fecha: "2026-09-01",
  placa: "SWO594",
  cuadroViajeId: 10,
  empresa: "CORONA",
  manifiesto: "00006500",
  efectivo: 1_100_000,
  combustible: 1_100_000,
  valor: 2_200_000,
  bombaId: 1,
  bomba: "CHUSACA",
  facturaBomba: null,
  fechaFacturaBomba: null,
  idaYVuelta: false,
  flota: "LOPEZ",
  fechaPago: null,
  nota: null,
  galones: null,
  precioGalon: null,
  descuento: null,
  combustibleEntregado: null,
  fechaViaje: "2026-09-01",
  vale: null,
  relacionId: null,
  ...cambios,
});

describe("agruparPorTanqueo", () => {
  test("ida y vuelta en un tanqueo, con sus totales", () => {
    const [g] = agruparPorTanqueo([
      tramo({ id: 2, tramo: "VUELTA", empresa: "MADEIROS", efectivo: 840_000, combustible: 960_000, valor: 1_800_000 }),
      tramo({ id: 1 }),
    ]);
    expect(g.ida.id).toBe(1);
    expect(g.vuelta?.id).toBe(2);
    expect(g.idaYVuelta).toBe(true);
    expect(g.total).toBe(4_000_000);
    expect(g.cruce).toBe("SIN_CRUZAR");
  });

  test("cruzado cuando todo su combustible tiene vale; con diferencia si el vale cambio el valor", () => {
    expect(agruparPorTanqueo([tramo({ vale: "V1", relacionId: 1, combustibleEntregado: 1_100_000 })])[0].cruce).toBe("CRUZADO");
    const [g] = agruparPorTanqueo([tramo({ vale: "V1", relacionId: 1, combustible: 1_000_000, combustibleEntregado: 1_100_000 })]);
    expect([g.cruce, g.diferencia]).toEqual(["DIFERENCIA", -100_000]);
    // La ida con vale y la vuelta sin vale: aun no esta cruzado del todo.
    expect(agruparPorTanqueo([tramo({ vale: "V1" }), tramo({ id: 2, tramo: "VUELTA" })])[0].cruce).toBe("SIN_CRUZAR");
  });

  test("los cargados del Excel con factura de la bomba cuentan como cruzados", () => {
    expect(agruparPorTanqueo([tramo({ facturaBomba: "AE5043413" })])[0].cruce).toBe("CRUZADO");
  });

  test("sin bomba es solo efectivo; pagado cuando todos sus tramos de la bomba tienen fecha", () => {
    expect(agruparPorTanqueo([tramo({ bombaId: null, bomba: null, combustible: 0 })])[0].cruce).toBe("SOLO_EFECTIVO");
    expect(agruparPorTanqueo([tramo({ fechaPago: "2026-10-08" })])[0].pagado).toBe(true);
  });
});

describe("posiblesVueltas", () => {
  test("otros tanqueos sueltos de la misma placa el mismo dia", () => {
    const todos = agruparPorTanqueo([
      tramo({ id: 1, tanqueoId: 1 }),
      tramo({ id: 2, tanqueoId: 2, bomba: "RETORNO", bombaId: 2 }),
      tramo({ id: 3, tanqueoId: 3, fecha: "2026-09-02" }),
      tramo({ id: 4, tanqueoId: 4, placa: "SRO029" }),
    ]);
    expect(posiblesVueltas(todos[0], todos).map((g) => g.tanqueoId)).toEqual([2]);
  });

  test("un tanqueo que ya es de ida y vuelta no tiene posibles", () => {
    const todos = agruparPorTanqueo([tramo({ id: 1 }), tramo({ id: 2, tramo: "VUELTA" }), tramo({ id: 3, tanqueoId: 3 })]);
    expect(posiblesVueltas(todos[0], todos)).toEqual([]);
  });
});

describe("coloresBombas", () => {
  test("un color distinto por bomba, sin verde", () => {
    const c = coloresBombas(["CHUSACA", "S. ESTEBAN", "RETORNO", null, "CHUSACA"]);
    expect(new Set(c.values()).size).toBe(3);
    expect([...c.values()]).not.toContain("verde");
  });
});
