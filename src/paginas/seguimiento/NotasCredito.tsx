/**
 * Notas credito (Cartera > Notas credito): por ley, cada factura anulada se
 * reemplaza con una nota credito. Aqui estan todas, con su consecutivo,
 * fecha, cliente, la factura que anulan y la que la reemplaza, para
 * consultarlas y descargar el reporte en Excel. Tambien se registran (para
 * una factura que ya no este en la cartera) y se borran si se digitaron mal.
 * Desde el detalle de una factura de la cartera se registra la suya. La
 * factura con nota credito sale de la cartera: se entiende que otra la
 * reemplazo.
 */
import { useState } from "react";
import { apiSeguimiento, moneda } from "../../api/cliente";
import type { NotaCredito } from "../../api/cliente";
import { useDatos } from "../../ganchos/useDatos";
import { Cargando, ErrorCarga } from "../../componentes/Estado";
import Indicador from "../../componentes/Indicador";
import TablaDatos, { Pastilla } from "../../componentes/TablaDatos";
import type { Columna } from "../../componentes/TablaDatos";
import { fechaCorta, hoyColombia } from "../cuadro/estadosCuadro";

/** Formulario de una nota credito. Con factura (desde la cartera), el cliente y la factura anulada ya vienen. */
export function FormularioNotaCredito({
  factura,
  valorSugerido,
  alGuardar,
}: {
  factura?: { numero: string; empresa: string };
  valorSugerido?: number;
  alGuardar: () => void;
}) {
  const [f, setF] = useState({
    numero: "",
    fecha: hoyColombia(),
    empresa: factura?.empresa ?? "",
    facturaAnulada: factura?.numero ?? "",
    facturaReemplazo: "",
    valor: valorSugerido ? String(Math.round(valorSugerido)) : "",
    motivo: "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cambiar = (c: Partial<typeof f>) => setF({ ...f, ...c });

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      await apiSeguimiento.agregarNotaCredito({ ...f, valor: f.valor.trim() === "" ? null : Number(f.valor) });
      setF({ ...f, numero: "", facturaReemplazo: "", motivo: "", ...(factura ? {} : { empresa: "", facturaAnulada: "", valor: "" }) });
      alGuardar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar la nota credito.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="nota-credito-form">
      {error && <div className="alert danger">{error}</div>}
      <div className="campos-cuadro">
        <div>
          <label>Consecutivo de la nota credito</label>
          <input value={f.numero} maxLength={40} onChange={(e) => cambiar({ numero: e.target.value })} placeholder="NC-0001" />
        </div>
        <div>
          <label>Fecha</label>
          <input type="date" value={f.fecha} onChange={(e) => cambiar({ fecha: e.target.value })} />
        </div>
        {!factura && (
          <>
            <div>
              <label>Cliente</label>
              <input value={f.empresa} maxLength={200} onChange={(e) => cambiar({ empresa: e.target.value })} placeholder="Como aparece en la factura" />
            </div>
            <div>
              <label>Factura anulada</label>
              <input value={f.facturaAnulada} maxLength={30} onChange={(e) => cambiar({ facturaAnulada: e.target.value })} />
            </div>
          </>
        )}
        <div>
          <label>Factura que la reemplaza</label>
          <input
            value={f.facturaReemplazo}
            maxLength={30}
            onChange={(e) => cambiar({ facturaReemplazo: e.target.value })}
            placeholder="Numero de la factura nueva"
          />
        </div>
        <div>
          <label>Valor</label>
          <input type="number" min={0} value={f.valor} onChange={(e) => cambiar({ valor: e.target.value })} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label>Motivo (opcional)</label>
          <input value={f.motivo} maxLength={300} onChange={(e) => cambiar({ motivo: e.target.value })} placeholder="Por que se anulo la factura" />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.5rem" }}>
        <button className="btn-primary" onClick={guardar} disabled={guardando || !f.numero.trim() || !f.fecha || !f.facturaAnulada.trim() || !f.empresa.trim()}>
          {guardando ? "Guardando..." : "Registrar nota credito"}
        </button>
      </div>
    </div>
  );
}

/** Las notas credito de una factura de la cartera (en su detalle), con el formulario para registrar la suya. */
export function NotasDeFactura({ numero, empresa, valor, alCambiar }: { numero: string; empresa: string; valor: number; alCambiar: () => void }) {
  const carga = useDatos(() => apiSeguimiento.notasCredito({ facturaNumero: numero, empresa }), [numero, empresa]);
  const notas = carga.datos ?? [];
  const recargar = () => {
    carga.recargar();
    alCambiar();
  };
  return (
    <>
      {notas.length > 0 && (
        <table className="tabla tabla-compacta" style={{ marginBottom: "0.6rem" }}>
          <thead>
            <tr>
              <th>Nota credito</th>
              <th>Fecha</th>
              <th>La reemplaza</th>
              <th className="num">Valor</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {notas.map((n) => (
              <tr key={n.id}>
                <td className="codigo">{n.numero}</td>
                <td>{fechaCorta(n.fecha)}</td>
                <td>{n.facturaReemplazo ? <span className="codigo">{n.facturaReemplazo}</span> : <Pastilla tono="aviso">Sin factura nueva</Pastilla>}</td>
                <td className="num">{n.valor === null ? "-" : moneda(n.valor)}</td>
                <td className="num">
                  <BorrarNota nota={n} alBorrar={recargar} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <FormularioNotaCredito factura={{ numero, empresa }} valorSugerido={valor} alGuardar={recargar} />
    </>
  );
}

/** Boton para borrar una nota credito (si se digito mal). */
function BorrarNota({ nota, alBorrar }: { nota: NotaCredito; alBorrar: () => void }) {
  const [borrando, setBorrando] = useState(false);
  return (
    <button
      className="btn-link"
      disabled={borrando}
      onClick={async () => {
        if (!window.confirm(`¿Borrar la nota credito ${nota.numero} de la factura ${nota.facturaAnulada}?`)) return;
        setBorrando(true);
        try {
          await apiSeguimiento.borrarNotaCredito(nota.id);
          alBorrar();
        } catch (exc) {
          window.alert(exc instanceof Error ? exc.message : "No se pudo borrar la nota credito.");
        } finally {
          setBorrando(false);
        }
      }}
    >
      Borrar
    </button>
  );
}

/** La pestana de las notas credito: todas, con su reporte en Excel. */
export default function NotasCredito() {
  const carga = useDatos(() => apiSeguimiento.notasCredito(), []);
  const [nueva, setNueva] = useState(false);
  if (carga.cargando && !carga.datos) return <Cargando que="las notas credito" />;
  if (carga.error || !carga.datos) return <ErrorCarga mensaje={carga.error ?? "Sin datos"} alReintentar={carga.recargar} />;
  const notas = carga.datos;
  const sinReemplazo = notas.filter((n) => !n.facturaReemplazo);

  const columnas: Columna<NotaCredito>[] = [
    { id: "fecha", titulo: "Fecha", valor: (n) => n.fecha, celda: (n) => fechaCorta(n.fecha) },
    { id: "numero", titulo: "Nota credito", valor: (n) => n.numero, celda: (n) => <span className="codigo">{n.numero}</span> },
    { id: "empresa", titulo: "Cliente", filtrable: true, valor: (n) => n.empresa, celda: (n) => n.empresa },
    { id: "anulada", titulo: "Factura anulada", valor: (n) => n.facturaAnulada, celda: (n) => <span className="codigo">{n.facturaAnulada}</span> },
    {
      id: "reemplazo",
      titulo: "Factura que la reemplaza",
      valor: (n) => n.facturaReemplazo ?? "",
      celda: (n) => (n.facturaReemplazo ? <span className="codigo">{n.facturaReemplazo}</span> : <Pastilla tono="aviso">Sin factura nueva</Pastilla>),
    },
    { id: "valor", titulo: "Valor", alinear: "derecha", valor: (n) => n.valor, celda: (n) => (n.valor === null ? "-" : moneda(n.valor)) },
    { id: "motivo", titulo: "Motivo", valor: (n) => n.motivo ?? "", celda: (n) => n.motivo ?? <span className="dato-sec">-</span> },
    { id: "registro", titulo: "Registro", valor: (n) => n.registradoPor ?? "", celda: (n) => <span className="dato-sec">{n.registradoPor ?? "-"}</span> },
    { id: "borrar", titulo: "", celda: (n) => <BorrarNota nota={n} alBorrar={carga.recargar} /> },
  ];

  return (
    <>
      <div className="tarjeta indicadores" style={{ marginBottom: "0.75rem" }}>
        <Indicador titulo="Notas credito" valor={notas.length} detalle="facturas anuladas" />
        <Indicador dinero titulo="Valor de las notas" valor={moneda(notas.reduce((t, n) => t + (n.valor ?? 0), 0))} detalle="lo que se anulo" />
        <Indicador titulo="Sin factura nueva" valor={sinReemplazo.length} detalle="aun sin la factura que las reemplaza" alerta={sinReemplazo.length > 0} />
      </div>
      <div className="section-desc" style={{ marginBottom: "0.5rem" }}>
        Cada factura anulada se reemplaza con una nota credito. Registrala desde el detalle de la factura en "Facturas por cobrar" o aqui (si la factura ya no
        esta en la cartera). Exportar descarga el reporte con lo que esta en pantalla.
      </div>
      <div className="panel">
        <TablaDatos
          filas={notas}
          columnas={columnas}
          clave={(n) => n.id}
          nombreArchivo={`notas-credito-${hoyColombia()}`}
          placeholderBusqueda="Buscar nota credito, factura o cliente..."
          vacio="Aun no hay notas credito."
          acciones={
            <button className="btn-primary" onClick={() => setNueva(!nueva)}>
              {nueva ? "Cerrar" : "Nueva nota credito"}
            </button>
          }
        />
      </div>
      {nueva && (
        <div className="panel" style={{ marginTop: "0.8rem", padding: "0.9rem 1rem" }}>
          <h4 style={{ marginTop: 0 }}>Nueva nota credito</h4>
          <FormularioNotaCredito
            alGuardar={() => {
              setNueva(false);
              carga.recargar();
            }}
          />
        </div>
      )}
    </>
  );
}
