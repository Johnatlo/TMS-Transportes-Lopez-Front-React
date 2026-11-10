import { describe, expect, it } from "vitest";
import { ejesDe, esquemaCamion, estadoParte, nombreCorto, tipoDe } from "./esquemaCamion";

describe("esquema del camion", () => {
  it("una tractomula 3S3 tiene 6 ejes y 22 llantas", () => {
    const e = esquemaCamion("3S3");
    expect([e.ejes, e.llantas, e.articulado]).toEqual([6, 22, true]);
    expect(e.partes.filter((p) => p.grupo === "llantas")).toHaveLength(22);
    expect(e.partes.some((p) => p.id === "quinta-rueda")).toBe(true);
    expect(e.partes.find((p) => p.id === "llanta-1")?.nombre).toBe("Llanta 1 (eje delantero, izquierda)");
  });

  it("dobletroque, sencillo y 2S2", () => {
    expect(esquemaCamion("3").llantas).toBe(10);
    expect(esquemaCamion("2").llantas).toBe(6);
    expect(esquemaCamion("2S2").llantas).toBe(14);
    expect(esquemaCamion("3").partes.some((p) => p.id === "quinta-rueda")).toBe(false);
    expect(ejesDe(null)).toEqual({ tracto: 3, remolque: 3 });
    expect([tipoDe("3S3"), tipoDe("3"), tipoDe("2")]).toEqual(["Tractomula de tres troques", "Dobletroque", "Camion sencillo"]);
  });

  it("nombres cortos para la lista de partes", () => {
    const e = esquemaCamion("3S3");
    const corto = (id: string) => nombreCorto(e.partes.find((p) => p.id === id)!);
    expect([corto("llanta-17"), corto("eje-4"), corto("tanque-der"), corto("cabina"), corto("plataforma")]).toEqual([
      "Llanta 17",
      "Eje 4",
      "Tanque der.",
      "Cabina y dormitorio",
      "Plataforma del remolque",
    ]);
  });

  it("cada parte toma el estado del ultimo preoperacional", () => {
    const e = esquemaCamion("3S3");
    const llanta = e.partes.find((p) => p.id === "llanta-5")!;
    const radiador = e.partes.find((p) => p.id === "radiador")!;
    expect(estadoParte(llanta, { llantas: "Cumple", presionLlantas: "Cumple" })).toBe("ok");
    expect(estadoParte(llanta, { llantas: "No cumple" })).toBe("novedad");
    expect(estadoParte(llanta, { llantas: "Cumple", llantasNovedad: "Desgaste" })).toBe("novedad");
    expect(estadoParte(radiador, { llantas: "Cumple" })).toBe("sinDato");
    expect(estadoParte(llanta, null)).toBe("sinDato");
  });
});
