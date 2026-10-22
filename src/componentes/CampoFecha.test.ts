import { describe, expect, test } from "vitest";
import { fechaCompleta } from "./CampoFecha";

describe("fechaCompleta", () => {
  test("los años a medias al escribir no se guardan", () => {
    expect(fechaCompleta("0002-10-08")).toBe(false);
    expect(fechaCompleta("0202-10-08")).toBe(false);
    expect(fechaCompleta("2026-10-08")).toBe(true);
  });
  test("vacio quita la fecha; texto raro no", () => {
    expect(fechaCompleta("")).toBe(true);
    expect(fechaCompleta("2026-10")).toBe(false);
  });
});
