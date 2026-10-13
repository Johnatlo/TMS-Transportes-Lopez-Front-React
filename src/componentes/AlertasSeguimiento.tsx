/**
 * Ventana de alertas de seguimiento (boton del reloj en la barra superior):
 * papeles que hay que perseguir despues del descargue, viajes por facturar y
 * facturas por cobrar. Clic en una alerta lleva a su pantalla con ese viaje o
 * esa factura abiertos.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AlertaSeguimiento, ResumenAlertasSeguimiento, TipoAlerta } from "../api/cliente";
import Modal from "./Modal";
import { Pastilla } from "./TablaDatos";

const GRUPOS: Array<{ tipo: TipoAlerta; etiqueta: string; vacio: string }> = [
  { tipo: "PAPELES", etiqueta: "Papeles", vacio: "Ningun papel pendiente de seguimiento hoy." },
  { tipo: "FACTURACION", etiqueta: "Por facturar", vacio: "Nada pendiente de facturar." },
  { tipo: "CARTERA", etiqueta: "Cartera", vacio: "Ninguna factura vencida ni por vencer." },
];

/** Ruta de la pantalla que resuelve la alerta, con el viaje o la factura a abrir. */
function rutaDe(a: AlertaSeguimiento): string {
  if (a.tipo === "CARTERA") {
    return `/cartera?factura=${encodeURIComponent(a.facturaNumero ?? "")}&empresa=${encodeURIComponent(a.empresa ?? "")}`;
  }
  return `/papeles?viaje=${a.cuadroId}`;
}

/** Lista de alertas por grupo; abre en el primer grupo que tenga algo. */
export default function AlertasSeguimiento({ resumen, alCerrar }: { resumen: ResumenAlertasSeguimiento; alCerrar: () => void }) {
  const navegar = useNavigate();
  const cuantas = (t: TipoAlerta) => resumen.alertas.filter((a) => a.tipo === t).length;
  const [grupo, setGrupo] = useState<TipoAlerta>(GRUPOS.find((g) => cuantas(g.tipo) > 0)?.tipo ?? "PAPELES");
  const lista = resumen.alertas.filter((a) => a.tipo === grupo);

  return (
    <Modal titulo="Seguimiento: papeles, facturacion y cartera" ancho="wide" alCerrar={alCerrar}>
      <div className="tabla-pestanas selector-vista">
        {GRUPOS.map((g) => (
          <button key={g.tipo} className={grupo === g.tipo ? "activa" : ""} onClick={() => setGrupo(g.tipo)}>
            {g.etiqueta} ({cuantas(g.tipo)})
          </button>
        ))}
      </div>
      {lista.length === 0 ? (
        <div className="dato-sec">{GRUPOS.find((g) => g.tipo === grupo)!.vacio}</div>
      ) : (
        <ul className="lista-notas">
          {lista.map((a, i) => (
            <li
              key={`${a.tipo}-${a.cuadroId ?? a.facturaNumero}-${i}`}
              className="fila-clic"
              onClick={() => {
                alCerrar();
                navegar(rutaDe(a));
              }}
            >
              <Pastilla tono={a.nivel === "urgente" ? "error" : "aviso"}>{a.nivel === "urgente" ? "Urgente" : "Atencion"}</Pastilla>{" "}
              <strong>{a.titulo}</strong>
              {a.motivos.map((m) => (
                <span key={m} className="dato-sec" style={{ display: "block" }}>
                  {m}
                </span>
              ))}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
