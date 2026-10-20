/**
 * Nombres de los terceros desde la "Matriz Terceros" de Excel.
 *
 * 1. Se elige el archivo; el navegador lee de cada hoja el nombre, la cedula
 *    y las placas del tercero.
 * 2. El servidor propone a que vehiculos de Flota se le pone cada nombre (por
 *    placa o, si no, por la cedula del tenedor).
 * 3. Al confirmar, el nombre queda como "Nombre del titular" del vehiculo
 *    (se puede cambiar en Flota) y Pago a terceros lo muestra asi.
 */
import { useState } from "react";
import { apiSeguimiento } from "../../api/cliente";
import type { NombreTerceroImportado, NombreTerceroPropuesto } from "../../api/cliente";
import Modal from "../../componentes/Modal";
import { Pastilla } from "../../componentes/TablaDatos";
import { leerHojas, tercerosDesdeHojas } from "./cargaExcel";

/** Ventana: leer la matriz, ver a que vehiculos va cada nombre y confirmar. */
export default function ImportarNombresTerceros({ alCerrar, alCambiar }: { alCerrar: () => void; alCambiar: () => void }) {
  const [leidos, setLeidos] = useState<NombreTerceroImportado[] | null>(null);
  const [propuesta, setPropuesta] = useState<NombreTerceroPropuesto[] | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function leer(archivo: File | undefined) {
    if (!archivo) return;
    setError(null);
    setAviso(null);
    setTrabajando(true);
    try {
      const terceros = tercerosDesdeHojas(await leerHojas(archivo));
      if (terceros.length === 0) throw new Error("No se encontraron terceros: cada hoja debe traer el nombre en la fila 1.");
      setLeidos(terceros);
      setPropuesta(await apiSeguimiento.previaNombresTerceros(terceros));
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo leer el archivo.");
    } finally {
      setTrabajando(false);
    }
  }

  async function importar() {
    if (!leidos) return;
    setError(null);
    setTrabajando(true);
    try {
      const { actualizados } = await apiSeguimiento.importarNombresTerceros(leidos);
      setAviso(`Listo: ${actualizados} vehiculo(s) con nombre nuevo.`);
      setPropuesta(await apiSeguimiento.previaNombresTerceros(leidos));
      alCambiar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
    } finally {
      setTrabajando(false);
    }
  }

  const conVehiculo = (propuesta ?? []).filter((p) => p.vehiculos.length > 0);
  const cambios = conVehiculo.flatMap((p) => p.vehiculos.filter((v) => v.nombreActual !== p.nombre)).length;

  return (
    <Modal
      ancho="wide"
      titulo="Nombres de los terceros desde la matriz"
      alCerrar={alCerrar}
      pie={
        <>
          <button className="btn-secondary" onClick={alCerrar}>
            Cerrar
          </button>
          {propuesta && (
            <button className="btn-primary" onClick={importar} disabled={trabajando || cambios === 0}>
              {trabajando ? "Guardando..." : `Poner ${cambios} nombre(s)`}
            </button>
          )}
        </>
      }
    >
      {error && <div className="alert danger">{error}</div>}
      {aviso && <div className="alert success">{aviso}</div>}
      <div className="dato-sec" style={{ marginBottom: "0.6rem" }}>
        De cada hoja de la "Matriz Terceros" se toma el nombre (fila 1), la cedula y las placas. El nombre queda como
        titular del vehiculo en Flota, donde se puede corregir. No cambia nada que se envie al RNDC.
      </div>
      {!propuesta && (
        <label className="btn-primary boton-con-texto" style={{ cursor: "pointer", alignSelf: "flex-start" }}>
          {trabajando ? "Leyendo..." : "Elegir la Matriz Terceros"}
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
      {propuesta && (
        <table className="tabla">
          <thead>
            <tr>
              <th>Tercero en la matriz</th>
              <th>Vehiculos</th>
            </tr>
          </thead>
          <tbody>
            {propuesta.map((p) => (
              <tr key={p.nombre}>
                <td>
                  <span className="principal">{p.nombre}</span>
                  <span className="dato-sec">
                    {p.cedula ? `CC ${p.cedula} · ` : ""}
                    {p.placas.join(", ") || "sin placas"}
                  </span>
                </td>
                <td>
                  {p.vehiculos.length === 0 ? (
                    <Pastilla tono="aviso">No esta en Flota (o es de un socio)</Pastilla>
                  ) : (
                    p.vehiculos.map((v) => (
                      <div key={v.id}>
                        <strong>{v.placa}</strong> {v.por === "CEDULA" && <span className="dato-sec">(por cedula)</span>}{" "}
                        {v.nombreActual === p.nombre ? (
                          <Pastilla tono="ok">Ya tiene este nombre</Pastilla>
                        ) : (
                          <span className="dato-sec">{v.nombreActual ? `antes: ${v.nombreActual}` : "sin nombre"}</span>
                        )}
                      </div>
                    ))
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}
