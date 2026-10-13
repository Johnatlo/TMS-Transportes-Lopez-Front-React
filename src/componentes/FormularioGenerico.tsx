/**
 * Formulario construido a partir de una descripcion de campos.
 *
 * Equivale a form-modal.component de Angular. Se conserva el enfoque para las
 * pantallas de catalogo, donde los formularios son listas planas de campos sin
 * dependencias entre si. Para el despacho NO se usa: alli los campos dependen
 * unos de otros y conviene escribirlos a mano.
 */

export interface OpcionCampo {
  value: string | number;
  label: string;
}

export interface CampoFormulario {
  key: string;
  label: string;
  /** "password": se escribe oculto y el navegador no lo autocompleta. */
  tipo: "text" | "number" | "date" | "select" | "checkbox" | "password";
  opciones?: OpcionCampo[];
  placeholder?: string;
  ayuda?: string;
}

export interface SeccionFormulario {
  titulo: string;
  descripcion?: string;
  campos: CampoFormulario[];
}

export type Modelo = Record<string, any>;

/**
 * Pinta un formulario por secciones (titulo y descripcion a la izquierda,
 * campos a la derecha) a partir de la lista de campos. Cada cambio entrega un
 * modelo NUEVO a alCambiar (nunca se muta el actual, para que React redibuje).
 */
export default function FormularioGenerico({
  secciones,
  modelo,
  alCambiar,
  camposRndc,
}: {
  secciones: SeccionFormulario[];
  modelo: Modelo;
  alCambiar: (modelo: Modelo) => void;
  /** Campos que se envian al RNDC al registrar: llevan la marca "RNDC". */
  camposRndc?: readonly string[];
}) {
  // Nunca se muta el modelo: se crea uno nuevo. Mutarlo no redibujaria nada.
  const fijar = (key: string, valor: unknown) => alCambiar({ ...modelo, [key]: valor });

  return (
    <>
      {secciones.map((seccion) => (
        <div className="form-section" key={seccion.titulo}>
          <div>
            <div className="section-title">{seccion.titulo}</div>
            {seccion.descripcion && <div className="section-desc">{seccion.descripcion}</div>}
          </div>
          <div>
            {seccion.campos.map((campo) => (
              <Campo
                key={campo.key}
                campo={campo}
                valor={modelo[campo.key]}
                alFijar={(v) => fijar(campo.key, v)}
                vaAlRndc={!!camposRndc?.includes(campo.key)}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

/**
 * Un campo segun su tipo: casilla, lista desplegable o caja de texto, numero o
 * fecha, con su ayuda debajo si la tiene.
 */
function Campo({
  campo,
  valor,
  alFijar,
  vaAlRndc = false,
}: {
  campo: CampoFormulario;
  valor: any;
  alFijar: (valor: unknown) => void;
  vaAlRndc?: boolean;
}) {
  const marca = vaAlRndc ? (
    <span className="marca-rndc" title="Se envia al RNDC al registrar">
      RNDC
    </span>
  ) : null;
  if (campo.tipo === "checkbox") {
    return (
      <>
        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
          <input
            type="checkbox"
            style={{ width: "auto" }}
            checked={!!valor}
            onChange={(e) => alFijar(e.target.checked)}
          />
          {campo.label}
          {marca}
        </label>
        {campo.ayuda && <p className="section-desc">{campo.ayuda}</p>}
      </>
    );
  }

  return (
    <>
      <label>
        {campo.label}
        {marca}
      </label>
      {campo.tipo === "select" ? (
        <select value={valor ?? ""} onChange={(e) => alFijar(e.target.value)}>
          <option value="" disabled>
            Selecciona...
          </option>
          {/* Un valor guardado que no esta entre las opciones (dato viejo o
              importado) se muestra tal cual. Sin esto el navegador ensena la
              primera opcion y parece que el registro ya tiene ese valor. */}
          {valor !== null &&
            valor !== undefined &&
            valor !== "" &&
            !campo.opciones?.some((o) => String(o.value) === String(valor)) && (
              <option value={valor} disabled>
                {valor} (no valido, elige otro)
              </option>
            )}
          {campo.opciones?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={campo.tipo}
          placeholder={campo.placeholder}
          autoComplete={campo.tipo === "password" ? "new-password" : undefined}
          value={valor ?? ""}
          onChange={(e) =>
            // Los numericos se guardan como number, pero el campo vacio queda
            // como null y no como 0: son cosas distintas.
            alFijar(
              campo.tipo === "number"
                ? e.target.value === ""
                  ? null
                  : Number(e.target.value)
                : e.target.value
            )
          }
        />
      )}
      {campo.ayuda && <p className="section-desc">{campo.ayuda}</p>}
    </>
  );
}
