import { describe, expect, it } from "vitest";
import { esquemaCamion } from "./esquemaCamion";
import { parteDeZona, vistasDe, zonasEnEspejo } from "./vistasMantenimiento";

describe("vistas de mantenimiento por marca", () => {
  it("ubica las llantas por grupo de ejes, eje y lado segun la configuracion", () => {
    expect(parteDeZona({ grupo: "del", n: 1, lado: "izq" }, "3S3")).toBe("llanta-1");
    expect(parteDeZona({ grupo: "traccion", n: 1, lado: "izq" }, "3S3")).toBe("llanta-3");
    expect(parteDeZona({ grupo: "traccion", n: 1, lado: "der" }, "3S3")).toBe("llanta-6");
    expect(parteDeZona({ grupo: "traccion", n: 2, lado: "izq" }, "3S3")).toBe("llanta-7");
    expect(parteDeZona({ grupo: "remolque", n: 1, lado: "izq" }, "3S3")).toBe("llanta-11");
    expect(parteDeZona({ grupo: "remolque", n: 3, lado: "der" }, "3S3")).toBe("llanta-22");
    expect(parteDeZona({ grupo: "traccion", n: 2, lado: "izq" }, "2S2")).toBeNull();
    expect(parteDeZona({ grupo: "remolque", n: 1, lado: "izq" }, "3")).toBeNull();
    expect(parteDeZona("radiador", "3")).toBe("radiador");
  });

  it("el costado en espejo voltea las zonas y cambia el lado de las partes", () => {
    const [z] = zonasEnEspejo([{ parte: "tanque", x: 10, y: 5, w: 20, h: 10 }]);
    expect([z.parte, z.x]).toEqual(["tanque-der", 70]);
    expect(zonasEnEspejo([{ parte: { grupo: "del", n: 1, lado: "izq" }, x: 0, y: 0, w: 10, h: 10 }])[0].parte).toEqual({ grupo: "del", n: 1, lado: "der" });
    expect(zonasEnEspejo([{ parte: "espejo-izq", x: 0, y: 0, w: 10, h: 10 }])[0].parte).toBe("espejo-der");
  });

  it("cada marca tiene izquierda, frente y derecha; la mula generica arma el costado que falta en espejo", () => {
    for (const marca of ["KENWORTH", "INTERNATIONAL", "SHACMAN", "VOLVO"])
      expect(vistasDe(marca).map((v) => [v.id, v.espejo])).toEqual([
        ["izquierda", false],
        ["frente", false],
        ["derecha", false],
      ]);
    expect(vistasDe("SHACMAN").map((v) => v.espejo)).toEqual([false, false, false]);
    expect(vistasDe("SHACMAN")[2].zonas.some((zn) => zn.parte === "espejo-der")).toBe(true);
    expect(vistasDe("FREIGHTLINER")[2].zonas.some((zn) => zn.parte === "espejo-der")).toBe(true);
    expect(vistasDe("FREIGHTLINER").map((v) => [v.id, v.espejo, v.papel])).toEqual([
      ["izquierda", false, true],
      ["frente", false, true],
      ["derecha", true, true],
    ]);
  });

  it("toda zona apunta a una parte que existe y queda dentro de la imagen", () => {
    const partes = new Set(esquemaCamion("3S3").partes.map((p) => p.id));
    for (const marca of ["KENWORTH", "INTERNATIONAL", "SHACMAN", "VOLVO", "OTRA"]) {
      for (const v of vistasDe(marca)) {
        for (const z of v.zonas) {
          expect(partes.has(parteDeZona(z.parte, "3S3") ?? "")).toBe(true);
          expect(z.x >= -0.01 && z.y >= 0 && z.x + z.w <= 100.01 && z.y + z.h <= 100.01 && z.w > 0 && z.h > 0).toBe(true);
        }
      }
    }
  });
});
