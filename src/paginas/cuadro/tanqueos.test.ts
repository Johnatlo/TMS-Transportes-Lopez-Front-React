import { describe, expect, test } from "vitest";
import type { AnticipoBomba } from "../../api/cliente";
import { agruparPorTanqueo, coloresBombas, estadoTramo, faltaCruzar, posiblesVueltas, sugerenciasTramo } from "./tanqueos";

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
  valeEfectivo: null,
  efectivoEntregado: null,
  relacionId: null,
  descuentoGalon: 0,
  cruzadoManual: null,
  ...cambios,
  // Con numero de vale queda cruzado, salvo que la prueba diga otra cosa.
  cruzadoCombustible: cambios.cruzadoCombustible ?? !!cambios.vale,
  cruzadoEfectivo: cambios.cruzadoEfectivo ?? !!cambios.valeEfectivo,
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

  test("los vales armados a mano (sin numero) tambien dejan el tanqueo cruzado", () => {
    const t = tramo({ cruzadoCombustible: true, cruzadoEfectivo: true, relacionId: 1 });
    expect(faltaCruzar(t)).toEqual({ combustible: false, efectivo: false });
    expect(agruparPorTanqueo([t])[0].cruce).toBe("CRUZADO");
  });

  test("cruzado cuando lo que dio la bomba (combustible y efectivo) tiene vale; con diferencia si el vale cambio el valor", () => {
    expect(agruparPorTanqueo([tramo({ vale: "V1", valeEfectivo: "E1", relacionId: 1, combustibleEntregado: 1_100_000 })])[0].cruce).toBe("CRUZADO");
    // Falta el vale del efectivo: aun no esta cruzado.
    expect(agruparPorTanqueo([tramo({ vale: "V1", relacionId: 1 })])[0].cruce).toBe("SIN_CRUZAR");
    // El efectivo tambien cuenta en la diferencia.
    const [e] = agruparPorTanqueo([tramo({ vale: "V1", valeEfectivo: "E1", efectivo: 1_000_000, efectivoEntregado: 1_100_000 })]);
    expect([e.cruce, e.diferencia]).toEqual(["DIFERENCIA", -100_000]);
    const [g] = agruparPorTanqueo([tramo({ vale: "V1", valeEfectivo: "E1", relacionId: 1, combustible: 1_000_000, combustibleEntregado: 1_100_000 })]);
    expect([g.cruce, g.diferencia]).toEqual(["DIFERENCIA", -100_000]);
    // Con diferencia aunque falte el vale del efectivo: hay que revisarlo.
    expect(agruparPorTanqueo([tramo({ vale: "V1", combustible: 1_000_000, combustibleEntregado: 1_100_000 })])[0].cruce).toBe("DIFERENCIA");
    // La ida con vale y la vuelta sin vale: aun no esta cruzado del todo.
    expect(agruparPorTanqueo([tramo({ vale: "V1" }), tramo({ id: 2, tramo: "VUELTA" })])[0].cruce).toBe("SIN_CRUZAR");
  });

  test("los cargados del Excel con factura de la bomba cuentan como cruzados", () => {
    expect(agruparPorTanqueo([tramo({ facturaBomba: "AE5043413" })])[0].cruce).toBe("CRUZADO");
  });

  test("con factura de la bomba y pagado queda cruzado aunque le falte algun vale", () => {
    // La ida tiene vale y la vuelta no, pero la factura ya se pago.
    const pagados = [
      tramo({ vale: "V1", facturaBomba: "AE5043413", fechaPago: "2026-10-08" }),
      tramo({ id: 2, tramo: "VUELTA", facturaBomba: "AE5043413", fechaPago: "2026-10-08" }),
    ];
    expect(agruparPorTanqueo(pagados)[0].cruce).toBe("CRUZADO");
    // Sin la fecha de pago de la vuelta sigue sin cruzar.
    expect(agruparPorTanqueo([pagados[0], { ...pagados[1], fechaPago: null }])[0].cruce).toBe("SIN_CRUZAR");
  });

  test("marcado a mano queda cruzado (aun con diferencia); quitarlo vuelve a depender de los vales", () => {
    const [g] = agruparPorTanqueo([
      tramo({ vale: "V1", combustible: 1_000_000, combustibleEntregado: 1_100_000, cruzadoManual: "2026-11-11" }),
      tramo({ id: 2, tramo: "VUELTA", cruzadoManual: "2026-11-11" }),
    ]);
    expect([g.cruce, g.cruzadoManual]).toEqual(["CRUZADO", true]);
    // Solo la ida marcada: no cuenta como cruce a mano.
    expect(agruparPorTanqueo([tramo({ vale: "V1", cruzadoManual: "2026-11-11" }), tramo({ id: 2, tramo: "VUELTA" })])[0].cruce).toBe("SIN_CRUZAR");
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

describe("vista por tramo", () => {
  test("cada tramo tiene su propio estado frente a la bomba", () => {
    expect(estadoTramo(tramo({}))).toBe("SIN_CRUZAR");
    expect(estadoTramo(tramo({ vale: "V1", valeEfectivo: "E1" }))).toBe("CRUZADO");
    expect(estadoTramo(tramo({ facturaBomba: "AE1", fechaPago: "2026-10-08", vale: "V1" }))).toBe("CRUZADO");
    expect(estadoTramo(tramo({ cruzadoManual: "2026-11-11" }))).toBe("CRUZADO");
    expect(estadoTramo(tramo({ vale: "V1", combustible: 1_000_000, combustibleEntregado: 1_100_000 }))).toBe("DIFERENCIA");
    expect(estadoTramo(tramo({ bombaId: null, bomba: null, combustible: 0 }))).toBe("SOLO_EFECTIVO");
  });

  test("sugiere la pareja del tanqueo o los tramos sueltos de la placa ese dia", () => {
    const ida = tramo({ id: 1, tanqueoId: 1 });
    const vuelta = tramo({ id: 2, tanqueoId: 1, tramo: "VUELTA" });
    const suelto = tramo({ id: 3, tanqueoId: 2, empresa: "MADEIROS" });
    const otroDia = tramo({ id: 4, tanqueoId: 3, fecha: "2026-09-02" });
    const todos = [ida, vuelta, suelto, otroDia];
    expect(sugerenciasTramo(ida, todos)).toEqual([{ tipo: "PAREJA", otro: vuelta }]);
    // El suelto no se sugiere con una pareja ya completa; solo con otro suelto del mismo dia.
    expect(sugerenciasTramo(suelto, todos)).toEqual([]);
    const otroSuelto = tramo({ id: 5, tanqueoId: 4, tramo: "VUELTA", placa: "SWO-594" });
    expect(sugerenciasTramo(suelto, [...todos, otroSuelto])).toEqual([{ tipo: "POSIBLE", otro: otroSuelto }]);
  });
});
