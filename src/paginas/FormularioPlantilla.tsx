import { useState } from "react";
import { api } from "../api/cliente";
import { useDatos } from "../ganchos/useDatos";
import Modal from "../componentes/Modal";

const PASOS = ["Identificacion", "Partes", "Mercancia", "Tiempos", "Manifiesto"];

const TIPOS_MANIFIESTO = [
  { value: "G", label: "General" },
  { value: "I", label: "Ida y regreso (mismo origen y destino)" },
  { value: "M", label: "Multiparada (varias remesas en la ruta)" },
  { value: "U", label: "Municipal o urbano" },
  { value: "D", label: "Varios viajes en el dia" },
  { value: "W", label: "Viaje en vacio (sin remesa)" },
];

const UNIDADES_PRODUCTO = [
  { value: "KGM", label: "Kilogramos" },
  { value: "UN", label: "Unidades" },
  { value: "GLL", label: "Galones" },
  { value: "LTR", label: "Litros" },
  { value: "MTQ", label: "Metros cubicos" },
  { value: "CMQ", label: "Centimetros cubicos" },
  { value: "MLT", label: "Mililitros" },
  { value: "BLL", label: "Barriles" },
];

export default function FormularioPlantilla({
  alCerrar,
  alGuardar,
}: {
  alCerrar: () => void;
  alGuardar: () => void;
}) {
  const terceros = useDatos(() => api.getTerceros(), []);
  const [paso, setPaso] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Paso 0
  const [nombre, setNombre] = useState("");
  // Paso 1
  const [contratanteId, setContratanteId] = useState<number | null>(null);
  const [remitenteId, setRemitenteId] = useState<number | null>(null);
  const [destinatarioId, setDestinatarioId] = useState<number | null>(null);
  // Paso 2
  const [tipoMercancia, setTipoMercancia] = useState("");
  const [codMercancia, setCodMercancia] = useState("");
  const [subpartidaCode, setSubpartidaCode] = useState("");
  const [codigoArancelCode, setCodigoArancelCode] = useState("");
  const [unidadMedidaProducto, setUnidadMedidaProducto] = useState("KGM");
  const [codTipoEmpaque, setCodTipoEmpaque] = useState("0");
  const [empaquePrimario, setEmpaquePrimario] = useState("");
  const [valorFleteBase, setValorFleteBase] = useState<number | null>(null);
  // Paso 3
  const [horasPactoCargue, setHorasPactoCargue] = useState(2);
  const [minutosPactoCargue, setMinutosPactoCargue] = useState(0);
  const [horasPactoDescargue, setHorasPactoDescargue] = useState(2);
  const [minutosPactoDescargue, setMinutosPactoDescargue] = useState(0);
  // Paso 4
  const [tipoManifiesto, setTipoManifiesto] = useState("G");
  const [codMunicipioIntermedio, setCodMunicipioIntermedio] = useState("");
  const [factorIcaCargue, setFactorIcaCargue] = useState(0);
  const [tarifaPct, setTarifaPct] = useState(1);
  const [titularEsRegimenSimple, setTitularEsRegimenSimple] = useState(false);
  const [codResponsablePagoCargue, setCodResponsablePagoCargue] = useState("R");
  const [codResponsablePagoDescargue, setCodResponsablePagoDescargue] = useState("D");
  const [aceptacionElectronica, setAceptacionElectronica] = useState("NO");
  const [codMunicipioPagoSaldo, setCodMunicipioPagoSaldo] = useState("");

  /** El municipio de retorno solo lo exige el manifiesto de ida y regreso. */
  const pideMunicipioIntermedio = tipoManifiesto === "I";

  /**
   * Multiparada e ida y regreso exigen mas de una remesa, y el despacho arma
   * una por carga. Se avisa aqui en vez de dejar que falle la primera noche.
   */
  const avisaVariasRemesas = tipoManifiesto === "M" || tipoManifiesto === "I";

  function validar(): string | null {
    if (!nombre.trim()) return "Ponle un nombre a la plantilla.";
    if (!contratanteId || !remitenteId || !destinatarioId)
      return "Completa las partes involucradas.";

    const codigo = codMercancia.replace(/\D/g, "");
    if (codigo.length !== 4 && codigo.length !== 6)
      return "El codigo de mercancia debe tener 4 digitos (capitulo + partida) o 6 con los ceros a la izquierda.";
    if (!tipoMercancia.trim()) return "Escribe la descripcion del producto.";

    for (const [etiqueta, valor] of [
      ["subpartida", subpartidaCode],
      ["codigo de arancel", codigoArancelCode],
    ] as const) {
      if (valor && !/^\d{2}$/.test(valor))
        return `El ${etiqueta} debe tener exactamente 2 digitos.`;
    }

    if (pideMunicipioIntermedio && !codMunicipioIntermedio)
      return "Un manifiesto de ida y regreso necesita el municipio intermedio (de retorno).";

    if (!titularEsRegimenSimple && tarifaPct <= 0)
      return "La retencion en la fuente solo puede ser cero si el titular esta en Regimen Simple.";

    return null;
  }

  async function guardar() {
    const problema = validar();
    if (problema) {
      setError(problema);
      return;
    }
    setGuardando(true);
    setError(null);

    const codigo = codMercancia.replace(/\D/g, "");
    try {
      await api.crearPlantilla({
        nombre,
        contratanteId: contratanteId!,
        remitenteId: remitenteId!,
        destinatarioId: destinatarioId!,
        tipoMercancia: tipoMercancia.slice(0, 60),
        codMercancia: codigo.length === 4 ? `00${codigo}` : codigo,
        subpartidaCode: subpartidaCode || null,
        codigoArancelCode: codigoArancelCode || null,
        unidadMedidaProducto,
        codTipoEmpaque,
        empaquePrimario: empaquePrimario || null,
        valorFleteBase,
        // Esta empresa solo mueve carga general.
        tipoOperacionRemesa: "G",
        codNaturalezaCarga: "1",
        codUnidadMedida: "1",
        tipoManifiesto,
        codMunicipioIntermedio: pideMunicipioIntermedio ? codMunicipioIntermedio : null,
        horasPactoCargue,
        minutosPactoCargue,
        horasPactoDescargue,
        minutosPactoDescargue,
        factorIcaCargue,
        tarifaRetencionFuente: tarifaPct / 100,
        titularEsRegimenSimple,
        codResponsablePagoCargue,
        codResponsablePagoDescargue,
        aceptacionElectronica,
        codMunicipioPagoSaldo: codMunicipioPagoSaldo || null,
      } as any);
      alGuardar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar la plantilla.");
    } finally {
      setGuardando(false);
    }
  }

  const opcionesTerceros = terceros.datos ?? [];
  const puedeAvanzar =
    paso === 0 ? !!nombre.trim() : paso === 1 ? !!(contratanteId && remitenteId && destinatarioId) : true;

  return (
    <Modal
      titulo="Nueva plantilla de viaje"
      ancho="wide"
      pasos={PASOS}
      pasoActual={paso}
      alCerrar={alCerrar}
      pie={
        <>
          {paso > 0 && (
            <button className="btn-secondary" onClick={() => setPaso(paso - 1)}>
              Atras
            </button>
          )}
          {paso < PASOS.length - 1 ? (
            <button
              className="btn-primary"
              onClick={() => setPaso(paso + 1)}
              disabled={!puedeAvanzar}
            >
              Siguiente
            </button>
          ) : (
            <button className="btn-primary" onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar plantilla"}
            </button>
          )}
        </>
      }
    >
      {error && <div className="alert danger">{error}</div>}

      {/* ---------- PASO 0 ---------- */}
      {paso === 0 && (
        <div className="form-section">
          <div>
            <div className="section-title">Identificacion</div>
            <div className="section-desc">Nombre con el que vas a reconocer esta plantilla.</div>
          </div>
          <div>
            <label>Nombre de la plantilla</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Cliente X - Bogota a Medellin"
            />
            <p className="section-desc">
              El origen y el destino del manifiesto no se configuran aqui: se deducen de los
              municipios del sitio de cargue y del sitio de descargue que elijas en el siguiente
              paso. Asi siempre coinciden, que es lo que exige el RNDC.
            </p>
          </div>
        </div>
      )}

      {/* ---------- PASO 1 ---------- */}
      {paso === 1 && (
        <div className="form-section">
          <div>
            <div className="section-title">Partes involucradas</div>
            <div className="section-desc">Quien contrata, quien remite y quien recibe la carga.</div>
          </div>
          <div>
            <SelectorTercero
              etiqueta="Contratante (generador de carga)"
              valor={contratanteId}
              alCambiar={setContratanteId}
              opciones={opcionesTerceros}
            />
            <SelectorTercero
              etiqueta="Remitente (sitio de cargue)"
              valor={remitenteId}
              alCambiar={setRemitenteId}
              opciones={opcionesTerceros}
            />
            <SelectorTercero
              etiqueta="Destinatario (sitio de descargue)"
              valor={destinatarioId}
              alCambiar={setDestinatarioId}
              opciones={opcionesTerceros}
            />
            <p className="section-desc">
              El municipio del remitente sera el origen del manifiesto y el del destinatario el
              destino. Si a alguno le falta el codigo de municipio, el despacho se detiene.
            </p>
          </div>
        </div>
      )}

      {/* ---------- PASO 2 ---------- */}
      {paso === 2 && (
        <div className="form-section">
          <div>
            <div className="section-title">Mercancia</div>
            <div className="section-desc">
              El codigo sale de la codificacion armonizada. Lo puedes consultar en el portal del
              RNDC, en "Consultar Maestros" → "Codificacion de Productos".
            </div>
          </div>
          <div>
            <label>Descripcion del producto</label>
            <input
              value={tipoMercancia}
              maxLength={60}
              onChange={(e) => setTipoMercancia(e.target.value)}
              placeholder="Papel y carton para reciclaje"
            />
            <p className="section-desc">Maximo 60 caracteres.</p>

            <label>Codigo de mercancia (capitulo + partida)</label>
            <input
              value={codMercancia}
              onChange={(e) => setCodMercancia(e.target.value)}
              placeholder="4707"
            />
            <p className="section-desc">
              4 digitos. Si escribes solo esos, se guardan como 004707.
            </p>

            <label>Subpartida (opcional, 2 digitos)</label>
            <input value={subpartidaCode} onChange={(e) => setSubpartidaCode(e.target.value)} />

            <label>Codigo de arancel (opcional, 2 digitos)</label>
            <input
              value={codigoArancelCode}
              onChange={(e) => setCodigoArancelCode(e.target.value)}
            />
            <p className="section-desc">
              Estos dos solo los exige el RNDC para ciertas partidas. Dejalos vacios: si hacen
              falta, el sistema te lo dira con el codigo exacto al primer despacho.
            </p>

            <label>Unidad comercial del producto</label>
            <select
              value={unidadMedidaProducto}
              onChange={(e) => setUnidadMedidaProducto(e.target.value)}
            >
              {UNIDADES_PRODUCTO.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
            <p className="section-desc">
              La unidad en la que el cliente factura. El peso en kilos siempre se pide aparte, en
              cada despacho.
            </p>

            <label>Cod. tipo de empaque</label>
            <input value={codTipoEmpaque} onChange={(e) => setCodTipoEmpaque(e.target.value)} />

            <label>Empaque primario (opcional)</label>
            <input value={empaquePrimario} onChange={(e) => setEmpaquePrimario(e.target.value)} />

            <label>Valor flete base</label>
            <input
              type="number"
              value={valorFleteBase ?? ""}
              onChange={(e) =>
                setValorFleteBase(e.target.value === "" ? null : Number(e.target.value))
              }
            />
            <p className="section-desc">
              Tarifa pactada para esta ruta. En el despacho se precarga y se puede ajustar. Cuando
              cambie SICETAC no hay que venir aqui: se actualiza la ruta completa desde Plantillas
              → Actualizar tarifas.
            </p>
          </div>
        </div>
      )}

      {/* ---------- PASO 3 ---------- */}
      {paso === 3 && (
        <div className="form-section">
          <div>
            <div className="section-title">Tiempos pactados</div>
            <div className="section-desc">
              Cuanto se demora el vehiculo en cargar y en descargar, incluyendo la espera. Entran
              en el piso tarifario de SICETAC.
            </div>
          </div>
          <div>
            <label>Horas pacto cargue</label>
            <input
              type="number"
              value={horasPactoCargue}
              onChange={(e) => setHorasPactoCargue(Number(e.target.value))}
            />
            <label>Minutos pacto cargue</label>
            <input
              type="number"
              value={minutosPactoCargue}
              onChange={(e) => setMinutosPactoCargue(Number(e.target.value))}
            />
            <label>Horas pacto descargue</label>
            <input
              type="number"
              value={horasPactoDescargue}
              onChange={(e) => setHorasPactoDescargue(Number(e.target.value))}
            />
            <label>Minutos pacto descargue</label>
            <input
              type="number"
              value={minutosPactoDescargue}
              onChange={(e) => setMinutosPactoDescargue(Number(e.target.value))}
            />
          </div>
        </div>
      )}

      {/* ---------- PASO 4 ---------- */}
      {paso === 4 && (
        <div className="form-section">
          <div>
            <div className="section-title">Condiciones del manifiesto</div>
            <div className="section-desc">
              Tipo de viaje y terminos comerciales pactados con este cliente.
            </div>
          </div>
          <div>
            <label>Tipo de manifiesto</label>
            <select value={tipoManifiesto} onChange={(e) => setTipoManifiesto(e.target.value)}>
              {TIPOS_MANIFIESTO.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>

            {avisaVariasRemesas && (
              <div className="alert warning" style={{ marginTop: "0.6rem" }}>
                Este tipo de manifiesto exige mas de una remesa. La plantilla se guarda, pero al
                despachar hay que agregar varias cargas o el RNDC lo rechaza.
              </div>
            )}

            {pideMunicipioIntermedio && (
              <>
                <label>Cod. municipio intermedio (donde el vehiculo se devuelve)</label>
                <input
                  value={codMunicipioIntermedio}
                  onChange={(e) => setCodMunicipioIntermedio(e.target.value)}
                  placeholder="11001000"
                />
              </>
            )}

            <label>Retencion ICA del municipio de cargue (por mil)</label>
            <input
              type="number"
              step="0.01"
              value={factorIcaCargue}
              onChange={(e) => setFactorIcaCargue(Number(e.target.value))}
            />
            <p className="section-desc">
              Es el factor, no el valor en pesos: si el municipio donde carga esta mercancia
              retiene 9,66 por mil, escribe 9.66. Cuando un manifiesto agrupa cargas de municipios
              distintos, el sistema calcula el promedio ponderado.
            </p>

            <label>Retencion en la fuente (%)</label>
            <input
              type="number"
              step="0.1"
              value={tarifaPct}
              disabled={titularEsRegimenSimple}
              onChange={(e) => setTarifaPct(Number(e.target.value))}
            />
            <label
              style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", marginTop: "0.4rem" }}
            >
              <input
                type="checkbox"
                style={{ width: "auto" }}
                checked={titularEsRegimenSimple}
                onChange={(e) => setTitularEsRegimenSimple(e.target.checked)}
              />
              El titular del manifiesto esta en Regimen Simple de Tributacion
            </label>
            <p className="section-desc">
              El RNDC solo acepta retencion en cero si el titular esta en Regimen Simple. En
              cualquier otro caso exige un valor mayor a cero.
            </p>

            <label>Responsable de pagar el cargue</label>
            <select
              value={codResponsablePagoCargue}
              onChange={(e) => setCodResponsablePagoCargue(e.target.value)}
            >
              <option value="R">Remitente</option>
              <option value="D">Destinatario</option>
            </select>

            <label>Responsable de pagar el descargue</label>
            <select
              value={codResponsablePagoDescargue}
              onChange={(e) => setCodResponsablePagoDescargue(e.target.value)}
            >
              <option value="R">Remitente</option>
              <option value="D">Destinatario</option>
            </select>

            <label>Aceptacion electronica del manifiesto</label>
            <select
              value={aceptacionElectronica}
              onChange={(e) => setAceptacionElectronica(e.target.value)}
            >
              <option value="NO">No (se firma en fisico)</option>
              <option value="SI">Si (firma en la app del RNDC transportador)</option>
            </select>

            <label>Cod. municipio pago de saldo (vacio = municipio destino)</label>
            <input
              value={codMunicipioPagoSaldo}
              onChange={(e) => setCodMunicipioPagoSaldo(e.target.value)}
            />

            <p className="section-desc" style={{ marginTop: "0.9rem" }}>
              La poliza de carga no se pide aqui: es la misma para toda la empresa y se configura
              una sola vez en Catalogo → Empresa.
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}

function SelectorTercero({
  etiqueta,
  valor,
  alCambiar,
  opciones,
}: {
  etiqueta: string;
  valor: number | null;
  alCambiar: (id: number) => void;
  opciones: Array<{ id: number; nombre: string; codSede: string; ciudad: string | null }>;
}) {
  return (
    <>
      <label>{etiqueta}</label>
      <select
        value={valor ?? ""}
        onChange={(e) => alCambiar(Number(e.target.value))}
      >
        <option value="" disabled>
          Selecciona...
        </option>
        {opciones.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nombre} — sede {t.codSede}
            {t.ciudad ? ` (${t.ciudad})` : ""}
          </option>
        ))}
      </select>
    </>
  );
}
