import { describe, expect, test } from "vitest";
import { galonesTexto, tipoDeVale, valesDesdeFilas, valesDesdePdf } from "./relacionBomba";

/** Textos del PDF real AE5044797 (posiciones de pdfjs), recortado a dos vales. */
const PDF = [
  [
    { x: 184, y: 541, texto: "AE5044797" },
    { x: 34, y: 510, texto: "Fecha:" },
    { x: 85, y: 512, texto: "01/10/2026" },
    { x: 170, y: 512, texto: "01:01:20" },
    { x: 143, y: 418, texto: "Nro. Docu" },
    { x: 351, y: 418, texto: "Fecha" },
    { x: 400, y: 418, texto: "Placa" },
    { x: 672, y: 418, texto: "Cant." },
    { x: 734, y: 418, texto: "Valor" },
    { x: 43, y: 390, texto: "EDS CHUSACA" },
    { x: 139, y: 390, texto: "V56300011898" },
    { x: 181, y: 390, texto: "MAIVE ANDREA" },
    { x: 320, y: 390, texto: "52306988" },
    { x: 349, y: 390, texto: "30/09/2026" },
    { x: 377, y: 390, texto: "18:47:25" },
    { x: 400, y: 390, texto: "SWN62" },
    { x: 400, y: 378, texto: "3" },
    { x: 578, y: 390, texto: "BIODIESEL" },
    { x: 679, y: 390, texto: "89,767" },
    { x: 700, y: 390, texto: "gl" },
    { x: 733, y: 390, texto: "1,000,000.00" },
    { x: 43, y: 362, texto: "EDS SAN ESTEBAN" },
    { x: 139, y: 362, texto: "V46300001253" },
    { x: 320, y: 362, texto: "52306988" },
    { x: 349, y: 362, texto: "20/09/2026" },
    { x: 377, y: 362, texto: "19:11:55" },
    { x: 400, y: 362, texto: "SWN62" },
    { x: 400, y: 350, texto: "3" },
    { x: 679, y: 362, texto: "53,122" },
    { x: 700, y: 362, texto: "gl" },
    { x: 735, y: 362, texto: "594,435.00" },
  ],
];

describe("relacion de la bomba en PDF", () => {
  test("numero y fecha de la factura y cada vale con la placa partida en dos lineas", () => {
    expect(valesDesdePdf(PDF)).toEqual({
      numero: "AE5044797",
      fecha: "2026-10-01",
      vales: [
        { tipo: "COMBUSTIBLE", eds: "EDS CHUSACA", vale: "V56300011898", fecha: "2026-09-30", hora: "18:47:25", placa: "SWN623", galones: 89.767, valor: 1_000_000 },
        { tipo: "COMBUSTIBLE", eds: "EDS SAN ESTEBAN", vale: "V46300001253", fecha: "2026-09-20", hora: "19:11:55", placa: "SWN623", galones: 53.122, valor: 594_435 },
      ],
    });
  });

  test("galones con coma decimal", () => {
    expect(galonesTexto("89,767")).toBe(89.767);
    expect(galonesTexto("53,62")).toBe(53.62);
    expect(galonesTexto("")).toBeNull();
  });
});

describe("relacion de la bomba en Excel", () => {
  test("titulos, numero de factura arriba y un vale por fila", () => {
    const r = valesDesdeFilas([
      ["AE5044797", null, "COESCO COLOMBIA SAS"],
      ["Fecha:", "01/10/2026"],
      ["Id", "EDS", "Nro. Docu", "Destinatario", "Fecha", "Hora", "Placa", "Cant.", "Unid", "Valor"],
      [1, "EDS CHUSACA", "V56300011898", "MAIVE ANDREA", new Date("2026-09-30T00:00:00Z"), "18:47:25", "SWN623", 89.767, "gl", 1000000],
      ["TOTAL", null, null, null, null, null, null, null, null, 1000000],
    ]);
    expect(r).toEqual({
      numero: "AE5044797",
      fecha: "2026-10-01",
      vales: [{ tipo: "COMBUSTIBLE", eds: "EDS CHUSACA", vale: "V56300011898", fecha: "2026-09-30", hora: "18:47:25", placa: "SWN623", galones: 89.767, valor: 1_000_000 }],
    });
  });

  test("sin la fila de titulos avisa", () => {
    expect(() => valesDesdeFilas([["hola"]])).toThrow(/titulos/);
  });
});

describe("tipo de vale", () => {
  test("por el producto; sin producto, por si trae galones", () => {
    expect(tipoDeVale("BIODIESEL", 89.767)).toBe("COMBUSTIBLE");
    expect(tipoDeVale("EFECTIVO", 1)).toBe("EFECTIVO");
    expect(tipoDeVale("ANTICIPO EN EFECTIVO", null)).toBe("EFECTIVO");
    expect(tipoDeVale(null, null)).toBe("EFECTIVO");
    expect(tipoDeVale(null, 50)).toBe("COMBUSTIBLE");
  });

  test("en el Excel, la fila de efectivo queda sin galones", () => {
    const r = valesDesdeFilas([
      ["Id", "EDS", "Nro. Docu", "Fecha", "Placa", "Denomina Producto", "Cant.", "Valor"],
      [1, "EDS CHUSACA", "V1", new Date("2026-09-30T00:00:00Z"), "SWN623", "EFECTIVO", 1, 1200000],
      [2, "EDS CHUSACA", "V2", new Date("2026-09-30T00:00:00Z"), "SWN623", "BIODIESEL", 89.767, 1000000],
    ]);
    expect(r.vales.map((v) => [v.tipo, v.galones, v.valor])).toEqual([
      ["EFECTIVO", null, 1_200_000],
      ["COMBUSTIBLE", 89.767, 1_000_000],
    ]);
  });
});
