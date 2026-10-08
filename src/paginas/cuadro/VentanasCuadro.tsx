/**
 * Ventanas auxiliares del cuadro pagos: nuevo viaje sin manifiesto, facturar
 * varios viajes y catalogo de bombas aliadas.
 */
import { useMemo, useState } from "react";
import { api, apiCuadro, moneda } from "../../api/cliente";
import type { FilaCuadro } from "../../api/cliente";
import { useDatos } from "../../ganchos/useDatos";
import Modal from "../../componentes/Modal";
import { fechaCorta, hoyColombia } from "./estadosCuadro";

const FLUJO_LARGO = /CORAME|CARTONES\s+AMERICA/i;

/**
 * Viaje sin manifiesto de la empresa: urbanos, o viajes que planilla el mismo
 * generador de carga. Solo lo minimo; el resto se completa en el detalle.
 */
export function NuevoViajeCuadro({
  empresas,
  alCerrar,
  alCrear,
}: {
  empresas: string[];
  alCerrar: () => void;
  alCrear: (id: number) => void;
}) {
  const vehiculos = useDatos(() => api.getVehiculos(), []);
  const [f, setF] = useState({
    fecha: hoyColombia(),
    placa: "",
    empresa: "",
    conductor: "",
    remision: "",
    pesoKg: "",
    tipoFlete: "KILO",
    tarifaKilo: "",
    valorFijo: "",
  });
  const [flujoCorame, setFlujoCorame] = useState<boolean | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Se deduce de la empresa hasta que el usuario lo cambie a mano.
  const corame = flujoCorame ?? FLUJO_LARGO.test(f.empresa);

  async function crear() {
    setEnviando(true);
    setError(null);
    try {
      const d = await apiCuadro.crear({ ...f, flujoCorame: corame });
      alCrear(d.id);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo crear el viaje.");
      setEnviando(false);
    }
  }

  const input = (c: keyof typeof f, etiqueta: string, tipo = "text", extra: Record<string, unknown> = {}) => (
    <div>
      <label>{etiqueta}</label>
      <input type={tipo} value={f[c]} onChange={(e) => setF({ ...f, [c]: e.target.value })} {...extra} />
    </div>
  );

  return (
    <Modal
      titulo="Nuevo viaje sin manifiesto"
      alCerrar={alCerrar}
      pie={
        <>
          <button className="btn-secondary" onClick={alCerrar}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={crear} disabled={enviando || !f.placa || !f.empresa || !f.fecha}>
            {enviando ? "Creando..." : "Crear viaje"}
          </button>
        </>
      }
    >
      <div className="section-desc" style={{ marginBottom: "0.8rem" }}>
        Para urbanos o viajes que planilla el mismo cliente. Los viajes con manifiesto de la empresa entran solos al
        cuadro al expedirlos.
      </div>
      {error && <div className="alert danger">{error}</div>}
      <div className="campos-cuadro">
        {input("fecha", "Fecha", "date")}
        <div>
          <label>Placa</label>
          <input list="cuadro-placas" value={f.placa} onChange={(e) => setF({ ...f, placa: e.target.value.toUpperCase() })} />
          <datalist id="cuadro-placas">
            {(vehiculos.datos ?? []).filter((v) => v.activo).map((v) => (
              <option key={v.id} value={v.placa} />
            ))}
          </datalist>
        </div>
        <div>
          <label>Empresa</label>
          <input list="cuadro-empresas" value={f.empresa} onChange={(e) => setF({ ...f, empresa: e.target.value.toUpperCase() })} />
          <datalist id="cuadro-empresas">
            {empresas.map((e) => (
              <option key={e} value={e} />
            ))}
          </datalist>
        </div>
        {input("conductor", "Conductor")}
        {input("remision", "Remision")}
        {input("pesoKg", "Peso real (kg)", "number", { min: 0 })}
        <div>
          <label>Se cobra</label>
          <select value={f.tipoFlete} onChange={(e) => setF({ ...f, tipoFlete: e.target.value })}>
            <option value="KILO">Por kilo</option>
            <option value="FIJO">Valor fijo</option>
          </select>
        </div>
        {f.tipoFlete === "KILO"
          ? input("tarifaKilo", "Tarifa ($ por kilo)", "number", { min: 0, step: "0.01" })
          : input("valorFijo", "Valor fijo", "number", { min: 0 })}
      </div>
      <label className="check-linea">
        <input type="checkbox" checked={corame} onChange={(e) => setFlujoCorame(e.target.checked)} />
        Pasa por parqueadero y oficina de Don Alexander (CORAME / Cartones America)
      </label>
    </Modal>
  );
}

/**
 * Una factura para varios viajes a la vez (los urbanos se facturan juntos).
 * Lista los viajes sin numero de factura; se filtran por empresa y se marcan.
 */
export function FacturarVarios({ filas, alCerrar, alTerminar }: { filas: FilaCuadro[]; alCerrar: () => void; alTerminar: () => void }) {
  const candidatos = useMemo(() => filas.filter((f) => !f.anulado && !f.facturaNumero), [filas]);
  const empresas = useMemo(() => [...new Set(candidatos.map((f) => f.empresa))].sort(), [candidatos]);
  const [empresa, setEmpresa] = useState("");
  const [numero, setNumero] = useState("");
  const [fecha, setFecha] = useState(hoyColombia());
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const visibles = candidatos.filter((f) => !empresa || f.empresa === empresa);
  const total = visibles.filter((f) => marcados.has(f.id)).reduce((t, f) => t + (f.valorFlete ?? 0), 0);

  const alternar = (id: number) =>
    setMarcados((m) => {
      const n = new Set(m);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function facturar() {
    setEnviando(true);
    setError(null);
    try {
      await apiCuadro.facturar([...marcados], numero, fecha);
      alTerminar();
      alCerrar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo facturar.");
      setEnviando(false);
    }
  }

  return (
    <Modal
      titulo="Facturar varios viajes"
      ancho="wide"
      alCerrar={alCerrar}
      pie={
        <>
          <button className="btn-secondary" onClick={alCerrar}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={facturar} disabled={enviando || marcados.size === 0}>
            {enviando ? "Guardando..." : `Facturar ${marcados.size} viaje${marcados.size === 1 ? "" : "s"}`}
          </button>
        </>
      }
    >
      <div className="section-desc" style={{ marginBottom: "0.8rem" }}>
        Sin numero de factura, los viajes quedan como "Facturado sin datos" (azul) hasta completarlos.
      </div>
      {error && <div className="alert danger">{error}</div>}
      <div className="campos-cuadro">
        <div>
          <label>Empresa</label>
          <select value={empresa} onChange={(e) => { setEmpresa(e.target.value); setMarcados(new Set()); }}>
            <option value="">Todas</option>
            {empresas.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Numero de factura</label>
          <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Opcional" />
        </div>
        <div>
          <label>Fecha de factura</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
      </div>
      <div className="lista-facturar">
        <table className="tabla tabla-compacta">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  aria-label="Marcar todos"
                  checked={visibles.length > 0 && visibles.every((f) => marcados.has(f.id))}
                  onChange={(e) => setMarcados(e.target.checked ? new Set(visibles.map((f) => f.id)) : new Set())}
                />
              </th>
              <th>Fecha</th>
              <th>Placa</th>
              <th>Empresa</th>
              <th>Remision</th>
              <th className="num">Flete</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((f) => (
              <tr key={f.id} onClick={() => alternar(f.id)} className="fila-clic">
                <td>
                  <input type="checkbox" checked={marcados.has(f.id)} onChange={() => alternar(f.id)} onClick={(e) => e.stopPropagation()} />
                </td>
                <td>{fechaCorta(f.fecha)}</td>
                <td>{f.placa}</td>
                <td>{f.empresa}</td>
                <td className="codigo">{f.remision ?? "-"}</td>
                <td className="num">{f.valorFlete === null ? "-" : moneda(f.valorFlete)}</td>
              </tr>
            ))}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={6} className="dato-sec">
                  No hay viajes sin factura.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {marcados.size > 0 && (
        <div className="dato-sec" style={{ marginTop: "0.5rem" }}>
          {marcados.size} viaje{marcados.size === 1 ? "" : "s"} · flete total {moneda(total)}
        </div>
      )}
    </Modal>
  );
}

/** Bombas aliadas que entregan anticipos. */
export function VentanaBombas({ alCerrar }: { alCerrar: () => void }) {
  const lista = useDatos(() => apiCuadro.bombas(), []);
  const [nombre, setNombre] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function hacer(accion: () => Promise<unknown>) {
    setError(null);
    try {
      await accion();
      lista.recargar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
    }
  }

  return (
    <Modal
      titulo="Bombas aliadas"
      alCerrar={alCerrar}
      pie={
        <button className="btn-secondary" onClick={alCerrar}>
          Cerrar
        </button>
      }
    >
      <div className="section-desc" style={{ marginBottom: "0.8rem" }}>
        Las bombas que entregan anticipos a los conductores. Una bomba desactivada ya no aparece al registrar anticipos.
      </div>
      {error && <div className="alert danger">{error}</div>}
      <div className="campos-cuadro">
        <div>
          <label>Nombre</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Terpel La Estrella" />
        </div>
        <div>
          <label>Ciudad</label>
          <input value={ciudad} onChange={(e) => setCiudad(e.target.value)} placeholder="Ej. Popayan" />
        </div>
      </div>
      <button
        type="button"
        className="btn-primary"
        style={{ marginTop: "0.5rem" }}
        disabled={!nombre.trim()}
        onClick={() =>
          hacer(async () => {
            await apiCuadro.crearBomba({ nombre, ciudad });
            setNombre("");
            setCiudad("");
          })
        }
      >
        Agregar bomba
      </button>
      <table className="tabla tabla-compacta" style={{ marginTop: "1rem" }}>
        <tbody>
          {(lista.datos ?? []).map((b) => (
            <tr key={b.id}>
              <td className="principal">{b.nombre}</td>
              <td>{b.ciudad ?? "-"}</td>
              <td>
                <button type="button" className="btn-link" onClick={() => hacer(() => apiCuadro.actualizarBomba(b.id, { activa: !b.activa }))}>
                  {b.activa ? "Desactivar" : "Activar"}
                </button>
              </td>
            </tr>
          ))}
          {lista.datos && lista.datos.length === 0 && (
            <tr>
              <td className="dato-sec">Aun no hay bombas.</td>
            </tr>
          )}
        </tbody>
      </table>
    </Modal>
  );
}
