import { describe, expect, test } from "vitest";
import type { FilaPorFacturar, TarifaFlete } from "../../api/cliente";
import {
  agruparPorFactura,
  aplicarTarifa,
  convertirMatriz,
  filaInicial,
  normalizarNombre,
  notaFactura,
  pesoAFacturar,
  placaConGuion,
  sugerirTarifa,
  totalDe,
  totalPorPeso,
} from "./facturacion";

let id = 0;
const tarifa = (
  nombre: string,
  razonSocial: string | null,
  valor: number | null,
  tipo: TarifaFlete["tipo"] = "TON",
  pesoMinimoKg: number | null = null
): TarifaFlete => ({ id: ++id, nombre, razonSocial, valor, tipo, pesoMinimoKg, observaciones: null });

// Nombres reales de la matriz.
const MATRIZ = [
  tarifa("CORAME RECONOCIDO CARTULINA BOGOTA", "CARTONES AMERICA", 165000),
  tarifa("CORAME", "CARTONES AMERICA", 168000),
  tarifa("CORAME URBANO", "CARTONES AMERICA", 15000),
  tarifa("RECOLAM", "RECOLAM", 130000, "TON", 34000),
  tarifa("TOLUA BOGOTA", "TOLUA MADERAS Y HERRAJES S.A.S.", 4569079, "FIJO"),
  tarifa("ECOAMBIENTAL CARTON", "ECOAMBIENTAL RECICLAJES", 122250, "TON", 34000),
  tarifa("RECICLAJES CARTON", "RECICLAJES BOGOTA N.S.", 122250, "TON", 34000),
];

describe("nombres de clientes", () => {
  test("sin sufijos legales, tildes ni puntuacion", () => {
    expect(normalizarNombre("RECOLAM S.EN C.")).toBe("RECOLAM");
    expect(normalizarNombre("Tolúa Maderas y Herrajes S.A.S.")).toBe("TOLUA MADERAS Y HERRAJES");
    expect(normalizarNombre("APROREC S.A.S")).toBe("APROREC");
  });
});

describe("tarifa sugerida", () => {
  test("la de nombre mas corto del cliente (CORAME para Cartones America)", () => {
    expect(sugerirTarifa("CARTONES AMERICA", MATRIZ)?.nombre).toBe("CORAME");
  });
  test("con nombres distintos en el cuadro y en la matriz", () => {
    expect(sugerirTarifa("RECOLAM S.EN C.", MATRIZ)?.nombre).toBe("RECOLAM");
    expect(sugerirTarifa("TOLUA MADERAS Y HERRAJES SAS", MATRIZ)?.nombre).toBe("TOLUA BOGOTA");
    expect(sugerirTarifa("ECOAMBIENTAL RECICLAJE S.A.S.", MATRIZ)?.nombre).toBe("ECOAMBIENTAL CARTON");
    expect(sugerirTarifa("RECICLAJES BOGOTA N.S. S.A.S.", MATRIZ)?.nombre).toBe("RECICLAJES CARTON");
  });
  test("la ultima usada con el cliente manda", () => {
    const reconocido = MATRIZ[0];
    expect(sugerirTarifa("CARTONES AMERICA", MATRIZ, reconocido.id)?.id).toBe(reconocido.id);
  });
  test("cliente sin tarifa: null", () => {
    expect(sugerirTarifa("CLIENTE NUEVO SAS", MATRIZ)).toBeNull();
  });
});

describe("peso, total y nota", () => {
  test("por debajo del minimo pactado se factura el minimo", () => {
    const recolam = MATRIZ[3];
    expect(pesoAFacturar(31200, recolam)).toBe(34000);
    expect(pesoAFacturar(35100, recolam)).toBe(35100);
    expect(pesoAFacturar(31200, MATRIZ[1])).toBe(31200);
  });
  test("total por peso: toneladas x valor", () => {
    expect(totalPorPeso(34000, 168000)).toBe(5712000);
    expect(totalPorPeso(null, 168000)).toBeNull();
  });
  test("nota como la del ejemplo", () => {
    expect(placaConGuion("szp339")).toBe("SZP-339");
    expect(
      notaFactura({ flujoCorame: false, remision: "1111", placa: "SZP339", tipo: "TON", pesoKg: 34000, valorTon: 150000, total: null })
    ).toBe("REMISION 1111 TON 34,000 $150,000 SZP-339");
    expect(
      notaFactura({ flujoCorame: true, remision: "1261139", placa: "XJB207", tipo: "TON", pesoKg: 1067, valorTon: 168000, total: null })
    ).toBe("TRANSPORTE 1261139 TON 1,067 $168,000 XJB-207");
    expect(
      notaFactura({ flujoCorame: false, remision: "88", placa: "TEK298", tipo: "FIJO", pesoKg: 30000, valorTon: null, total: 4569079 })
    ).toBe("REMISION 88 $4,569,079 TEK-298");
  });
});

/** Viaje listo para facturar; cada prueba cambia lo que necesita. */
const viaje = (c: Partial<FilaPorFacturar> = {}): FilaPorFacturar =>
  ({
    id: 1,
    fecha: "2026-10-05",
    placa: "SKN250",
    empresa: "RECOLAM S.EN C.",
    conductor: "PEDRO",
    pesoKg: 31200,
    remision: "3964",
    remesa: "00006778",
    flujoCorame: false,
    estado: "RADICADO",
    enviadoFacturarEn: null,
    tipoFlete: "KILO",
    tarifaKilo: null,
    valorFijo: null,
    pesoFacturadoKg: null,
    tarifaFleteId: null,
    notaFactura: null,
    facturaNumero: null,
    radicadoRemesa: "169147717",
    ...c,
  }) as FilaPorFacturar;

describe("fila del cuadro de envio", () => {
  test("nueva: tarifa sugerida, peso minimo, total y nota", () => {
    const e = filaInicial(viaje(), MATRIZ);
    expect(e.incluir).toBe(true);
    expect(e.tarifaId).toBe(MATRIZ[3].id);
    expect(e.pesoFacturadoKg).toBe(34000);
    expect(e.valorTon).toBe(130000);
    expect(totalDe(e)).toBe(4420000);
    expect(e.notaFactura).toBe("REMISION 3964 TON 34,000 $130,000 SKN-250");
    expect(e.razonSocial).toBe("RECOLAM");
  });
  test("tarifa fija: total fijo y sin valor por tonelada", () => {
    const e = aplicarTarifa(filaInicial(viaje(), MATRIZ), MATRIZ[4]);
    expect(e.tipo).toBe("FIJO");
    expect(e.valorTon).toBeNull();
    expect(totalDe(e)).toBe(4569079);
  });
  test("la nota editada a mano no se pisa al cambiar la tarifa", () => {
    const e = { ...filaInicial(viaje(), MATRIZ), notaFactura: "MI NOTA", notaEditada: true };
    expect(aplicarTarifa(e, MATRIZ[1]).notaFactura).toBe("MI NOTA");
  });
  test("ya enviado: parte de lo guardado y no viene marcado", () => {
    const e = filaInicial(
      viaje({
        enviadoFacturarEn: "2026-10-12T15:00:00Z",
        estado: "FACTURADO_SIN_DATOS",
        tarifaKilo: 0.15,
        pesoFacturadoKg: 34000,
        notaFactura: "NOTA GUARDADA",
        facturaNumero: "TL 1111",
      }),
      MATRIZ
    );
    expect(e.incluir).toBe(false);
    expect(e.valorTon).toBe(150);
    expect(e.notaFactura).toBe("NOTA GUARDADA");
    expect(e.facturaNumero).toBe("TL 1111");
  });
});

describe("bloques por factura", () => {
  test("misma factura junta; sin numero, cada uno aparte", () => {
    const bloques = agruparPorFactura([
      { id: 1, facturaNumero: "TL 1111" },
      { id: 2, facturaNumero: "" },
      { id: 3, facturaNumero: "tl 1111" },
      { id: 4, facturaNumero: "TL 1112" },
      { id: 5, facturaNumero: "" },
    ]);
    expect(bloques.map((b) => b.map((f) => f.id))).toEqual([[1, 3], [2], [4], [5]]);
  });
});

describe("importar la matriz", () => {
  test("las filas '-34 TON' se vuelven peso minimo de la tarifa base", () => {
    const tarifas = convertirMatriz([
      { nombre: "APROREC", razonSocial: "APROREC SAS", valor: 130000, tipo: "TON", observaciones: "si es menor de 34..." },
      { nombre: "APROREC -34 TON", razonSocial: "APROREC SAS", valor: 4080000, tipo: "FIJO", observaciones: null },
      { nombre: "RECOLAM", razonSocial: "RECOLAM", valor: 130000, tipo: "TON", observaciones: null },
      { nombre: "RECOLAM - 34 TON", razonSocial: "RECOLAM", valor: null, tipo: "FIJO", observaciones: null },
      { nombre: "PEGANTE NEIVA", razonSocial: "TP FORMULADOS SAS", valor: "?", tipo: "FIJO", observaciones: null },
      { nombre: "", razonSocial: null, valor: null, tipo: null, observaciones: null },
      { nombre: "CRISTIAN 2 CLIENTES", razonSocial: "CRISTIAN", valor: 200000, tipo: "POR", observaciones: "POR UNA CIUDAD ADICIONAL 300 MIL" },
    ]);
    expect(tarifas.map((t) => [t.nombre, t.pesoMinimoKg, t.valor, t.tipo])).toEqual([
      ["APROREC", 34000, 130000, "TON"],
      ["RECOLAM", 34000, 130000, "TON"],
      ["PEGANTE NEIVA", null, null, "FIJO"],
      ["CRISTIAN 2 CLIENTES", null, 200000, "POR"],
    ]);
  });
});
