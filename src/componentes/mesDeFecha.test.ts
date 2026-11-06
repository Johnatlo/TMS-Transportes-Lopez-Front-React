import { describe, expect, it } from "vitest";
import { mesDeFecha } from "./mesDeFecha";

describe("mesDeFecha", () => {
  it("fecha sola y fecha con hora en hora de Colombia", () => {
    expect(mesDeFecha("2026-11-05")).toBe("2026-11");
    // 1 de noviembre a las 03:00 UTC es todavia 31 de octubre en Colombia.
    expect(mesDeFecha("2026-11-01T03:00:00.000Z")).toBe("2026-10");
    expect(mesDeFecha("2026-11-01T15:00:00.000Z")).toBe("2026-11");
  });

  it("lo que no es fecha queda vacio", () => {
    expect(mesDeFecha(null)).toBe("");
    expect(mesDeFecha("SPS199")).toBe("");
  });
});
