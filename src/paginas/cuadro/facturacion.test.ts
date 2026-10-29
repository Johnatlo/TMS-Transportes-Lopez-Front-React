import { describe, expect, test } from "vitest";
import type { FilaPorFacturar, TarifaFlete } from "../../api/cliente";
import {
  agruparPorCliente,
  aplicarTarifa,
  convertirMatriz,
  filaInicial,
  normalizarNombre,
  notaFactura,
  pesoAFacturar,
  placaConGuion,
  adicionalDe,
  sugerirTarifa,
  totalDe,
  totalPorPeso,
  unificarFacturas,
} from "./facturacion";

let id = 0;
const tarifa = (
  nombre: string,
  razonSocial: string | null,
  valor: number | null,
  tipo: TarifaFlete["tipo"] = "TON",
  pesoMinimoKg: number | null = null
): TarifaFlete => ({ id: ++id, nombre, razonSocial, valor, tipo, pesoMinimoKg, pesoFijoKg: null, observaciones: null });

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

describe("tarifa sugerida con los datos del manifiesto", () => {
  // Tarifas reales de Tolua: una por ciudad y por tipo de carro.
  const TOLUA = "TOLUA MADERAS Y HERRAJES S.A.S.";
  const MATRIZ_TOLUA = [
    tarifa("TOLUA BOGOTA", TOLUA, 4569079, "FIJO"),
    tarifa("TOLUA BOGOTA 1 C. Y 1 CLI. ADIC", TOLUA, 4919079, "FIJO"),
    tarifa("TOLUA DUITAMA", TOLUA, 7192506, "FIJO"),
    tarifa("TOLUA PEREIRA", TOLUA, 2564796, "FIJO"),
    tarifa("TOLUA PEREIRA / VOLVO", TOLUA, 1904605, "FIJO"),
    tarifa("TOLUA SANTA ROSA VOLVO", TOLUA, 1962955, "FIJO"),
    tarifa("TOLUA B/VENTURA YUMBO", TOLUA, 2417300, "FIJO"),
    tarifa("TOLUA URBANO", TOLUA, 902651, "FIJO"),
    ...MATRIZ,
  ];
  const datos = (ruta: string, configuracion = "3S3", urbano = false) => ({ ruta, configuracion, urbano });
  const sugerida = (ruta: string, configuracion?: string, urbano?: boolean, ultimaId?: number) =>
    sugerirTarifa("TOLUA MADERAS Y HERRAJES SAS", MATRIZ_TOLUA, ultimaId, datos(ruta, configuracion, urbano))?.nombre;

  test("por el destino del manifiesto, aunque la ultima usada sea otra", () => {
    const bogota = MATRIZ_TOLUA[0].id;
    expect(sugerida("YUMBO VALLE DEL CAUCA → DUITAMA BOYACA", "3S3", false, bogota)).toBe("TOLUA DUITAMA");
    expect(sugerida("YUMBO VALLE DEL CAUCA → BOGOTA BOGOTA D. C.")).toBe("TOLUA BOGOTA");
    expect(sugerida("YUMBO VALLE DEL CAUCA → SANTA ROSA DE CABAL RISARALDA", "2")).toBe("TOLUA SANTA ROSA VOLVO");
    expect(sugerida("BUENAVENTURA VALLE DEL CAUCA → YUMBO VALLE DEL CAUCA")).toBe("TOLUA B/VENTURA YUMBO");
  });

  test("por el tipo de carro: tractomula sin VOLVO, camion rigido con VOLVO", () => {
    expect(sugerida("YUMBO VALLE DEL CAUCA → PEREIRA RISARALDA", "3S3")).toBe("TOLUA PEREIRA");
    expect(sugerida("YUMBO VALLE DEL CAUCA → PEREIRA RISARALDA", "2")).toBe("TOLUA PEREIRA / VOLVO");
  });

  test("urbano y reconocidos solo cuando el viaje lo es", () => {
    expect(sugerida("YUMBO VALLE DEL CAUCA → YUMBO VALLE DEL CAUCA", "3S3", true)).toBe("TOLUA URBANO");
    // Cartones America a Bogota: la normal, no la de reconocidos de cartulina a Bogota (esas se eligen a mano).
    const corame = sugerirTarifa("CARTONES AMERICA", MATRIZ_TOLUA, null, { ruta: "CALI VALLE DEL CAUCA → BOGOTA BOGOTA D. C.", configuracion: "3S3", urbano: false });
    expect(corame?.nombre).toBe("CORAME");
  });

  test("abreviaturas de la matriz y letras sueltas", () => {
    const porcelatino = [tarifa("PORCELATINO B/VENTURA BGTA", null, 190000), tarifa("PORCELATINO B/VENTURA M/LLIN", null, 200000)];
    const ruta = (r: string) => sugerirTarifa("PORCELATINO S.A.S", porcelatino, null, { ruta: r, configuracion: "3S3", urbano: false })?.nombre;
    expect(ruta("BUENAVENTURA VALLE DEL CAUCA → BOGOTA BOGOTA D. C.")).toBe("PORCELATINO B/VENTURA BGTA");
    expect(ruta("BUENAVENTURA VALLE DEL CAUCA → MEDELLIN ANTIOQUIA")).toBe("PORCELATINO B/VENTURA M/LLIN");
    expect(sugerirTarifa("MADEIROS L&D SAS", [tarifa("ALDAPLAST L.D SAS", "ALDAPLAST L.D SAS", 165000)])).toBeNull();
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
    // Reconocido de Cartones America: el concepto y su manifiesto en vez de la remision.
    expect(
      notaFactura({ flujoCorame: true, concepto: "RECONOCIDO CORAME", reconocidoDe: "00006852", remision: "", placa: "SZX826", tipo: "TON", pesoKg: 1638, valorTon: 168000, total: null })
    ).toBe("RECONOCIDO CORAME MANIFIESTO 00006852 TON 1,638 $168,000 SZX-826");
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
    estadoFactura: "SIN_FACTURAR",
    enviadoFacturarEn: null,
    tipoFlete: "KILO",
    tarifaKilo: null,
    valorFijo: null,
    fleteAdicional: null,
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
        estado: "RADICADO",
        estadoFactura: "FACTURADO_SIN_DATOS",
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

describe("tarifas POR y POR3 (2 y 3 clientes)", () => {
  const dekorando = tarifa("DEKORANDO J&N", "DEKORANDO J&N", 195000, "TON");
  const dos = tarifa("DEKORANDO J&N 2 CLIENTES", "DEKORANDO J&N", 195000, "POR");
  const tres = tarifa("DEKORANDO J&N 3 CLIENTES", "DEKORANDO J&N", 195000, "POR3");
  const fila = () => filaInicial(viaje({ empresa: "DEKORANDO J&N", pesoKg: 30000 }), []);

  test("adicional de 300.000 por cada cliente de mas", () => {
    expect(adicionalDe(dekorando)).toBeNull();
    expect(adicionalDe(dos)).toBe(300000);
    expect(adicionalDe(tres)).toBe(600000);
  });
  test("30 toneladas con 2 clientes: 195.000 x 30 + 300.000 = 6.150.000", () => {
    const e = aplicarTarifa(fila(), dos);
    expect(e.tipo).toBe("TON");
    expect(totalDe(e)).toBe(6150000);
    expect(totalDe(aplicarTarifa(fila(), tres))).toBe(6450000);
    expect(totalDe(aplicarTarifa(fila(), dekorando))).toBe(5850000);
  });
  test("el adicional guardado vuelve al abrir un viaje ya enviado", () => {
    const e = filaInicial(
      viaje({ enviadoFacturarEn: "2026-10-12T15:00:00Z", tarifaKilo: 195, pesoFacturadoKg: 30000, fleteAdicional: 300000 }),
      []
    );
    expect(totalDe(e)).toBe(6150000);
  });
  test("una tarifa sin valor deja el valor vacio para escribirlo a mano", () => {
    const e = aplicarTarifa(aplicarTarifa(fila(), dos), tarifa("RECICLAMAS", null, null, "TON"));
    expect(e.valorTon).toBeNull();
    expect(e.adicional).toBeNull();
    expect(totalDe(e)).toBeNull();
  });
});

describe("una factura por cliente (razon social)", () => {
  test("la misma razon social va junta aunque se escriba distinto", () => {
    const bloques = agruparPorCliente([
      { id: 1, razonSocial: "TOLUA MADERAS Y HERRAJES S.A.S." },
      { id: 2, razonSocial: "RECOLAM" },
      { id: 3, razonSocial: "Tolua Maderas y Herrajes SAS" },
      { id: 4, razonSocial: "PORCELATINOS S.A.S" },
      { id: 5, razonSocial: "recolam s. en c." },
      { id: 6, razonSocial: "" },
    ]);
    expect(bloques.map((b) => b.map((f) => f.id))).toEqual([[1, 3], [2, 5], [4], [6]]);
  });
  test("los viajes del cliente sin numero toman el que ya se escribio", () => {
    const { filas, conflictos } = unificarFacturas([
      { id: 1, razonSocial: "RECOLAM", facturaNumero: "" },
      { id: 2, razonSocial: "RECOLAM S.EN C.", facturaNumero: "tl 1111" },
      { id: 3, razonSocial: "APROREC SAS", facturaNumero: "" },
    ]);
    expect(conflictos).toEqual([]);
    expect(filas.map((f) => f.facturaNumero)).toEqual(["TL 1111", "tl 1111", ""]);
  });
  test("dos numeros distintos para el mismo cliente: se avisa", () => {
    const { conflictos } = unificarFacturas([
      { id: 1, razonSocial: "RECOLAM", facturaNumero: "TL 1111" },
      { id: 2, razonSocial: "RECOLAM", facturaNumero: "TL 1112" },
    ]);
    expect(conflictos).toEqual(["RECOLAM: TL 1111 y TL 1112"]);
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
  test("PEGANTE URBANO: siempre 33.000 kg y el valor por kilo pasa a valor por tonelada", () => {
    const [pegante] = convertirMatriz([
      {
        nombre: "PEGANTE URBANO",
        razonSocial: "TP FORMULADOS SAS",
        valor: 28.663636,
        tipo: "TON",
        observaciones: "en la factura el peso debe de ser 33,000 en la nota de la factura igual 33,000*28,663636",
      },
    ]);
    expect(pegante.pesoFijoKg).toBe(33000);
    expect(pegante.valor).toBeCloseTo(28663.636, 3);
    expect(pegante.observaciones).toContain("33,000");
    const e = aplicarTarifa(filaInicial(viaje({ empresa: "TP FORMULADOS SAS", pesoKg: 29150 }), []), { ...pegante, id: 99 });
    expect(e.pesoFacturadoKg).toBe(33000);
    expect(totalDe(e)).toBe(945900);
  });
});
