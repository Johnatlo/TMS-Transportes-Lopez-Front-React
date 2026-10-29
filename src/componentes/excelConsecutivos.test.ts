import { describe, expect, it } from "vitest";
import type { FilaConsecutivo } from "../api/cliente";
import { filaExcel, hojaDelMes } from "./excelConsecutivos";

/** Remesa de prueba como la primera fila del ejemplo (SPS-199, 00006185). */
const fila = (c: Partial<FilaConsecutivo>): FilaConsecutivo => ({
  viajeId: 1,
  remesaId: 1,
  orden: 1,
  fechaPlanillada: "2026-07-01T15:00:00.000Z",
  placa: "SPS199",
  cliente: "ECOAMBIENTAL RECICLAJES",
  pesoReal: 34000,
  valorManifiesto: 4024082,
  valorFacturar: 3740000,
  retencionFopat: 4024,
  valorAnticipo: 2200000,
  citaCargue: "2026-07-01T11:00:00.000Z",
  citaDescargue: "2026-07-06T23:00:00.000Z",
  consecutivoManifiesto: "00006185",
  radicadoManifiesto: "1",
  consecutivoRemesa: "00006185",
  radicadoRemesa: "163013870",
  estadoViaje: "CUMPLIDO",
  estadoRemesa: "CUMPLIDA",
  codMunicipioCargue: "25754000",
  municipioCargue: "SOACHA",
  producto: "CARTON RECICLADO",
  codMercancia: null,
  remitenteTipoId: "N",
  remitenteNit: "9014557062",
  remitenteNombre: "ECOAMBIENTAL RECICLAJES",
  codMunicipioDescargue: "76001000",
  municipioDescargue: "CALI",
  destinatarioTipoId: "N",
  destinatarioNit: "8600267594",
  destinatarioNombre: "CARTONES AMERICA",
  conductor: null,
  creadoPor: null,
  ...c,
});

describe("excel de consecutivos", () => {
  it("arma la fila como la del ejemplo", () => {
    const v = filaExcel(fila({}));
    expect(v.slice(1, 4)).toEqual(["SPS-199", "ECOAMBIENTAL RECICLAJES", 4024082]);
    expect(v[5]).toBe("CARGUE 01/07 06:00 DESCARGUE 06/07 18:00");
    expect(v.slice(6, 19)).toEqual([
      "00006185",
      "00006185",
      163013870,
      "CUMPLIDO",
      25754,
      "CARTON RECICLADO",
      "(31) NIT",
      9014557062,
      "ECOAMBIENTAL RECICLAJES",
      76001,
      "(31) NIT",
      8600267594,
      "CARTONES AMERICA",
    ]);
    // Valor Total Viaje: el valor a facturar del cuadro.
    expect(v[19]).toBe(3740000);
  });

  it("Cartones America con sus toneladas y los anulados marcados", () => {
    expect(filaExcel(fila({ cliente: "CARTONES AMERICA", pesoReal: 33298 }))[2]).toBe("CORAME 33,298");
    const anulado = filaExcel(fila({ estadoViaje: "ANULADO" }));
    expect([anulado[2], anulado[3], anulado[9]]).toEqual(["ANULADO", "ANULADO", "ANULADO"]);
  });

  it("la hoja del mes", () => {
    expect(hojaDelMes("2026-07-01T15:00:00.000Z")).toBe("JULIO 2026");
  });
});
