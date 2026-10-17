import { describe, expect, test } from "vitest";
import { anticiposDesdeFilas, carteraDesdeFilas, fechaCelda, numeroCelda } from "./cargaExcel";

const fecha = (t: string) => new Date(`${t}T00:00:00Z`);

describe("celdas", () => {
  test("numeros con comas de miles y espacios raros", () => {
    expect(numeroCelda("3,000,000.00 ")).toBe(3000000);
    expect(numeroCelda("624,500.00 ")).toBe(624500);
    expect(numeroCelda(1195840)).toBe(1195840);
    expect(numeroCelda("")).toBeNull();
    expect(numeroCelda("abc")).toBeNull();
  });
  test("fechas de exceljs (UTC) sin correrse de dia", () => {
    expect(fechaCelda(fecha("2026-07-02"))).toBe("2026-07-02");
    expect(fechaCelda("texto")).toBeNull();
  });
});

describe("hoja Cartera Total", () => {
  const filas: unknown[][] = [
    ["Fecha de Factura", "Fecha Vencimiento", "Dias Vencimiento Factura", "N° Factura", "Empresa", "Valor Factura", "V ANT. FACT", "SWO-594", "SZX-826"],
    [fecha("2026-07-02"), fecha("2026-08-01"), -77, 6918, "INGENIERIA DE TUBOS", 1195840, 4000000, null, 5195840],
    [fecha("2026-09-10"), fecha("2026-10-10"), 3, 7300, "RECOLAM", 8840000, null, 4420000, 4420000],
    // Fila de fecha sin numero de factura y totales por dueno: no son facturas.
    [fecha("2026-10-16"), fecha("2026-11-15"), 29, null, null, 0],
    ["CELSO", null, null, 185242009],
    ["TOTAL", null, null, -119279378],
  ];

  test("una factura por fila con fecha y numero, con el valor de cada placa", () => {
    expect(carteraDesdeFilas(filas)).toEqual([
      {
        numero: "6918",
        empresa: "INGENIERIA DE TUBOS",
        fecha: "2026-07-02",
        vence: "2026-08-01",
        valor: 1195840,
        placas: [{ placa: "SZX826", valor: 5195840 }],
      },
      {
        numero: "7300",
        empresa: "RECOLAM",
        fecha: "2026-09-10",
        vence: "2026-10-10",
        valor: 8840000,
        placas: [
          { placa: "SWO594", valor: 4420000 },
          { placa: "SZX826", valor: 4420000 },
        ],
      },
    ]);
  });

  test("sin la fila de titulos avisa", () => {
    expect(() => carteraDesdeFilas([["otra cosa"]])).toThrow(/Cartera Total/);
  });
});

describe("hoja de anticipos de las EDS", () => {
  test("cada fila con fecha y placa es un anticipo", () => {
    const filas: unknown[][] = [
      ["FECHA ANTICIPO", "PLACA", "EMPRESA PROV", "EFECTIVO", "COMBUST.", "GALONES", "DESC.", "VALOR TOTAL", "EDS ", "N° FACTURA", "FECHA FACTURA", "FECHA VENCIMIENTO", "EMPRESA DEL VEHICULO", "FECHA DE PAGO "],
      [fecha("2026-09-01"), "SWO-594", "CORONA", 1100000, 1099999.7, 98.39, 0, 2199999.7, "CHUSACA", "AE5043413", fecha("2026-09-16"), fecha("2026-10-08"), "LOPEZ", fecha("2026-10-08")],
      [null, null, null, null],
    ];
    expect(anticiposDesdeFilas(filas)).toEqual([
      {
        fila: 2,
        fecha: "2026-09-01",
        placa: "SWO-594",
        cliente: "CORONA",
        efectivo: 1100000,
        combustible: 1100000,
        galones: 98.39,
        descuento: 0,
        eds: "CHUSACA",
        facturaBomba: "AE5043413",
        fechaFacturaBomba: "2026-09-16",
        fechaPago: "2026-10-08",
      },
    ]);
  });
});
