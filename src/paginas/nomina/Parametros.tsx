/**
 * Parametros de nomina por ano: minimo, auxilio de transporte y todos los
 * porcentajes (empleado y empleador, ARL por nivel de riesgo). La nomina usa
 * los del ano en que termina el periodo. Solo el rol total los cambia.
 */
import { useState } from "react";
import { apiNomina, moneda } from "../../api/cliente";
import type { ParametrosNomina } from "../../api/cliente";
import Modal from "../../componentes/Modal";

/** Campos editables (porcentajes en %). */
const CAMPOS: Array<[keyof ParametrosNomina, string, boolean?]> = [
  ["smmlv", "Salario minimo (SMMLV)", true],
  ["auxilioTransporte", "Auxilio de transporte", true],
  ["pensionEmpleador", "Pension empleador %"],
  ["saludEmpleador", "Salud empleador % (0 = exonerado)"],
  ["caja", "Caja de compensacion %"],
  ["prima", "Prima %"],
  ["cesantias", "Cesantias %"],
  ["interesesCesantias", "Intereses de cesantias % (sobre cesantias)"],
  ["vacaciones", "Vacaciones %"],
  ["saludEmpleado", "Salud empleado %"],
  ["pensionEmpleado", "Pension empleado %"],
  ["limiteNoSalarial", "Limite no salarial % (Ley 1393)"],
];
const RIESGOS = ["I", "II", "III", "IV", "V"];

/** Tabla de parametros por ano. */
export default function Parametros({ parametros, editable, alCambiar }: { parametros: ParametrosNomina[]; editable: boolean; alCambiar: () => void }) {
  const [editando, setEditando] = useState<ParametrosNomina | null>(null);
  const nuevoAnio = () => {
    const base = parametros[0];
    const anio = (base?.anio ?? new Date().getFullYear()) + 1;
    setEditando(
      base
        ? { ...base, anio }
        : {
            anio,
            smmlv: 0,
            auxilioTransporte: 0,
            pensionEmpleador: 12,
            saludEmpleador: 0,
            arl: [0.522, 1.044, 2.436, 4.35, 6.96],
            caja: 4,
            prima: 8.33,
            cesantias: 8.33,
            interesesCesantias: 12,
            vacaciones: 4.17,
            saludEmpleado: 4,
            pensionEmpleado: 4,
            limiteNoSalarial: 40,
          },
    );
  };
  const pct = (v: number) => `${v.toLocaleString("es-CO", { maximumFractionDigits: 3 })} %`;

  return (
    <div className="panel">
      <div className="barra-envio" style={{ padding: "0.6rem 0.8rem" }}>
        <span className="section-desc">La nomina usa los parametros del ano en que termina el periodo.</span>
        {editable && (
          <button className="btn-primary boton-con-texto" style={{ marginLeft: "auto" }} onClick={nuevoAnio}>
            Agregar ano
          </button>
        )}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="tabla tabla-compacta">
          <thead>
            <tr>
              <th>Ano</th>
              <th className="num">Minimo</th>
              <th className="num">Auxilio</th>
              <th className="num">Pension</th>
              <th className="num">Salud</th>
              <th className="num">ARL I / IV</th>
              <th className="num">Caja</th>
              <th className="num">Prima</th>
              <th className="num">Cesantias</th>
              <th className="num">Int. ces.</th>
              <th className="num">Vacaciones</th>
              <th className="num">Empleado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {parametros.map((p) => (
              <tr key={p.anio}>
                <td>
                  <strong>{p.anio}</strong>
                </td>
                <td className="num">{moneda(p.smmlv)}</td>
                <td className="num">{moneda(p.auxilioTransporte)}</td>
                <td className="num">{pct(p.pensionEmpleador)}</td>
                <td className="num">{pct(p.saludEmpleador)}</td>
                <td className="num">
                  {pct(p.arl[0])} / {pct(p.arl[3])}
                </td>
                <td className="num">{pct(p.caja)}</td>
                <td className="num">{pct(p.prima)}</td>
                <td className="num">{pct(p.cesantias)}</td>
                <td className="num">{pct(p.interesesCesantias)}</td>
                <td className="num">{pct(p.vacaciones)}</td>
                <td className="num">
                  {pct(p.saludEmpleado)} + {pct(p.pensionEmpleado)}
                </td>
                <td className="num">
                  {editable && (
                    <button className="btn-link" onClick={() => setEditando(p)}>
                      Editar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editando && (
        <FormularioParametros
          inicial={editando}
          alCerrar={() => setEditando(null)}
          alGuardar={() => {
            setEditando(null);
            alCambiar();
          }}
        />
      )}
    </div>
  );
}

/** Formulario de los parametros de un ano. */
function FormularioParametros({ inicial, alCerrar, alGuardar }: { inicial: ParametrosNomina; alCerrar: () => void; alGuardar: () => void }) {
  const [p, setP] = useState(inicial);
  const [error, setError] = useState<string | null>(null);
  async function guardar() {
    setError(null);
    try {
      await apiNomina.guardarParametros(p);
      alGuardar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
    }
  }
  return (
    <Modal
      titulo={`Parametros de nomina ${p.anio}`}
      ancho="wide"
      alCerrar={alCerrar}
      pie={
        <>
          <button className="btn-secondary" onClick={alCerrar}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={guardar}>
            Guardar
          </button>
        </>
      }
    >
      {error && <div className="alert danger">{error}</div>}
      <div className="campos-cuadro">
        <div>
          <label>Ano</label>
          <input type="number" value={p.anio} onChange={(e) => setP({ ...p, anio: Number(e.target.value) })} />
        </div>
        {CAMPOS.map(([campo, etiqueta]) => (
          <div key={campo}>
            <label>{etiqueta}</label>
            <input type="number" step="any" min={0} value={p[campo] as number} onChange={(e) => setP({ ...p, [campo]: Number(e.target.value) })} />
          </div>
        ))}
        {RIESGOS.map((r, i) => (
          <div key={r}>
            <label>ARL riesgo {r} %</label>
            <input
              type="number"
              step="any"
              min={0}
              value={p.arl[i]}
              onChange={(e) => setP({ ...p, arl: p.arl.map((x, j) => (j === i ? Number(e.target.value) : x)) as ParametrosNomina["arl"] })}
            />
          </div>
        ))}
      </div>
    </Modal>
  );
}
