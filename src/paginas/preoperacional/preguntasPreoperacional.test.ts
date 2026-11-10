import { describe, expect, it } from "vitest";
import { ciudadDeOrigen, faltantes, PREGUNTAS, respuestasDeEnlace, respuestasIniciales } from "./preguntasPreoperacional";

const ENLACE =
  "https://docs.google.com/forms/d/e/x/viewform?usp=pp_url&entry.2100619182=JTY-219&entry.955491889=MAURICIO+LOPEZ+CUENCA+&entry.1093538174=S%C3%AD" +
  "&entry.1478229700=MAS+DE+7+HORAS&entry.1268337379=TRACTOMULA+TRES+TROQUES&entry.326503096=ESTACAS&entry.647209154=Si&entry.1050497175=2026-12-31" +
  "&entry.2006203297=S%C3%AD&entry.67723341=NO&entry.1824277354=Cumple&entry.1056983702=NO&entry.1762655798=NO&entry.1396717297=Si";

describe("preguntas del preoperacional", () => {
  it("todas en Si / Cumple por defecto", () => {
    const r = respuestasIniciales({});
    expect([r.saludOptima, r.epp, r.gps, r.cabina, r.luces, r.espejos, r.aprobo, r.descanso]).toEqual(["Sí", "Sí", "Sí", "Sí", "Cumple", "Cumple", "Sí", "MAS DE 7 HORAS"]);
    expect(r.cabinaNovedad).toBe("");
    // Sin placa, conductor, fechas ni ciudad faltan esas.
    expect(faltantes(r).map((p) => p.clave)).toContain("placa");
  });

  it("lee un enlace precargado de la matriz", () => {
    const r = respuestasDeEnlace(ENLACE);
    expect(r.placa).toBe("JTY-219");
    expect(r.conductor).toBe("MAURICIO LOPEZ CUENCA");
    // "Si" del formulario pasa a "Sí"; una novedad "NO" queda vacia.
    expect([r.saludOptima, r.extintor, r.aprobo, r.cabinaNovedad, r.parachoquesNovedad]).toEqual(["Sí", "Sí", "Sí", "", ""]);
    expect(r.vencExtintor).toBe("2026-12-31");
  });

  it("las sugeridas del servidor pisan las de por defecto, y la ciudad sale del origen del viaje", () => {
    const r = respuestasIniciales({ gps: "No", placa: "SZX826", ciudadOrigenViaje: "SOACHA CUNDINAMARCA" });
    expect([r.gps, r.placa, r.ciudadOrigen]).toEqual(["No", "SZX826", "SOACHA"]);
    expect(ciudadDeOrigen("BOGOTA, D.C.")).toBe("BOGOTA");
    // Sin nombre de municipio, por el codigo DANE que reporta el RNDC.
    expect(respuestasIniciales({ ciudadOrigenCodigo: "76001000" }).ciudadOrigen).toBe("CALI");
  });

  it("38 preguntas como el formulario", () => {
    expect(PREGUNTAS).toHaveLength(38);
  });
});
