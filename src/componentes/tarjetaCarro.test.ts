import { describe, expect, test, vi } from "vitest";

// Leaflet necesita el navegador; la tarjeta del carro es solo texto.
vi.mock("leaflet", () => ({ default: {} }));
vi.mock("leaflet/dist/leaflet.css", () => ({}));

import { tarjetaCarro } from "./MapaSeguimiento";

describe("tarjeta del carro en el mapa", () => {
  const punto = {
    id: 1,
    etiqueta: "SKM769",
    detalle: "Bogota → Cali · llega 16:20",
    origen: [4.6, -74.1] as [number, number],
    destino: [3.4, -76.5] as [number, number],
    avance: 0.625,
  };

  test("lleva placa, ruta, cliente, conductor y el avance", () => {
    const html = tarjetaCarro({ ...punto, ruta: "Bogota → Cali", cliente: "CARTONES AMERICA", conductor: "Pedro Gomez", llegada: "16:20" });
    expect(html).toContain("<strong>SKM769</strong>");
    expect(html).toContain("CARTONES AMERICA");
    expect(html).toContain("Conductor: Pedro Gomez");
    expect(html).toContain('style="width:63%"');
    expect(html).toContain("63 % del recorrido · llega 16:20");
  });

  test("sin los datos nuevos muestra el detalle, y escapa el texto", () => {
    expect(tarjetaCarro(punto)).toContain("Bogota → Cali · llega 16:20");
    const html = tarjetaCarro({ ...punto, etiqueta: "<b>X</b>", ruta: "A → B", cliente: 'O"Brien & Cia' });
    expect(html).toContain("&lt;b&gt;X&lt;/b&gt;");
    expect(html).toContain("O&quot;Brien &amp; Cia");
  });
});
