/**
 * Carga inicial de la cartera desde el Excel "Cartera Total" (una sola vez).
 *
 * 1. Se elige el archivo; el navegador lee las facturas pendientes.
 * 2. El servidor propone como cargar cada una: las de antes de septiembre
 *    como saldo sin viaje; las de septiembre en adelante ligadas a sus viajes
 *    del cuadro pagos (el viaje de cada placa).
 * 3. Se revisan las dudosas (cliente distinto, varios viajes posibles, placa
 *    sin viajes) y se confirma. Reimportar no duplica.
 */
import { useMemo, useState } from "react";
import { apiSeguimiento, moneda } from "../../api/cliente";
import type { CandidatoViaje, FacturaConfirmada, FacturaPropuesta } from "../../api/cliente";
import Modal from "../../componentes/Modal";
import { Pastilla } from "../../componentes/TablaDatos";
import { fechaCorta } from "../cuadro/estadosCuadro";
import { carteraDesdeFilas, leerHojas } from "./cargaExcel";

/** Factura en revision: la propuesta con lo que se eligio (modo y viajes de cada linea). */
interface FacturaRevision extends FacturaPropuesta {
  elegidos: number[][];
}

type Vista = "revisar" | "viajes" | "saldos" | "todas";

/** Texto de un viaje del cuadro para la lista. */
const etiquetaViaje = (c: CandidatoViaje) =>
  [
    fechaCorta(c.fecha),
    c.empresa,
    c.manifiesto ? `man. ${c.manifiesto}` : "sin manifiesto",
    c.valorFlete !== null ? moneda(c.valorFlete) : null,
    c.facturaNumero ? `ya en factura ${c.facturaNumero}` : null,
    c.mismoCliente ? null : "(otro cliente)",
  ]
    .filter(Boolean)
    .join(" · ");

/** Ventana de la carga de cartera: leer el Excel, revisar cada factura y cargar. */
export default function ImportarCartera({ alCerrar, alCambiar }: { alCerrar: () => void; alCambiar: () => void }) {
  const [facturas, setFacturas] = useState<FacturaRevision[] | null>(null);
  const [vista, setVista] = useState<Vista>("revisar");
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function leer(archivo: File | undefined) {
    if (!archivo) return;
    setError(null);
    setAviso(null);
    setTrabajando(true);
    try {
      const hojas = await leerHojas(archivo);
      const hoja = hojas.find((h) => /cartera total/i.test(h.nombre)) ?? hojas[0];
      const leidas = carteraDesdeFilas(hoja.filas);
      if (leidas.length === 0) throw new Error("La hoja no trae facturas.");
      const propuesta = await apiSeguimiento.previaCartera(leidas);
      setFacturas(propuesta.map((f) => ({ ...f, elegidos: f.lineas.map((l) => l.propuestos) })));
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo leer el archivo.");
    } finally {
      setTrabajando(false);
    }
  }

  /** Viajes elegidos en mas de una linea (no se puede cargar asi). */
  const repetidos = useMemo(() => {
    const vistos = new Map<number, number>();
    for (const f of facturas ?? []) {
      if (f.modo !== "VIAJES") continue;
      for (const ids of f.elegidos) for (const id of ids) vistos.set(id, (vistos.get(id) ?? 0) + 1);
    }
    return new Set([...vistos].filter(([, n]) => n > 1).map(([id]) => id));
  }, [facturas]);

  /** true si la factura necesita que alguien la mire. */
  const porRevisar = (f: FacturaRevision) =>
    (f.modo === "SALDO" && f.fecha >= "2026-09-01") ||
    (f.modo === "VIAJES" && f.lineas.some((l, i) => !l.seguro || f.elegidos[i].length === 0 || f.elegidos[i].some((id) => repetidos.has(id))));

  const faltan = (facturas ?? []).filter((f) => f.modo === "VIAJES" && f.elegidos.some((ids) => ids.length === 0)).length;
  const visibles = (facturas ?? []).filter((f) =>
    vista === "revisar" ? porRevisar(f) : vista === "viajes" ? f.modo === "VIAJES" : vista === "saldos" ? f.modo === "SALDO" : true
  );

  function cambiar(numero: string, cambio: (f: FacturaRevision) => FacturaRevision) {
    setFacturas((fs) => (fs ?? []).map((f) => (f.numero === numero ? cambio(f) : f)));
  }

  async function cargar() {
    if (!facturas) return;
    if (!window.confirm(`¿Cargar las ${facturas.length} facturas a la cartera?`)) return;
    setError(null);
    setTrabajando(true);
    try {
      const confirmadas: FacturaConfirmada[] = facturas.map((f) => ({
        numero: f.numero,
        empresa: f.empresa,
        fecha: f.fecha,
        vence: f.vence,
        valor: f.valor,
        placas: f.placas,
        anticipo: f.anticipo,
        modo: f.modo,
        lineas: f.lineas.map((l, i) => ({ placa: l.placa, valor: l.valor, viajeIds: f.elegidos[i] })),
      }));
      const r = await apiSeguimiento.importarCartera(confirmadas);
      setAviso(
        `Listo: ${r.saldos} saldo(s) sin viaje y ${r.facturas} factura(s) ligadas a ${r.viajes} viaje(s) del cuadro pagos.`
      );
      setFacturas(null);
      alCambiar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo cargar la cartera.");
    } finally {
      setTrabajando(false);
    }
  }

  const contar = (v: Vista) =>
    (facturas ?? []).filter((f) =>
      v === "revisar" ? porRevisar(f) : v === "viajes" ? f.modo === "VIAJES" : v === "saldos" ? f.modo === "SALDO" : true
    ).length;

  return (
    <Modal
      titulo="Importar cartera desde Excel"
      ancho="pantalla"
      alCerrar={alCerrar}
      pie={
        <>
          {facturas && (
            <span className="dato-sec" style={{ marginRight: "auto" }}>
              {facturas.length} facturas · {moneda(facturas.reduce((s, f) => s + f.valor, 0))}
              {faltan > 0 && ` · ${faltan} sin viaje elegido`}
              {repetidos.size > 0 && ` · ${repetidos.size} viaje(s) elegidos dos veces`}
            </span>
          )}
          <button className="btn-secondary" onClick={alCerrar}>
            Cerrar
          </button>
          {facturas && (
            <button className="btn-primary" onClick={cargar} disabled={trabajando || faltan > 0 || repetidos.size > 0}>
              {trabajando ? "Cargando..." : "Cargar a la cartera"}
            </button>
          )}
        </>
      }
    >
      <div className="section-desc" style={{ marginBottom: "0.6rem" }}>
        Sube el Excel con la hoja matriz. Las facturas de antes de septiembre entran como saldo sin viaje (con su
        valor por placa). Las de septiembre en adelante se ligan a sus viajes del cuadro pagos y el sistema propone el viaje
        de cada placa y tu corriges los que dicen "Revisar". El anticipo del cliente (placas menos valor factura) se resta.
      </div>
      {error && <div className="alert danger">{error}</div>}
      {aviso && <div className="alert success">{aviso}</div>}
      {!facturas && (
        <label className="btn-primary boton-con-texto" style={{ cursor: "pointer", alignSelf: "flex-start" }}>
          {trabajando ? "Leyendo..." : "Elegir el Excel de cartera"}
          <input
            type="file"
            accept=".xlsx"
            style={{ display: "none" }}
            disabled={trabajando}
            onChange={(e) => {
              leer(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      )}
      {facturas && (
        <>
          <div className="tabla-pestanas" style={{ marginBottom: "0.5rem" }}>
            {(
              [
                ["revisar", "Por revisar"],
                ["viajes", "Ligadas a viajes"],
                ["saldos", "Saldos sin viaje"],
                ["todas", "Todas"],
              ] as Array<[Vista, string]>
            ).map(([v, etiqueta]) => (
              <button key={v} className={vista === v ? "activa" : ""} onClick={() => setVista(v)}>
                {etiqueta} <span className="contador">{contar(v)}</span>
              </button>
            ))}
          </div>
          <div className="tabla-envio">
            <table className="tabla tabla-compacta" style={{ width: 1180 }}>
              <colgroup>
                <col style={{ width: 230 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 130 }} />
                <col style={{ width: 600 }} />
                <col style={{ width: 110 }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Factura</th>
                  <th>Placa</th>
                  <th>Valor placa</th>
                  <th>Viaje del cuadro pagos</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((f) => (
                  <FilasFactura key={f.numero} f={f} repetidos={repetidos} alCambiar={(c) => cambiar(f.numero, c)} />
                ))}
                {visibles.length === 0 && (
                  <tr>
                    <td colSpan={5} className="dato-sec">
                      {vista === "revisar" ? "No queda nada por revisar." : "No hay facturas en esta vista."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}

/** Las filas de una factura: su cabecera (modo) y una linea por placa. */
function FilasFactura({
  f,
  repetidos,
  alCambiar,
}: {
  f: FacturaRevision;
  repetidos: Set<number>;
  alCambiar: (cambio: (f: FacturaRevision) => FacturaRevision) => void;
}) {
  const elegir = (linea: number, posicion: number, id: number | null) =>
    alCambiar((x) => {
      const elegidos = x.elegidos.map((ids) => [...ids]);
      if (id === null) elegidos[linea].splice(posicion, 1);
      else elegidos[linea][posicion] = id;
      return { ...x, elegidos };
    });
  return (
    <>
      <tr className="fila-grupo">
        <td colSpan={5}>
          <div className="cabecera-factura">
            <span>
              <strong>Factura {f.numero}</strong> · {f.empresa} · {fechaCorta(f.fecha)} · debe <strong>{moneda(f.valor)}</strong>
              {f.anticipo > 0 && <> · anticipo del cliente {moneda(f.anticipo)}</>}
            </span>
            <select value={f.modo} onChange={(e) => alCambiar((x) => ({ ...x, modo: e.target.value as "SALDO" | "VIAJES" }))}>
              <option value="VIAJES">Ligar a sus viajes</option>
              <option value="SALDO">Saldo sin viaje</option>
            </select>
          </div>
          {f.motivo && <span className="dato-sec">{f.motivo}</span>}
        </td>
      </tr>
      {f.lineas.map((l, i) => {
        const ids = f.elegidos[i];
        const sinViaje = f.modo === "VIAJES" && ids.length === 0;
        const dobles = f.modo === "VIAJES" && ids.some((id) => repetidos.has(id));
        return (
          <tr key={`${f.numero}-${l.placa}`}>
            <td />
            <td className="codigo">{l.placa}</td>
            <td>{moneda(l.valor)}</td>
            <td>
              {f.modo === "SALDO" ? (
                <span className="dato-sec">Va como saldo sin viaje</span>
              ) : l.candidatos.length === 0 ? (
                <span className="texto-vencido">Esta placa no tiene viajes en el cuadro: carga la factura como saldo.</span>
              ) : (
                <>
                  {[...ids, ...(ids.length === 0 ? [null] : [])].map((id, p) => (
                    <div key={p} className="eleccion-viaje">
                      <select value={id ?? ""} onChange={(e) => elegir(i, p, e.target.value ? Number(e.target.value) : null)}>
                        <option value="">Elige el viaje...</option>
                        {l.candidatos.map((c) => (
                          <option key={c.id} value={c.id}>
                            {etiquetaViaje(c)}
                          </option>
                        ))}
                      </select>
                      {p > 0 && (
                        <button className="btn-link" onClick={() => elegir(i, p, null)}>
                          Quitar
                        </button>
                      )}
                    </div>
                  ))}
                  {ids.length > 0 && ids.length < l.candidatos.length && (
                    <button className="btn-link" onClick={() => elegir(i, ids.length, l.candidatos.find((c) => !ids.includes(c.id))!.id)}>
                      + Otro viaje de esta placa en la misma factura
                    </button>
                  )}
                </>
              )}
            </td>
            <td>
              {f.modo === "SALDO" ? (
                <Pastilla tono="neutro">Saldo</Pastilla>
              ) : sinViaje || l.candidatos.length === 0 ? (
                <Pastilla tono="error">Falta viaje</Pastilla>
              ) : dobles ? (
                <Pastilla tono="error">Viaje repetido</Pastilla>
              ) : l.seguro ? (
                <Pastilla tono="ok">Seguro</Pastilla>
              ) : (
                <Pastilla tono="aviso">Revisar</Pastilla>
              )}
            </td>
          </tr>
        );
      })}
    </>
  );
}
