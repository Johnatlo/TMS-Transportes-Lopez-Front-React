import { describe, expect, test } from "vitest";
import type { AnticipoBomba } from "../../api/cliente";
import { agruparPorTanqueo } from "./tanqueos";
import { columnasAnticipos, filasAnticipos } from "./excelAnticipos";

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
  facturaBomba: "AE5043413",
  fechaFacturaBomba: "2026-09-16",
  idaYVuelta: true,
  flota: "LOPEZ",
  fechaPago: "2026-10-08",
  nota: null,
  galones: null,
  precioGalon: null,
  descuento: null,
  combustibleEntregado: null,
  fechaViaje: "2026-09-01",
  vale: null,
  valeEfectivo: null,
  cruzadoCombustible: false,
  cruzadoEfectivo: false,
  efectivoEntregado: null,
  relacionId: null,
  descuentoGalon: 0,
  cruzadoManual: null,
  ...cambios,
});

describe("Excel del cuadro de anticipos", () => {
  test("la ida y la vuelta de un tanqueo salen en filas aparte, cada una con su valor", () => {
    const tanqueos = agruparPorTanqueo([
      tramo({ id: 2, tramo: "VUELTA", empresa: "MADEIROS", efectivo: 839_996, combustible: 960_004, valor: 1_800_000 }),
      tramo({ id: 1 }),
      tramo({ id: 3, tanqueoId: 2, placa: "SRO029", fecha: "2026-08-31", idaYVuelta: false }),
    ]);
    expect(tanqueos).toHaveLength(2);
    const filas = filasAnticipos(tanqueos);
    expect(filas.map((f) => [f.placa, f.tramo, f.efectivo + f.combustible])).toEqual([
      ["SRO029", "IDA", 2_200_000],
      ["SWO594", "IDA", 2_200_000],
      ["SWO594", "VUELTA", 1_800_000],
    ]);
    const columnas = columnasAnticipos(filas);
    const valor = (titulo: string) => columnas.find((c) => c.titulo === titulo)!.valores;
    expect(valor("VALOR TOTAL")).toEqual([2_200_000, 2_200_000, 1_800_000]);
    expect(valor("EMPRESA PROV")).toEqual(["CORONA", "CORONA", "MADEIROS"]);
    expect(valor("PLACA")).toEqual(["SRO-029", "SWO-594", "SWO-594"]);
    expect(valor("N° FACTURA")).toEqual(["AE5043413", "AE5043413", "AE5043413"]);
  });

  test("una vuelta sin viaje todavia sale como vuelta pendiente", () => {
    const filas = filasAnticipos(agruparPorTanqueo([tramo({ id: 1 }), tramo({ id: 2, tramo: "VUELTA", empresa: null, cuadroViajeId: null })]));
    expect(columnasAnticipos(filas).find((c) => c.titulo === "EMPRESA PROV")!.valores).toEqual(["CORONA", "VUELTA PENDIENTE"]);
  });
});
