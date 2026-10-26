import { describe, expect, it } from "vitest";
import { contieneBusqueda } from "./TablaDatos";

describe("contieneBusqueda", () => {
  it("encuentra la placa por una parte, con o sin guion", () => {
    expect(contieneBusqueda("SPS199", "199")).toBe(true);
    expect(contieneBusqueda("SPS199", "sps-199")).toBe(true);
    expect(contieneBusqueda("SPS-199", "sps199")).toBe(true);
    expect(contieneBusqueda("SPS199", "198")).toBe(false);
  });

  it("no le importan tildes ni mayusculas", () => {
    expect(contieneBusqueda("GESTIÓN AMBIENTAL", "gestion")).toBe(true);
  });
});
