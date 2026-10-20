import { afterEach, describe, expect, test, vi } from "vitest";
import type { FilaCuadro } from "../../api/cliente";
import {
  etiquetaEstadoCuadro,
  fechaCorta,
  hoyColombia,
  muestraFactura,
  pasosPapeles,
  saldoVencido,
  textoEstados,
  tonoEstadoCuadro,
  tonoEstadoFactura,
} from "./estadosCuadro";

afterEach(() => {
  vi.useRealTimers();
});

describe("color y nombre del estado (los colores del Excel)", () => {
  const casos: Array<[FilaCuadro["estado"], string, string]> = [
    ["EN_RUTA", "neutro", "En proceso"],
    ["SIN_RADICAR", "morado", "Sin radicar"],
    ["RADICADO", "verde", "Listo para facturar"],
    ["RADICADOS", "turquesa", "Radicados"],
    ["PAGADO", "ok", "Todo pagado"],
    ["ANULADO", "neutro", "Anulado"],
  ];

  test.each(casos)("%s -> tono %s, etiqueta '%s'", (estado, tono, etiqueta) => {
    expect(tonoEstadoCuadro({ estado, todoPagado: false })).toBe(tono);
    expect(etiquetaEstadoCuadro({ estado, todoPagado: false })).toBe(etiqueta);
  });

  test("todo pagado es verde, sin importar el estado de la factura", () => {
    expect(tonoEstadoCuadro({ estado: "PAGADO", todoPagado: true })).toBe("ok");
    expect(etiquetaEstadoCuadro({ estado: "PAGADO", todoPagado: true })).toBe("Todo pagado");
  });

  test("la factura va aparte de los papeles; todo pagado reemplaza a los dos", () => {
    const facturado = { estado: "RADICADO" as const, estadoFactura: "FACTURADO" as const, todoPagado: false };
    expect(muestraFactura(facturado)).toBe(true);
    expect(textoEstados(facturado)).toBe("Listo para facturar · Facturado");
    expect(tonoEstadoFactura("FACTURADO_SIN_DATOS")).toBe("azul");
    expect(textoEstados({ ...facturado, estado: "SIN_RADICAR", estadoFactura: "FACTURADO_SIN_DATOS" })).toBe(
      "Sin radicar · Facturado sin datos"
    );
    expect(muestraFactura({ ...facturado, estadoFactura: "SIN_FACTURAR" })).toBe(false);
    const pagado = { estado: "PAGADO" as const, estadoFactura: "FACTURADO" as const, todoPagado: true };
    expect(muestraFactura(pagado)).toBe(false);
    expect(textoEstados(pagado)).toBe("Todo pagado");
  });
});

describe("pasos de los papeles", () => {
  test("CORAME / Cartones America: pasan por parqueadero y oficina de Don Alexander", () => {
    expect(pasosPapeles(true)).toEqual(["EN_RUTA", "DESCARGADO", "CONDUCTOR", "PARQUEADERO", "OFICINA", "RADICADO", "RADICADOS"]);
  });

  test("los demas clientes: del conductor directo a radicado", () => {
    expect(pasosPapeles(false)).toEqual(["EN_RUTA", "DESCARGADO", "CONDUCTOR", "RADICADO"]);
  });
});

describe("fechas", () => {
  test("fechaCorta pasa AAAA-MM-DD a DD/MM/AAAA sin correrse de dia", () => {
    expect(fechaCorta("2026-09-30")).toBe("30/09/2026");
    expect(fechaCorta("2026-09-30T00:00:00.000Z")).toBe("30/09/2026");
  });

  test("fechaCorta sin fecha muestra un guion", () => {
    expect(fechaCorta(null)).toBe("-");
    expect(fechaCorta(undefined)).toBe("-");
  });

  test("hoyColombia: de noche en UTC ya es manana, en Colombia todavia no", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-08T03:00:00Z")); // 22:00 del 7 de octubre en Colombia
    expect(hoyColombia()).toBe("2026-10-07");
  });
});

describe("saldo vencido de terceros (su viernes de pago)", () => {
  const tercero = {
    flota: "TERCERO",
    anulado: false,
    fechaPagoSaldo: null,
    venceSaldo: "2026-10-21",
  } as FilaCuadro;

  test("vence el dia indicado, no antes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-20T17:00:00Z"));
    expect(saldoVencido(tercero)).toBe(false);
    vi.setSystemTime(new Date("2026-10-21T17:00:00Z"));
    expect(saldoVencido(tercero)).toBe(true);
  });

  test("no aplica si ya se pago, si es flota propia o de un socio, o si el viaje esta anulado", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-30T17:00:00Z"));
    expect(saldoVencido({ ...tercero, fechaPagoSaldo: "2026-10-21" })).toBe(false);
    expect(saldoVencido({ ...tercero, flota: "LOPEZ" })).toBe(false);
    expect(saldoVencido({ ...tercero, dueno: "CELSO" })).toBe(false);
    expect(saldoVencido({ ...tercero, anulado: true })).toBe(false);
  });

  test("sin fecha de descargue no hay vencimiento", () => {
    expect(saldoVencido({ ...tercero, venceSaldo: null })).toBe(false);
  });
});
