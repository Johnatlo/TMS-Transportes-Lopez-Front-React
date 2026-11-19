import { describe, expect, test } from "vitest";
import type { PartidaUtilidad } from "../../api/cliente";
import { porCategoria } from "./pasos";

const p = (gastoId: number, categoria: string, monto: number) => ({ gastoId, categoria, monto, descripcion: `g${gastoId}` }) as PartidaUtilidad;

describe("desglose de los gastos de un vehiculo por categoria", () => {
  test("agrupa, ordena las categorias como el libro y suma cada una", () => {
    const grupos = porCategoria([p(1, "SEGUROS", 100), p(2, "VEHICULO", 50.1), p(3, "VEHICULO", 200), p(4, "RARA", 5)], ["VEHICULO", "SEGUROS"]);
    expect(grupos.map((g) => [g.categoria, g.partidas.map((x) => x.gastoId), g.total])).toEqual([
      ["VEHICULO", [3, 2], 250.1],
      ["SEGUROS", [1], 100],
      ["RARA", [4], 5],
    ]);
  });
});
