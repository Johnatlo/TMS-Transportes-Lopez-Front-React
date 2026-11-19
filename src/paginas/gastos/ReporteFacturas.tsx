/**
 * Vista "Facturas credito" del libro de gastos: el reporte que pide la
 * contadora cada mes o quincena, con las facturas marcadas como credito.
 * Se ve en pantalla y se descarga en Excel.
 */
import { useState } from "react";
import { hoyColombia, moneda } from "../../api/cliente";
import type { EmpresaGasto, Gasto } from "../../api/cliente";
import { descargarReporte } from "../../componentes/excelReporte";
import TablaDatos from "../../componentes/TablaDatos";
import type { Columna } from "../../componentes/TablaDatos";
import { fechaCorta } from "../cuadro/estadosCuadro";
import { facturasCredito, rangoDe } from "./facturasCredito";
import { NOMBRE_CATEGORIA, NOMBRE_EMPRESA, nombreMes } from "./nombres";

/** Reporte de facturas credito de un mes o una quincena. */
export default function ReporteFacturas({ gastos, soloMyc }: { gastos: Gasto[]; soloMyc: boolean }) {
  const [mes, setMes] = useState(hoyColombia().slice(0, 7));
  const [parte, setParte] = useState<"" | "-Q1" | "-Q2">("");
  const [empresa, setEmpresa] = useState<EmpresaGasto | "TODAS">(soloMyc ? "MYC" : "TODAS");
  const periodo = mes + parte;
  const { desde, hasta } = rangoDe(periodo);
  const filas = facturasCredito(gastos, periodo, empresa);
  const total = filas.reduce((s, g) => s + g.monto, 0);
  const nombrePeriodo = `${parte === "-Q1" ? "1a quincena de " : parte === "-Q2" ? "2a quincena de " : ""}${nombreMes(mes)}`;

  function descargar() {
    void descargarReporte(
      {
        titulo: `Facturas credito${empresa === "TODAS" ? "" : ` - ${NOMBRE_EMPRESA[empresa]}`}`,
        subtitulo: `${nombrePeriodo} (${fechaCorta(desde)} a ${fechaCorta(hasta)})`,
        hojas: [
          {
            nombre: "Facturas credito",
            columnas: [
              { titulo: "Fecha", formato: "fecha" },
              { titulo: "Empresa", ancho: 12 },
              { titulo: "Proveedor", ancho: 26 },
              { titulo: "N° factura", ancho: 14 },
              { titulo: "Descripcion", ancho: 40 },
              { titulo: "Categoria", ancho: 16 },
              { titulo: "Valor", formato: "pesos" },
              { titulo: "Pagada el", formato: "fecha" },
            ],
            filas: filas.map((g) => [
              g.causaDesde,
              NOMBRE_EMPRESA[g.empresa],
              g.proveedor ?? "",
              g.numeroFactura ?? "",
              g.descripcion,
              NOMBRE_CATEGORIA[g.categoria] ?? g.categoria,
              g.monto,
              g.fechaPago ?? "Por pagar",
            ]),
            totales: ["Total", "", "", "", `${filas.length} factura(s)`, "", total, ""],
          },
        ],
      },
      `facturas-credito-${periodo}`,
    );
  }

  const columnas: Columna<Gasto>[] = [
    { id: "fecha", titulo: "Fecha", valor: (g) => g.causaDesde, celda: (g) => fechaCorta(g.causaDesde) },
    { id: "empresa", titulo: "Empresa", valor: (g) => NOMBRE_EMPRESA[g.empresa], celda: (g) => NOMBRE_EMPRESA[g.empresa] },
    { id: "proveedor", titulo: "Proveedor", valor: (g) => g.proveedor ?? "", celda: (g) => g.proveedor ?? "-" },
    { id: "factura", titulo: "N° factura", valor: (g) => g.numeroFactura ?? "", celda: (g) => g.numeroFactura ?? "-" },
    { id: "descripcion", titulo: "Descripcion", valor: (g) => g.descripcion, celda: (g) => <span className="principal">{g.descripcion}</span> },
    { id: "valor", titulo: "Valor", alinear: "derecha", valor: (g) => g.monto, celda: (g) => <strong>{moneda(g.monto)}</strong> },
    {
      id: "pago",
      titulo: "Pago",
      valor: (g) => g.fechaPago ?? "",
      celda: (g) => (g.fechaPago ? fechaCorta(g.fechaPago) : <span className="texto-vencido">Por pagar</span>),
    },
  ];

  return (
    <div className="panel">
      <p className="dato-sec" style={{ margin: 0, padding: "0.75rem 1rem 0" }}>
        {filas.length} factura(s) credito de {nombrePeriodo}: <strong>{moneda(total)}</strong>. Salen los gastos con tipo de factura "Credito", por la fecha del
        gasto.
      </p>
      <TablaDatos
        filas={filas}
        columnas={columnas}
        clave={(g) => g.id}
        nombreArchivo={`facturas-credito-${periodo}`}
        placeholderBusqueda="Buscar proveedor, factura..."
        vacio="No hay facturas credito en ese periodo."
        acciones={
          <div className="filtros-facturas">
            <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mes" />
            <select value={parte} onChange={(e) => setParte(e.target.value as "" | "-Q1" | "-Q2")} aria-label="Periodo">
              <option value="">Todo el mes</option>
              <option value="-Q1">1a quincena (1 al 15)</option>
              <option value="-Q2">2a quincena (16 a fin de mes)</option>
            </select>
            <select value={empresa} disabled={soloMyc} onChange={(e) => setEmpresa(e.target.value as EmpresaGasto | "TODAS")} aria-label="Empresa">
              <option value="TODAS">Las dos empresas</option>
              <option value="LOPEZ">Transportes Lopez</option>
              <option value="MYC">Transportes M&C</option>
            </select>
            <button className="btn-primary boton-con-texto" onClick={descargar} disabled={!filas.length}>
              Excel para la contadora
            </button>
          </div>
        }
      />
    </div>
  );
}
