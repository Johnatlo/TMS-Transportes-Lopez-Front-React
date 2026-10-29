/**
 * Envio a facturacion: arma el cuadro que se le manda a la contadora (factura
 * en World Office) con los viajes listos para facturar. Cada fila trae la
 * tarifa sugerida de la matriz de fletes y todo se puede ajustar antes de
 * descargar el Excel. Tambien: importar y editar la matriz de fletes.
 */
import { useEffect, useMemo, useState } from "react";
import { apiCuadro, moneda } from "../../api/cliente";
import type { TarifaFlete } from "../../api/cliente";
import { useDatos } from "../../ganchos/useDatos";
import { Cargando, ErrorCarga } from "../../componentes/Estado";
import ComboBuscable from "../../componentes/ComboBuscable";
import Modal from "../../componentes/Modal";
import { fechaCorta, hoyColombia } from "./estadosCuadro";
import {
  agruparPorCliente,
  aplicarTarifa,
  claveCliente,
  convertirMatriz,
  deInput,
  enInput,
  filaInicial,
  notaDe,
  tarifasDelCliente,
  totalDe,
  unificarFacturas,
} from "./facturacion";
import type { FilaEnvio } from "./facturacion";
import { descargarCuadroEnvio, leerMatrizFletes } from "./excelFacturacion";

/**
 * Ventana del envio a facturacion. Al "Guardar y descargar Excel" guarda en
 * cada viaje marcado lo que se envia (tarifa, peso, valor, remision, nota,
 * factura) y descarga el cuadro con un bloque por cliente (razon social), con
 * un mismo numero de factura para todos sus viajes.
 */
export default function EnvioFacturacion({ alCerrar, alCambiar }: { alCerrar: () => void; alCambiar: () => void }) {
  const datos = useDatos(() => Promise.all([apiCuadro.porFacturar(), apiCuadro.tarifas()]), []);
  const [filas, setFilas] = useState<FilaEnvio[] | null>(null);
  const [empresa, setEmpresa] = useState("");
  const [verEnviados, setVerEnviados] = useState(false);
  const [verMatriz, setVerMatriz] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const tarifas = datos.datos?.[1] ?? [];
  useEffect(() => {
    if (!datos.datos) return;
    const [{ filas: porFacturar }, lista] = datos.datos;
    setFilas(porFacturar.map((f) => filaInicial(f, lista)));
  }, [datos.datos]);

  const empresas = useMemo(() => [...new Set((filas ?? []).map((e) => e.fila.empresa))].sort(), [filas]);
  const visibles = (filas ?? []).filter(
    (e) => (!empresa || e.fila.empresa === empresa) && (verEnviados || !e.fila.enviadoFacturarEn || e.incluir)
  );
  const marcadas = (filas ?? []).filter((e) => e.incluir);
  const totalMarcado = marcadas.reduce((s, e) => s + (totalDe(e) ?? 0), 0);

  /** Viajes marcados por cliente (razon social), para avisar cuales van en la misma factura. */
  const marcadasPorCliente = useMemo(() => {
    const cuenta = new Map<string, number>();
    for (const e of marcadas) cuenta.set(claveCliente(e.razonSocial), (cuenta.get(claveCliente(e.razonSocial)) ?? 0) + 1);
    return cuenta;
  }, [marcadas]);

  /**
   * Cambia una fila; si cambia algo de la nota y no se edito a mano, la
   * rearma. El numero de factura se copia a los demas viajes marcados del
   * mismo cliente: van en una sola factura.
   */
  function cambiar(id: number, cambios: Partial<FilaEnvio>) {
    setFilas((fs) => {
      const lista = fs ?? [];
      const origen = lista.find((e) => e.fila.id === id);
      const cliente = origen ? claveCliente(cambios.razonSocial ?? origen.razonSocial) : "";
      return lista.map((e) => {
        if (e.fila.id !== id) {
          const mismoCliente = "facturaNumero" in cambios && e.incluir && !!cliente && claveCliente(e.razonSocial) === cliente;
          return mismoCliente ? { ...e, facturaNumero: cambios.facturaNumero ?? "" } : e;
        }
        const nueva = { ...e, ...cambios };
        return nueva.notaEditada || "notaFactura" in cambios ? nueva : { ...nueva, notaFactura: notaDe(nueva) };
      });
    });
  }

  async function guardarYDescargar() {
    if (marcadas.length === 0) return;
    setError(null);
    setAviso(null);
    // Una factura por cliente: mismo numero para todos sus viajes.
    const { filas: envio, conflictos } = unificarFacturas(marcadas);
    if (conflictos.length) {
      setError(`Un mismo cliente va en una sola factura; corrige el numero de factura de: ${conflictos.join("; ")}.`);
      return;
    }
    setEnviando(true);
    try {
      await apiCuadro.enviarFacturacion(
        envio.map((e) => ({
          id: e.fila.id,
          tarifaFleteId: e.tarifaId,
          tipo: e.tipo,
          valorTon: e.valorTon,
          adicional: e.tipo === "TON" ? e.adicional : null,
          pesoFacturadoKg: e.pesoFacturadoKg,
          total: totalDe(e),
          remision: e.remision,
          notaFactura: e.notaFactura,
          facturaNumero: e.facturaNumero,
        }))
      );
      await descargarCuadroEnvio(agruparPorCliente(envio), `envio-facturacion-${hoyColombia()}.xlsx`);
      setAviso(`Se guardaron ${marcadas.length} viaje(s) y se descargo el cuadro para la contadora.`);
      alCambiar();
      datos.recargar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo generar el cuadro.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      titulo="Enviar a facturacion"
      ancho="pantalla"
      alCerrar={alCerrar}
      pie={
        <>
          <span className="dato-sec" style={{ marginRight: "auto" }}>
            {marcadas.length} viaje(s) · {moneda(totalMarcado)}
          </span>
          <button className="btn-secondary" onClick={alCerrar}>
            Cerrar
          </button>
          <button className="btn-primary" onClick={guardarYDescargar} disabled={enviando || marcadas.length === 0}>
            {enviando ? "Generando..." : "Guardar y descargar Excel"}
          </button>
        </>
      }
    >
      {datos.cargando && !filas && <Cargando que="los viajes listos para facturar" />}
      {datos.error && <ErrorCarga mensaje={datos.error} alReintentar={datos.recargar} />}
      {error && <div className="alert danger">{error}</div>}
      {aviso && <div className="alert success">{aviso}</div>}
      {filas && (
        <>
          <div className="section-desc" style={{ marginBottom: "0.6rem" }}>
            Viajes con los papeles listos para facturar. La tarifa, el peso y el valor salen de la matriz de fletes y se
            pueden cambiar. Los viajes de la misma razon social van juntos en el Excel, en un solo cuadro y con el mismo
            numero de factura (al escribirlo en uno se copia a los demas). Al descargar, lo que se envio queda guardado
            en cada viaje del cuadro pagos.
          </div>
          {tarifas.length === 0 && (
            <div className="alert warning">
              No hay matriz de fletes cargada: importala para que los valores se sugieran solos.{" "}
              <button className="btn-link" onClick={() => setVerMatriz(true)}>
                Importar matriz
              </button>
            </div>
          )}
          <div className="barra-envio">
            <select value={empresa} onChange={(e) => setEmpresa(e.target.value)}>
              <option value="">Todos los clientes</option>
              {empresas.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
            <label className="check-linea">
              <input type="checkbox" checked={verEnviados} onChange={(e) => setVerEnviados(e.target.checked)} />
              Mostrar los ya enviados sin fecha de factura
            </label>
            <button
              className="btn-link"
              onClick={() => setFilas((fs) => (fs ?? []).map((e) => (visibles.includes(e) ? { ...e, incluir: true } : e)))}
            >
              Marcar todos
            </button>
            <button
              className="btn-link"
              onClick={() => setFilas((fs) => (fs ?? []).map((e) => (visibles.includes(e) ? { ...e, incluir: false } : e)))}
            >
              Desmarcar
            </button>
            <button className="boton-barra" style={{ marginLeft: "auto" }} onClick={() => setVerMatriz(true)}>
              Matriz de fletes
            </button>
          </div>
          <div className="tabla-envio">
            <table className="tabla tabla-compacta" style={{ width: ANCHO_ENVIO }}>
              <colgroup>
                {COLUMNAS_ENVIO.map((ancho, i) => (
                  <col key={i} style={{ width: ancho }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th />
                  <th>Viaje</th>
                  <th>Razon social</th>
                  <th>Remision / transporte</th>
                  <th>Tarifa de la matriz</th>
                  <th>Peso a facturar (kg)</th>
                  <th>Valor ton</th>
                  <th>Total</th>
                  <th>Factura</th>
                  <th>Nota factura</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((e) => (
                  <FilaEditable
                    key={e.fila.id}
                    e={e}
                    tarifas={tarifas}
                    mismoCliente={e.incluir ? (marcadasPorCliente.get(claveCliente(e.razonSocial)) ?? 1) - 1 : 0}
                    alCambiar={(c) => cambiar(e.fila.id, c)}
                    alElegirTarifa={(t) => setFilas((fs) => (fs ?? []).map((x) => (x.fila.id === e.fila.id ? aplicarTarifa(x, t) : x)))}
                  />
                ))}
                {visibles.length === 0 && (
                  <tr>
                    <td colSpan={10} className="dato-sec">
                      No hay viajes listos para facturar{empresa ? " de este cliente" : ""}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
      {verMatriz && (
        <VentanaMatriz
          alCerrar={() => setVerMatriz(false)}
          alCambiar={() => {
            datos.recargar();
          }}
        />
      )}
    </Modal>
  );
}

/**
 * Ancho de cada columna del cuadro de envio (checkbox, viaje, razon social,
 * remision, tarifa, peso, valor ton, total, factura, nota). La tabla usa
 * table-layout fijo: cada campo queda dentro de su columna y nada se monta
 * sobre lo de al lado; lo que no cabe en la ventana se recorre de lado.
 */
const COLUMNAS_ENVIO = [40, 200, 180, 130, 270, 130, 160, 130, 140, 250];
const ANCHO_ENVIO = COLUMNAS_ENVIO.reduce((a, b) => a + b, 0);

/** Una fila editable del cuadro de envio. */
function FilaEditable({
  e,
  tarifas,
  mismoCliente,
  alCambiar,
  alElegirTarifa,
}: {
  e: FilaEnvio;
  tarifas: TarifaFlete[];
  /** Cuantos viajes marcados mas tiene esta razon social (van en la misma factura). */
  mismoCliente: number;
  alCambiar: (c: Partial<FilaEnvio>) => void;
  alElegirTarifa: (t: TarifaFlete | null) => void;
}) {
  const f = e.fila;
  // Las tarifas del cliente primero; despues el resto, por si se factura con otra.
  const opciones = useMemo(() => {
    const delCliente = tarifasDelCliente(f.empresa, tarifas);
    const ids = new Set(delCliente.map((t) => t.id));
    return [...delCliente, ...tarifas.filter((t) => !ids.has(t.id))];
  }, [f.empresa, tarifas]);
  const tarifa = tarifas.find((t) => t.id === e.tarifaId) ?? null;
  const total = totalDe(e);

  return (
    <tr className={e.incluir ? "" : "fila-inactiva"}>
      <td>
        <input type="checkbox" checked={e.incluir} onChange={(x) => alCambiar({ incluir: x.target.checked })} />
      </td>
      <td>
        <span className="principal">{f.placa}</span>
        <span className="dato-sec">{fechaCorta(f.fecha)} · {f.empresa}</span>
        <span className="dato-sec">{f.conductor ?? "-"}</span>
        <span className="dato-sec">
          {f.remesa ? `Remesa ${f.remesa}` : "Sin remesa"}
          {f.radicadoRemesa ? ` · rad. ${f.radicadoRemesa}` : ""}
        </span>
        {f.enviadoFacturarEn && <span className="dato-sec texto-vencido">Ya enviado el {fechaCorta(f.enviadoFacturarEn)}</span>}
      </td>
      <td>
        <input value={e.razonSocial} onChange={(x) => alCambiar({ razonSocial: x.target.value })} />
        {mismoCliente > 0 && (
          <span className="dato-sec">
            Misma factura con {mismoCliente} viaje{mismoCliente === 1 ? "" : "s"} mas
          </span>
        )}
      </td>
      <td>
        <input value={e.remision} onChange={(x) => alCambiar({ remision: x.target.value })} />
      </td>
      <td>
        <ComboBuscable
          opciones={opciones}
          valor={e.tarifaId}
          alCambiar={(id) => alElegirTarifa(tarifas.find((t) => t.id === id) ?? null)}
          obtenerId={(t) => t.id}
          obtenerEtiqueta={(t) =>
            `${t.nombre} · ${t.valor === null ? "sin valor" : t.valor.toLocaleString("es-CO")} ${t.tipo}${t.pesoMinimoKg ? ` · min ${t.pesoMinimoKg.toLocaleString("es-CO")} kg` : ""}${t.pesoFijoKg ? ` · siempre ${t.pesoFijoKg.toLocaleString("es-CO")} kg` : ""}`
          }
          placeholder={tarifas.length ? "Busca la tarifa..." : "Sin matriz"}
        />
        <select value={e.tipo} onChange={(x) => alCambiar({ tipo: x.target.value as "TON" | "FIJO" })} style={{ marginTop: 10}}>
          
          <option value="TON">Por tonelada</option>
          <option value="FIJO">Valor fijo</option>
        </select>
        {tarifa?.observaciones && <span className="dato-sec">{tarifa.observaciones}</span>}
      </td>
      <td>
        <input
          type="number"
          min={0}
          value={enInput(e.pesoFacturadoKg)}
          onChange={(x) => alCambiar({ pesoFacturadoKg: deInput(x.target.value) })}
        />
        <span className="dato-sec">Real: {f.pesoKg === null ? "-" : f.pesoKg.toLocaleString("es-CO")}</span>
      </td>
      <td>
        {e.tipo === "TON" ? (
          <>
            <input type="number" min={0} value={enInput(e.valorTon)} onChange={(x) => alCambiar({ valorTon: deInput(x.target.value) })} />
            <label className="etiqueta-celda">
              Adicional clientes
              <input
                type="number"
                min={0}
                step={300000}
                placeholder="0"
                value={enInput(e.adicional)}
                onChange={(x) => alCambiar({ adicional: deInput(x.target.value) })}
              />
            </label>
          </>
        ) : (
          <span className="dato-sec">-</span>
        )}
      </td>
      <td>
        {e.tipo === "FIJO" ? (
          <input type="number" min={0} value={enInput(e.totalFijo)} onChange={(x) => alCambiar({ totalFijo: deInput(x.target.value) })} />
        ) : (
          <>
            <strong>{total === null ? "-" : moneda(total)}</strong>
            {!!e.adicional && total !== null && <span className="dato-sec">con {moneda(e.adicional)} de adicional</span>}
          </>
        )}
      </td>
      <td>
        <input value={e.facturaNumero} placeholder="TL 1111" onChange={(x) => alCambiar({ facturaNumero: x.target.value })} />
      </td>
      <td>
        <textarea rows={2} value={e.notaFactura} onChange={(x) => alCambiar({ notaFactura: x.target.value, notaEditada: true })} />
        {e.notaEditada && (
          <button className="btn-link" onClick={() => alCambiar({ notaEditada: false, notaFactura: notaDe(e) })}>
            Volver a la nota automatica
          </button>
        )}
      </td>
    </tr>
  );
}

/** Ancho de las columnas de la matriz (tarifa, razon social, valor, tipo, pesos y observaciones). */
const COLUMNAS_MATRIZ = [270, 230, 140, 110, 130, 130, 360];
const ANCHO_MATRIZ = COLUMNAS_MATRIZ.reduce((a, b) => a + b, 0);

/**
 * Matriz de fletes: importar el Excel "MATRIZ FLETES" (reemplaza la actual) y
 * ajustar valor, tipo y peso minimo de cada tarifa.
 */
function VentanaMatriz({ alCerrar, alCambiar }: { alCerrar: () => void; alCambiar: () => void }) {
  const tarifas = useDatos(() => apiCuadro.tarifas(), []);
  const [busqueda, setBusqueda] = useState("");
  const [mensaje, setMensaje] = useState<{ tipo: "success" | "danger"; texto: string } | null>(null);
  const [importando, setImportando] = useState(false);

  async function importar(archivo: File | undefined) {
    if (!archivo) return;
    setMensaje(null);
    setImportando(true);
    try {
      const nuevas = convertirMatriz(await leerMatrizFletes(archivo));
      if (nuevas.length === 0) throw new Error("El archivo no trae tarifas.");
      const actuales = tarifas.datos?.length ?? 0;
      if (
        actuales > 0 &&
        !window.confirm(`Se reemplazan las ${actuales} tarifas actuales por las ${nuevas.length} del archivo. ¿Seguir?`)
      ) {
        return;
      }
      const r = await apiCuadro.importarTarifas(nuevas);
      setMensaje({ tipo: "success", texto: `Se importaron ${r.importadas} tarifas.` });
      tarifas.recargar();
      alCambiar();
    } catch (exc) {
      setMensaje({ tipo: "danger", texto: exc instanceof Error ? exc.message : "No se pudo importar." });
    } finally {
      setImportando(false);
    }
  }

  /** Tarifa nueva (sin importar el Excel): se llena arriba de la tabla. */
  const vacia: Omit<TarifaFlete, "id"> = { nombre: "", razonSocial: null, valor: null, tipo: "TON", pesoMinimoKg: null, pesoFijoKg: null, observaciones: null };
  const [nueva, setNueva] = useState(vacia);

  async function agregar() {
    setMensaje(null);
    try {
      const t = await apiCuadro.crearTarifa({ ...nueva, nombre: nueva.nombre.trim().toUpperCase() });
      setMensaje({ tipo: "success", texto: `Se agrego la tarifa ${t.nombre}.` });
      setNueva(vacia);
      tarifas.recargar();
      alCambiar();
    } catch (exc) {
      setMensaje({ tipo: "danger", texto: exc instanceof Error ? exc.message : "No se pudo agregar." });
    }
  }

  async function guardar(t: TarifaFlete, cambios: Partial<TarifaFlete>) {
    try {
      await apiCuadro.actualizarTarifa(t.id, cambios);
      tarifas.recargar();
      alCambiar();
    } catch (exc) {
      setMensaje({ tipo: "danger", texto: exc instanceof Error ? exc.message : "No se pudo guardar." });
    }
  }

  const texto = busqueda.trim().toUpperCase();
  const lista = (tarifas.datos ?? []).filter(
    (t) => !texto || t.nombre.toUpperCase().includes(texto) || (t.razonSocial ?? "").toUpperCase().includes(texto)
  );

  return (
    <Modal
      titulo="Matriz de fletes"
      ancho="pantalla"
      alCerrar={alCerrar}
      pie={
        <button className="btn-secondary" onClick={alCerrar}>
          Cerrar
        </button>
      }
    >
      <div className="section-desc" style={{ marginBottom: "0.6rem" }}>
        Importa el Excel "MATRIZ FLETES" (columnas EMPRESA, RAZON SOCIAL, VALOR, TIPO, OBSERVACIONES). Las filas
        "-34 TON" se vuelven el peso minimo (34.000 kg) de su tarifa. POR suma 300.000 (2 clientes) y POR3 600.000
        (3 clientes) al valor por tonelada. Las tarifas sin valor o con "?" se escriben a mano al enviar. Tambien se pueden agregar
        tarifas sin importar el Excel (fila de arriba). Los cambios de la tabla se guardan al salir de cada campo.
      </div>
      {mensaje && <div className={`alert ${mensaje.tipo}`}>{mensaje.texto}</div>}
      <div className="barra-envio">
        <input placeholder="Buscar cliente o tarifa..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        <label className="btn-primary boton-con-texto" style={{ marginLeft: "auto", cursor: "pointer" }}>
          {importando ? "Importando..." : "Importar Excel de la matriz"}
          <input
            type="file"
            accept=".xlsx"
            style={{ display: "none" }}
            disabled={importando}
            onChange={(e) => {
              importar(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {tarifas.cargando && !tarifas.datos && <Cargando que="la matriz" />}
      {tarifas.error && <ErrorCarga mensaje={tarifas.error} alReintentar={tarifas.recargar} />}
      <div className="tabla-envio">
        <table className="tabla tabla-compacta" style={{ width: ANCHO_MATRIZ }}>
          <colgroup>
            {COLUMNAS_MATRIZ.map((ancho, i) => (
              <col key={i} style={{ width: ancho }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th>Tarifa</th>
              <th>Razon social</th>
              <th>Valor</th>
              <th>Tipo</th>
              <th>Peso minimo (kg)</th>
              <th>Peso fijo (kg)</th>
              <th>Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {/* Tarifa nueva, sin importar el Excel. */}
            <tr className="fila-nueva">
              <td>
                <input placeholder="Nombre (ej. TOLUA PASTO)" value={nueva.nombre} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} />
              </td>
              <td>
                <input placeholder="Razon social" value={nueva.razonSocial ?? ""} onChange={(e) => setNueva({ ...nueva, razonSocial: e.target.value || null })} />
              </td>
              <td>
                <input type="number" min={0} placeholder="Valor" value={enInput(nueva.valor)} onChange={(e) => setNueva({ ...nueva, valor: deInput(e.target.value) })} />
              </td>
              <td>
                <select value={nueva.tipo} onChange={(e) => setNueva({ ...nueva, tipo: e.target.value as TarifaFlete["tipo"] })}>
                  <option value="TON">TON</option>
                  <option value="FIJO">FIJO</option>
                  <option value="POR">POR</option>
                  <option value="POR3">POR3</option>
                </select>
              </td>
              <td>
                <input type="number" min={0} placeholder="-" value={enInput(nueva.pesoMinimoKg)} onChange={(e) => setNueva({ ...nueva, pesoMinimoKg: deInput(e.target.value) })} />
              </td>
              <td>
                <input type="number" min={0} placeholder="-" value={enInput(nueva.pesoFijoKg)} onChange={(e) => setNueva({ ...nueva, pesoFijoKg: deInput(e.target.value) })} />
              </td>
              <td style={{ display: "flex", gap: "0.4rem" }}>
                <input placeholder="Observaciones" value={nueva.observaciones ?? ""} onChange={(e) => setNueva({ ...nueva, observaciones: e.target.value || null })} />
                <button className="btn-primary" onClick={agregar} disabled={!nueva.nombre.trim()}>
                  Agregar
                </button>
              </td>
            </tr>
            {lista.map((t) => (
              <tr key={t.id}>
                <td>
                  <input
                    defaultValue={t.nombre}
                    onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== t.nombre && guardar(t, { nombre: e.target.value.trim().toUpperCase() })}
                  />
                </td>
                <td>
                  <input
                    defaultValue={t.razonSocial ?? ""}
                    placeholder="-"
                    onBlur={(e) => (e.target.value.trim() || null) !== t.razonSocial && guardar(t, { razonSocial: e.target.value.trim() || null })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    defaultValue={enInput(t.valor)}
                    onBlur={(e) => deInput(e.target.value) !== t.valor && guardar(t, { valor: deInput(e.target.value) })}
                  />
                </td>
                <td>
                  <select value={t.tipo} onChange={(e) => guardar(t, { tipo: e.target.value as TarifaFlete["tipo"] })}>
                    <option value="TON">TON</option>
                    <option value="FIJO">FIJO</option>
                    <option value="POR">POR</option>
                    <option value="POR3">POR3</option>
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    defaultValue={enInput(t.pesoMinimoKg)}
                    placeholder="-"
                    onBlur={(e) =>
                      deInput(e.target.value) !== t.pesoMinimoKg && guardar(t, { pesoMinimoKg: deInput(e.target.value) })
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    defaultValue={enInput(t.pesoFijoKg)}
                    placeholder="-"
                    onBlur={(e) => deInput(e.target.value) !== t.pesoFijoKg && guardar(t, { pesoFijoKg: deInput(e.target.value) })}
                  />
                </td>
                <td>
                  <input
                    defaultValue={t.observaciones ?? ""}
                    placeholder="-"
                    onBlur={(e) => (e.target.value.trim() || null) !== t.observaciones && guardar(t, { observaciones: e.target.value.trim() || null })}
                  />
                </td>
              </tr>
            ))}
            {tarifas.datos && lista.length === 0 && (
              <tr>
                <td colSpan={7} className="dato-sec">
                  {tarifas.datos.length ? "Ninguna tarifa coincide." : "Aun no hay matriz: importa el Excel."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
