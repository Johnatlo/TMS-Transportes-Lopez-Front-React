/**
 * Matriz de fletes conductor: para cada tarifa de la matriz de fletes de la
 * empresa (la misma con que se cobra el viaje), lo que vale el viaje para el
 * conductor (por tonelada o fijo), con su vigencia. Con ella se calcula el
 * producido conductor de cada viaje. Solo se ve en este modulo. Se puede
 * cargar del Excel (hoja con el bloque "FLETES CONDUCTOR", como TABLAS de
 * SWK-973): cada nombre se busca entre las tarifas de la empresa.
 */
import { useState } from "react";
import { apiConductores, moneda } from "../../api/cliente";
import type { TarifaConductor, TipoFleteConductor } from "../../api/cliente";
import { useDatos } from "../../ganchos/useDatos";
import { Cargando, ErrorCarga } from "../../componentes/Estado";
import MiniTabla from "../../componentes/MiniTabla";
import Modal from "../../componentes/Modal";
import TablaDatos, { Pastilla } from "../../componentes/TablaDatos";
import type { Columna, PestanaTabla } from "../../componentes/TablaDatos";
import { fechaCorta } from "../cuadro/estadosCuadro";
import { leerMatrizConductor } from "./calculos";
import type { FilaMatriz } from "./calculos";

/** Valor de la matriz como texto ("4.200.000 fijo" / "100.000 por ton" / "200.000 integro"). */
const valorTexto = (valor: number, tipo: string) => `${moneda(valor)} ${tipo === "FIJO" ? "fijo" : tipo === "INTEGRO" ? "integro" : "por ton"}`;

/** La matriz de fletes conductor. */
export default function FletesConductor() {
  const carga = useDatos(() => apiConductores.fletes(), []);
  const [editando, setEditando] = useState<TarifaConductor | null>(null);
  const [importando, setImportando] = useState(false);
  if (carga.cargando && !carga.datos) return <Cargando que="la matriz de fletes conductor" />;
  if (carga.error || !carga.datos) return <ErrorCarga mensaje={carga.error ?? "Sin datos"} alReintentar={carga.recargar} />;
  const tarifas = carga.datos;

  const columnas: Columna<TarifaConductor>[] = [
    {
      id: "nombre",
      titulo: "Tarifa (cliente y ruta)",
      valor: (t) => t.nombre,
      buscar: (t) => t.razonSocial,
      celda: (t) => (
        <>
          <span className="principal">{t.nombre}</span>
          {t.razonSocial && t.razonSocial !== t.nombre && <span className="dato-sec">{t.razonSocial}</span>}
        </>
      ),
    },
    {
      id: "empresa",
      titulo: "Flete empresa",
      alinear: "derecha",
      valor: (t) => t.valorEmpresa ?? 0,
      celda: (t) => <span className="dato-sec">{t.valorEmpresa === null ? "-" : valorTexto(t.valorEmpresa, t.tipoEmpresa)}</span>,
    },
    {
      id: "conductor",
      titulo: "Flete conductor",
      alinear: "derecha",
      valor: (t) => t.vigente?.valor ?? 0,
      celda: (t) =>
        t.vigente ? (
          <>
            <strong>{valorTexto(t.vigente.valor, t.vigente.tipo)}</strong>
            <span className="dato-sec">desde {fechaCorta(t.vigente.desde)}</span>
          </>
        ) : (
          <Pastilla tono="aviso">Sin valor</Pastilla>
        ),
    },
    { id: "viajes", titulo: "Viajes (90 dias)", alinear: "derecha", valor: (t) => t.viajesRecientes, celda: (t) => t.viajesRecientes || "-" },
  ];
  const pestanas: PestanaTabla<TarifaConductor>[] = [
    { id: "uso", etiqueta: "Con viajes recientes", incluye: (t) => t.viajesRecientes > 0 },
    { id: "sin", etiqueta: "Sin flete conductor", incluye: (t) => !t.vigente },
    { id: "todas", etiqueta: "Todas", incluye: () => true },
  ];

  return (
    <>
      <div className="section-desc" style={{ margin: "0 0 0.6rem" }}>
        Lo que vale cada viaje para el conductor, por tarifa de la matriz de la empresa. Con este valor se calcula el producido conductor (sobre el van el 4 %
        salarial y el 5 % de viaticos). Clic en una tarifa para cambiar su valor desde una fecha: los viajes anteriores conservan el suyo.
      </div>
      <div className="panel">
        <TablaDatos
          filas={tarifas}
          columnas={columnas}
          clave={(t) => t.tarifaFleteId}
          pestanas={pestanas}
          nombreArchivo="fletes-conductor"
          placeholderBusqueda="Buscar tarifa o cliente..."
          vacio="No hay tarifas con estos criterios."
          alClicFila={(t) => setEditando(t)}
          acciones={
            <button className="boton-barra" onClick={() => setImportando(true)}>
              Importar Excel
            </button>
          }
        />
      </div>
      {editando && (
        <VentanaFlete
          tarifa={editando}
          alCerrar={() => setEditando(null)}
          alCambiar={(lista) => {
            carga.recargar();
            setEditando(lista.find((t) => t.tarifaFleteId === editando.tarifaFleteId) ?? null);
          }}
        />
      )}
      {importando && (
        <VentanaImportar
          alCerrar={() => setImportando(false)}
          alImportar={() => {
            setImportando(false);
            carga.recargar();
          }}
        />
      )}
    </>
  );
}

/** El flete conductor de una tarifa: historial y nuevo valor desde una fecha. */
function VentanaFlete({ tarifa, alCerrar, alCambiar }: { tarifa: TarifaConductor; alCerrar: () => void; alCambiar: (lista: TarifaConductor[]) => void }) {
  const [valor, setValor] = useState(tarifa.vigente ? String(tarifa.vigente.valor) : "");
  const [tipo, setTipo] = useState<TipoFleteConductor>(tarifa.vigente?.tipo ?? "FIJO");
  const [desde, setDesde] = useState(tarifa.vigente ? new Date().toISOString().slice(0, 10) : "2020-01-01");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function correr(fn: () => Promise<TarifaConductor[]>) {
    setGuardando(true);
    setError(null);
    try {
      alCambiar(await fn());
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
    }
    setGuardando(false);
  }

  return (
    <Modal
      titulo={`Flete conductor · ${tarifa.nombre}`}
      alCerrar={alCerrar}
      pie={
        <>
          <button className="btn-secondary" onClick={alCerrar}>
            Cerrar
          </button>
          <button
            className="btn-primary"
            disabled={guardando || !(Number(valor) > 0) || !desde}
            onClick={() => correr(() => apiConductores.guardarFlete({ tarifaFleteId: tarifa.tarifaFleteId, valor: Number(valor), tipo, desde }))}
          >
            Guardar valor
          </button>
        </>
      }
    >
      {error && <div className="alert danger">{error}</div>}
      <div className="dato-sec" style={{ marginBottom: "0.6rem" }}>
        Flete de la empresa: {tarifa.valorEmpresa === null ? "sin valor" : valorTexto(tarifa.valorEmpresa, tarifa.tipoEmpresa)}
        {tarifa.razonSocial ? ` · ${tarifa.razonSocial}` : ""}
      </div>
      <div className="campos-cuadro">
        <div>
          <label>Flete del conductor</label>
          <input type="number" min={0} value={valor} onChange={(e) => setValor(e.target.value)} />
        </div>
        <div>
          <label>Se paga</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoFleteConductor)}>
            <option value="FIJO">Fijo por viaje (se le saca el %)</option>
            <option value="TON">Por tonelada (x las toneladas reales; se le saca el %)</option>
            <option value="INTEGRO">Integro por viaje (se le paga completo, sin %)</option>
          </select>
        </div>
        <div>
          <label>Desde</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
      </div>
      <h5 style={{ margin: "1rem 0 0.3rem" }}>Historial</h5>
      {tarifa.historial.length ? (
        <MiniTabla
          filas={tarifa.historial}
          clave={(h) => h.id}
          nombre="valores"
          visibles={5}
          columnas={[
            { titulo: "Desde", celda: (h) => fechaCorta(h.desde) },
            { titulo: "Valor", num: true, celda: (h) => valorTexto(h.valor, h.tipo) },
            {
              titulo: "",
              celda: (h) => (
                <button
                  className="btn-link"
                  disabled={guardando}
                  onClick={() => window.confirm("¿Borrar este valor?") && correr(() => apiConductores.borrarFlete(h.id))}
                >
                  Borrar
                </button>
              ),
            },
          ]}
        />
      ) : (
        <span className="dato-sec">Aun no tiene flete conductor.</span>
      )}
    </Modal>
  );
}

/** Importar la matriz del Excel: lee el bloque "FLETES CONDUCTOR", muestra cuales encontro y las guarda. */
function VentanaImportar({ alCerrar, alImportar }: { alCerrar: () => void; alImportar: () => void }) {
  const [filas, setFilas] = useState<FilaMatriz[] | null>(null);
  const [previa, setPrevia] = useState<Awaited<ReturnType<typeof apiConductores.importarFletes>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  /** Lee el Excel en el navegador y pide al servidor que busque cada tarifa (sin guardar). */
  async function leer(archivo: File) {
    setError(null);
    setPrevia(null);
    setTrabajando(true);
    try {
      const { default: ExcelJS } = await import("exceljs");
      const libro = new ExcelJS.Workbook();
      await libro.xlsx.load(await archivo.arrayBuffer());
      let encontradas: FilaMatriz[] = [];
      libro.eachSheet((hoja) => {
        if (encontradas.length) return;
        const matriz: unknown[][] = [];
        hoja.eachRow({ includeEmpty: true }, (fila, n) => {
          const valores: unknown[] = [];
          fila.eachCell({ includeEmpty: true }, (c, col) => {
            const v = c.value as unknown;
            valores[col - 1] = v && typeof v === "object" && "result" in (v as object) ? (v as { result: unknown }).result : v;
          });
          matriz[n - 1] = valores;
        });
        encontradas = leerMatrizConductor(matriz.map((f) => f ?? []));
      });
      if (!encontradas.length)
        throw new Error('No se encontro la matriz: el Excel debe tener el bloque "FLETES CONDUCTOR" con EMPRESA, VALOR, FECHA VIGENCIA y TIPO.');
      setFilas(encontradas);
      setPrevia(await apiConductores.importarFletes(encontradas, false));
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo leer el Excel.");
    }
    setTrabajando(false);
  }

  async function importar() {
    if (!filas) return;
    setTrabajando(true);
    try {
      await apiConductores.importarFletes(filas, true);
      alImportar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo importar.");
      setTrabajando(false);
    }
  }

  return (
    <Modal
      titulo="Importar la matriz de fletes conductor"
      ancho="wide"
      alCerrar={alCerrar}
      pie={
        <>
          <button className="btn-secondary" onClick={alCerrar}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={trabajando || !previa?.encontradas.length} onClick={importar}>
            {previa ? `Importar ${previa.encontradas.length} valor(es)` : "Importar"}
          </button>
        </>
      }
    >
      {error && <div className="alert danger">{error}</div>}
      <p className="dato-sec" style={{ marginTop: 0 }}>
        Elige el Excel con la matriz (por ejemplo SWK-973, hoja TABLAS: el bloque "FLETES CONDUCTOR"). Cada nombre se busca entre las tarifas de la matriz de la
        empresa; los que no se encuentren se ponen a mano.
      </p>
      <input type="file" accept=".xlsx" disabled={trabajando} onChange={(e) => e.target.files?.[0] && leer(e.target.files[0])} />
      {trabajando && !previa && <Cargando que="el Excel" />}
      {previa && (
        <>
          <h5 style={{ margin: "1rem 0 0.3rem" }}>Se encontraron {previa.encontradas.length}</h5>
          <MiniTabla
            filas={previa.encontradas}
            clave={(f, i) => `${f.nombre}-${i}`}
            nombre="tarifas"
            visibles={8}
            columnas={[
              { titulo: "En el Excel", celda: (f) => f.nombre },
              { titulo: "Tarifa del sistema", celda: (f) => f.tarifa },
              { titulo: "Valor", num: true, celda: (f) => valorTexto(f.valor, f.tipo) },
              { titulo: "Desde", celda: (f) => fechaCorta(f.desde) },
            ]}
          />
          {(previa.protegidas ?? []).length > 0 && (
            <div className="alert warning" style={{ marginTop: "0.6rem" }}>
              <strong>{previa.protegidas!.length} no se importan</strong> porque cambiarian meses ya cerrados, con nomina aprobada o liquidacion pagada (ponles
              el valor nuevo desde una fecha posterior): {previa.protegidas!.map((p) => p.nombre).join(", ")}
            </div>
          )}
          {previa.sinTarifa.length > 0 && (
            <div className="alert warning" style={{ marginTop: "0.6rem" }}>
              <strong>{previa.sinTarifa.length} sin tarifa en el sistema</strong> (no se importan; ponlos a mano o crea la tarifa en la matriz de fletes):{" "}
              {previa.sinTarifa.join(", ")}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
