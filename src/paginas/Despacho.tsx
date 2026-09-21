import { useEffect, useMemo, useRef, useState } from "react";
import { api, moneda } from "../api/cliente";
import { useDatos } from "../ganchos/useDatos";
import { Avisos, Cargando } from "../componentes/Estado";
import Modal from "../componentes/Modal";
import type { PlantillaViaje, Via } from "../api/tipos";

/** Tope del RNDC para este sistema. */
const MAX_REMESAS = 5;

const PASOS = ["Vehiculo y conductor", "Cargas", "Valores"];

/** Una carga del viaje: un cliente o una parada. */
interface FilaRemesa {
  plantillaId: number | null;
  fechaHoraCargue: string;
  fechaHoraDescargue: string;
  pesoReal: number | null;
  cantidadReal: number | null;
  ordenServicioGenerador: string;
  valorFleteRemesa: number | null;
  /**
   * Si el usuario ya toco el descargue, deja de seguir al cargue. Sin esto,
   * corregir la hora del cargue le borraria un descargue puesto a mano.
   */
  descargueEditado: boolean;
}

/**
 * Formato que entiende <input type="datetime-local">: YYYY-MM-DDTHH:mm.
 * Se arma con los componentes locales y no con toISOString(), que convierte a
 * UTC y en Colombia adelantaria el reloj cinco horas.
 */
function aInputLocal(fecha: Date): string {
  const dos = (n: number) => String(n).padStart(2, "0");
  return (
    `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}` +
    `T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`
  );
}

/** Hoy, a la siguiente hora en punto. Es la cita de cargue mas frecuente. */
function proximaHoraEnPunto(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

function filaVacia(): FilaRemesa {
  const cargue = proximaHoraEnPunto();
  const descargue = new Date(cargue);
  descargue.setDate(descargue.getDate() + 1);
  return {
    plantillaId: null,
    fechaHoraCargue: aInputLocal(cargue),
    fechaHoraDescargue: aInputLocal(descargue),
    pesoReal: null,
    cantidadReal: null,
    ordenServicioGenerador: "",
    valorFleteRemesa: null,
    descargueEditado: false,
  };
}

export default function Despacho({ alCerrar }: { alCerrar?: () => void } = {}) {
  const plantillas = useDatos(() => api.getPlantillas(), []);
  const vehiculos = useDatos(() => api.getVehiculos(), []);
  const conductores = useDatos(() => api.getConductores(), []);
  const remolques = useDatos(() => api.getRemolques(), []);

  const [paso, setPaso] = useState(0);

  const [vehiculoId, setVehiculoId] = useState<number | null>(null);
  const [conductorId, setConductorId] = useState<number | null>(null);
  const [conductor2Id, setConductor2Id] = useState<number | null>(null);
  const [remolqueId, setRemolqueId] = useState<number | null>(null);

  const [remesas, setRemesas] = useState<FilaRemesa[]>([filaVacia()]);

  const [valorFleteReal, setValorFleteReal] = useState<number | null>(null);
  const [fleteEditado, setFleteEditado] = useState(false);
  const [retencionFopat, setRetencionFopat] = useState<number | null>(null);
  const [fopatEditado, setFopatEditado] = useState(false);
  const [valorAnticipo, setValorAnticipo] = useState<number | null>(null);
  const [fechaPagoSaldo, setFechaPagoSaldo] = useState("");
  const [viajesDia, setViajesDia] = useState<number | null>(null);

  const [codVia, setCodVia] = useState<string | null>(null);
  const [vias, setVias] = useState<Via[]>([]);
  const [cargandoVias, setCargandoVias] = useState(false);
  const [periodoSicetac, setPeriodoSicetac] = useState<string | null>(null);
  const [viasDesdeCache, setViasDesdeCache] = useState(false);

  const [mostrarVacios, setMostrarVacios] = useState(false);
  const [vacio1Origen, setVacio1Origen] = useState("");
  const [vacio1Destino, setVacio1Destino] = useState("");
  const [vacio1Valor, setVacio1Valor] = useState<number | null>(null);
  const [vacio2Origen, setVacio2Origen] = useState("");
  const [vacio2Destino, setVacio2Destino] = useState("");
  const [vacio2Valor, setVacio2Valor] = useState<number | null>(null);

  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "success" | "danger"; texto: string } | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);

  const listaPlantillas = plantillas.datos ?? [];
  const listaVehiculos = (vehiculos.datos ?? []).filter((v) => v.activo);
  const listaConductores = (conductores.datos ?? []).filter((c) => c.activo);
  const listaRemolques = (remolques.datos ?? []).filter((r) => r.activo);

  const plantillaDe = (fila: FilaRemesa): PlantillaViaje | null =>
    listaPlantillas.find((p) => p.id === fila.plantillaId) ?? null;

  /** La primera carga define la ruta y los terminos del manifiesto. */
  const plantillaPrincipal = plantillaDe(remesas[0]);
  const esMultiparada = remesas.length > 1;

  /** Origen y destino efectivos: los municipios de cargue y descargue. */
  const municipioOrigen = plantillaPrincipal?.remitente?.codMunicipioRndc ?? null;
  const municipioDestino =
    plantillaDe(remesas[remesas.length - 1])?.destinatario?.codMunicipioRndc ?? null;

  const configuracion = listaVehiculos.find((v) => v.id === vehiculoId)?.configuracion ?? null;

  /** Horas pactadas de cargue y descargue, que entran en el piso de SICETAC. */
  const horasPactadas = plantillaPrincipal
    ? plantillaPrincipal.horasPactoCargue +
      plantillaPrincipal.minutosPactoCargue / 60 +
      plantillaPrincipal.horasPactoDescargue +
      plantillaPrincipal.minutosPactoDescargue / 60
    : 0;

  // -------------------------------------------------------------------------
  // Cadena de dependencias
  //
  // En Angular esto eran metodos alCambiarX(). Aqui son efectos: cuando cambia
  // el par origen-destino o la configuracion del vehiculo, se vuelven a
  // consultar las vias a SICETAC.
  // -------------------------------------------------------------------------
  useEffect(() => {
    setVias([]);
    setCodVia(null);
    setPeriodoSicetac(null);
    setViasDesdeCache(false);
    if (!municipioOrigen || !municipioDestino || !configuracion) return;

    let cancelado = false;
    setCargandoVias(true);

    api
      .getViasSicetac(municipioOrigen, municipioDestino, configuracion, horasPactadas)
      .then((r) => {
        if (cancelado) return;
        setVias(r.vias ?? []);
        setPeriodoSicetac(r.periodoUsado ?? null);
        setViasDesdeCache(!!r.desdeCache);
        // La estandar se preselecciona: es la que el RNDC usaria de todos modos
        // si no se manda CODVIA.
        const estandar = (r.vias ?? []).find((v) => v.esEstandar);
        if (estandar) setCodVia(estandar.codVia);
      })
      .catch((exc: any) => {
        if (cancelado) return;
        setVias(exc?.cuerpo?.vias ?? []);
        setViasDesdeCache(true);
      })
      .finally(() => {
        if (!cancelado) setCargandoVias(false);
      });

    return () => {
      cancelado = true;
    };
  }, [municipioOrigen, municipioDestino, configuracion, horasPactadas]);

  const viaSeleccionada = vias.find((v) => v.codVia === codVia) ?? null;

  // Al elegir la plantilla de la primera carga se trae su tarifa, salvo que ya
  // se haya escrito un valor a mano.
  const plantillaPrincipalId = remesas[0]?.plantillaId ?? null;
  useEffect(() => {
    if (fleteEditado) return;
    const base = listaPlantillas.find((p) => p.id === plantillaPrincipalId)?.valorFleteBase;
    if (base) setValorFleteReal(base);
    // listaPlantillas no va como dependencia a proposito: solo interesa
    // reaccionar al cambio de plantilla, no a que termine de cargar la lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantillaPrincipalId, fleteEditado]);

  // Si la via trae su minimo de SICETAC, se precarga como flete cuando aun no
  // hay uno escrito: es el piso por debajo del cual el RNDC rechaza.
  useEffect(() => {
    if (fleteEditado || valorFleteReal) return;
    if (viaSeleccionada?.valorSicetac) setValorFleteReal(viaSeleccionada.valorSicetac);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viaSeleccionada?.codVia]);

  const fleteEfectivo = valorFleteReal ?? plantillaPrincipal?.valorFleteBase ?? 0;
  const fopatCalculado = Math.round(fleteEfectivo * 0.001);

  // El FOPAT sigue al flete mientras no se haya ajustado a mano.
  // Este efecto NO puede depender de retencionFopat o entraria en bucle.
  const fopatEditadoRef = useRef(fopatEditado);
  fopatEditadoRef.current = fopatEditado;
  useEffect(() => {
    if (fopatEditadoRef.current) return;
    setRetencionFopat(Math.round(fleteEfectivo * 0.001));
  }, [fleteEfectivo]);

  // -------------------------------------------------------------------------
  // Manipulacion de las cargas
  // -------------------------------------------------------------------------

  /** Reemplaza una fila: nunca se muta el arreglo, o React no redibuja. */
  function actualizarFila(indice: number, cambios: Partial<FilaRemesa>) {
    setRemesas(remesas.map((r, i) => (i === indice ? { ...r, ...cambios } : r)));
  }

  function alCambiarCargue(indice: number, valor: string) {
    const fila = remesas[indice];
    const cambios: Partial<FilaRemesa> = { fechaHoraCargue: valor };
    // El descargue sigue al cargue conservando la duracion, salvo que ya se
    // haya ajustado a mano.
    if (!fila.descargueEditado && valor) {
      const cargue = new Date(valor);
      if (!isNaN(cargue.getTime())) {
        const descargue = new Date(cargue);
        descargue.setDate(descargue.getDate() + 1);
        cambios.fechaHoraDescargue = aInputLocal(descargue);
      }
    }
    actualizarFila(indice, cambios);
  }

  function agregarRemesa() {
    if (remesas.length >= MAX_REMESAS) return;
    const ultima = remesas[remesas.length - 1];
    setRemesas([
      ...remesas,
      {
        ...filaVacia(),
        // Las paradas suelen ser el mismo dia: se arrastran las fechas.
        fechaHoraCargue: ultima.fechaHoraCargue,
        fechaHoraDescargue: ultima.fechaHoraDescargue,
        descargueEditado: ultima.descargueEditado,
      },
    ]);
  }

  function quitarRemesa(indice: number) {
    if (remesas.length <= 1) return;
    setRemesas(remesas.filter((_, i) => i !== indice));
  }

  // -------------------------------------------------------------------------
  // Avisos calculados
  // -------------------------------------------------------------------------

  const pesoTotal = remesas.reduce((t, r) => t + (r.pesoReal ?? 0), 0);
  const pideViajesDia = plantillaPrincipal?.tipoManifiesto === "D";

  const avisoTipoManifiesto = useMemo(() => {
    const tipo = plantillaPrincipal?.tipoManifiesto;
    if (!tipo) return null;
    if (esMultiparada && tipo === "G")
      return "Este viaje lleva varias cargas pero la plantilla es de tipo General. Si el vehiculo hace paradas intermedias, el tipo correcto es Multiparada.";
    if (!esMultiparada && tipo === "M")
      return "La plantilla es Multiparada, que exige mas de una carga. Agrega otra o usa una plantilla de tipo General.";
    return null;
  }, [plantillaPrincipal?.tipoManifiesto, esMultiparada]);

  const avisoFopat = useMemo(() => {
    if (retencionFopat === null) return null;
    if (retencionFopat === fopatCalculado) return null;
    if (retencionFopat === 0)
      return "FOPAT en cero: solo es correcto si el vehiculo no supera las 10,5 toneladas.";
    return `El RNDC exige exactamente ${moneda(fopatCalculado)} (0,1% del flete). Con otro valor rechaza el manifiesto.`;
  }, [retencionFopat, fopatCalculado]);

  const avisoPisoSicetac = useMemo(() => {
    if (!viaSeleccionada?.valorSicetac) return null;
    if (fleteEfectivo >= viaSeleccionada.valorSicetac) return null;
    return `El flete esta por debajo del minimo de SICETAC para esta via (${moneda(viaSeleccionada.valorSicetac)}). El RNDC rechaza manifiestos por debajo del piso.`;
  }, [viaSeleccionada, fleteEfectivo]);

  function pideCantidadComercial(fila: FilaRemesa): boolean {
    const u = plantillaDe(fila)?.unidadMedidaProducto;
    return !!u && u !== "KGM";
  }

  function etiquetaCantidad(fila: FilaRemesa): string {
    const unidades: Record<string, string> = {
      GLL: "galones",
      MTQ: "metros cubicos",
      CMQ: "centimetros cubicos",
      LTR: "litros",
      MLT: "mililitros",
      BLL: "barriles",
      UN: "unidades",
    };
    const u = plantillaDe(fila)?.unidadMedidaProducto ?? "";
    return `Cantidad comercial (${unidades[u] ?? u})`;
  }

  // -------------------------------------------------------------------------
  // Envio
  // -------------------------------------------------------------------------

  async function generarManifiesto() {
    if (!vehiculoId || !conductorId || !remolqueId) {
      setMensaje({ tipo: "danger", texto: "Completa vehiculo, conductor y remolque." });
      return;
    }
    for (let i = 0; i < remesas.length; i++) {
      const r = remesas[i];
      if (!r.plantillaId) {
        setMensaje({ tipo: "danger", texto: `La carga ${i + 1} no tiene plantilla.` });
        return;
      }
      if (!r.fechaHoraCargue || !r.fechaHoraDescargue) {
        setMensaje({
          tipo: "danger",
          texto: `La carga ${i + 1} necesita cita de cargue y de descargue.`,
        });
        return;
      }
      if (new Date(r.fechaHoraDescargue) < new Date(r.fechaHoraCargue)) {
        setMensaje({
          tipo: "danger",
          texto: `En la carga ${i + 1} el descargue es anterior al cargue.`,
        });
        return;
      }
    }
    if (fleteEfectivo <= 0) {
      setMensaje({
        tipo: "danger",
        texto: "Escribe el valor del flete. La plantilla no tiene tarifa base cargada.",
      });
      return;
    }
    if (pideViajesDia && !viajesDia) {
      setMensaje({
        tipo: "danger",
        texto: "Esta plantilla es de varios viajes en el dia: indica cuantos viajes hara el vehiculo.",
      });
      return;
    }

    setEnviando(true);
    setMensaje(null);
    setAvisos([]);

    try {
      const viaje = await api.despachar({
        vehiculoId,
        conductorId,
        remolqueId,
        conductor2Id: conductor2Id ?? undefined,
        plantillaId: remesas[0].plantillaId!,
        remesas: remesas.map((r) => ({
          plantillaId: r.plantillaId!,
          fechaHoraCargue: r.fechaHoraCargue,
          fechaHoraDescargue: r.fechaHoraDescargue,
          pesoReal: r.pesoReal ?? undefined,
          cantidadReal: r.cantidadReal ?? undefined,
          ordenServicioGenerador: r.ordenServicioGenerador || undefined,
          valorFleteRemesa: r.valorFleteRemesa ?? undefined,
        })),
        valorFleteReal: fleteEfectivo,
        valorAnticipoManifiesto: valorAnticipo ?? undefined,
        retencionFopat: retencionFopat ?? undefined,
        codVia: codVia ?? undefined,
        fechaPagoSaldo: fechaPagoSaldo || undefined,
        viajesDia: viajesDia ?? undefined,
        vacio1Origen: vacio1Origen || undefined,
        vacio1Destino: vacio1Destino || undefined,
        vacio1Valor: vacio1Valor ?? undefined,
        vacio2Origen: vacio2Origen || undefined,
        vacio2Destino: vacio2Destino || undefined,
        vacio2Valor: vacio2Valor ?? undefined,
      });

      setAvisos(viaje.avisos ? viaje.avisos.split(" | ") : []);
      setMensaje({
        tipo: "success",
        texto: `Manifiesto ${viaje.numeroManifiestoRndc} generado con ${remesas.length} remesa(s).`,
      });
    } catch (exc: any) {
      // Cuando el RNDC rechaza, el backend responde 422 con el viaje adentro.
      const cuerpo = exc?.cuerpo;
      setAvisos(cuerpo?.avisos ? String(cuerpo.avisos).split(" | ") : []);
      setMensaje({
        tipo: "danger",
        texto: cuerpo?.mensajeError ?? exc?.message ?? "Error de comunicacion con el servidor.",
      });
    } finally {
      setEnviando(false);
    }
  }

  const puedeAvanzar =
    paso === 0
      ? !!(vehiculoId && conductorId && remolqueId)
      : paso === 1
        ? remesas.every((r) => r.plantillaId && r.fechaHoraCargue && r.fechaHoraDescargue)
        : true;

  const cargandoCatalogos =
    plantillas.cargando || vehiculos.cargando || conductores.cargando || remolques.cargando;

  const contenido = (
    <>
      {mensaje && (
        <div className={`alert ${mensaje.tipo === "success" ? "success" : "danger"}`}>
          {mensaje.texto}
        </div>
      )}
      <Avisos avisos={avisos} />

      {cargandoCatalogos && <Cargando que="catalogos" />}

      {/* ---------- PASO 0 ---------- */}
      {!cargandoCatalogos && paso === 0 && (
        <div className="form-section">
          <div>
            <div className="section-title">Vehiculo, remolque y conductor</div>
            <div className="section-desc">
              El sistema valida SOAT, tecnomecanica y licencia contra la fecha de descargue mas
              tardia de todas las cargas.
            </div>
          </div>
          <div>
            <label>Vehiculo</label>
            <select
              value={vehiculoId ?? ""}
              onChange={(e) => setVehiculoId(Number(e.target.value))}
            >
              <option value="" disabled>
                Selecciona...
              </option>
              {listaVehiculos.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.placa}
                  {v.configuracion ? ` (${v.configuracion})` : ""}
                </option>
              ))}
            </select>

            <label>Remolque (trailer) usado en este viaje</label>
            <select
              value={remolqueId ?? ""}
              onChange={(e) => setRemolqueId(Number(e.target.value))}
            >
              <option value="" disabled>
                Selecciona...
              </option>
              {listaRemolques.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.placa}
                </option>
              ))}
            </select>

            <label>Conductor</label>
            <select
              value={conductorId ?? ""}
              onChange={(e) => setConductorId(Number(e.target.value))}
            >
              <option value="" disabled>
                Selecciona...
              </option>
              {listaConductores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>

            <label>Segundo conductor (opcional)</label>
            <select
              value={conductor2Id ?? ""}
              onChange={(e) =>
                setConductor2Id(e.target.value === "" ? null : Number(e.target.value))
              }
            >
              <option value="">Ninguno</option>
              {listaConductores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* ---------- PASO 1 ---------- */}
      {!cargandoCatalogos && paso === 1 && (
        <div className="form-section">
          <div>
            <div className="section-title">Cargas del viaje</div>
            <div className="section-desc">
              Una por cada cliente o parada. Cada una genera su propia remesa, y todas quedan
              amparadas por un solo manifiesto. Maximo {MAX_REMESAS}.
            </div>
            {esMultiparada && (
              <div className="section-desc" style={{ marginTop: "0.6rem" }}>
                La primera carga define la ruta y los terminos del manifiesto.
              </div>
            )}
          </div>
          <div>
            {avisoTipoManifiesto && <div className="alert warning">{avisoTipoManifiesto}</div>}

            {remesas.map((r, i) => (
              <div key={i} className="bloque-remesa">
                <div className="bloque-remesa-titulo">
                  <strong>Carga {i + 1}</strong>
                  {remesas.length > 1 && (
                    <button type="button" className="btn-link" onClick={() => quitarRemesa(i)}>
                      Quitar
                    </button>
                  )}
                </div>

                <label>Plantilla (cliente y mercancia)</label>
                <select
                  value={r.plantillaId ?? ""}
                  onChange={(e) => actualizarFila(i, { plantillaId: Number(e.target.value) })}
                >
                  <option value="" disabled>
                    Selecciona...
                  </option>
                  {listaPlantillas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>

                <label>Cita de cargue</label>
                <input
                  type="datetime-local"
                  value={r.fechaHoraCargue}
                  onChange={(e) => alCambiarCargue(i, e.target.value)}
                />

                <label>Cita de descargue</label>
                <input
                  type="datetime-local"
                  value={r.fechaHoraDescargue}
                  onChange={(e) =>
                    actualizarFila(i, {
                      fechaHoraDescargue: e.target.value,
                      descargueEditado: true,
                    })
                  }
                />

                <label>Peso cargado (kg)</label>
                <input
                  type="number"
                  value={r.pesoReal ?? ""}
                  onChange={(e) =>
                    actualizarFila(i, {
                      pesoReal: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />

                {pideCantidadComercial(r) && (
                  <>
                    <label>{etiquetaCantidad(r)}</label>
                    <input
                      type="number"
                      value={r.cantidadReal ?? ""}
                      onChange={(e) =>
                        actualizarFila(i, {
                          cantidadReal: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                    />
                  </>
                )}

                <label>Orden de servicio del generador (opcional)</label>
                <input
                  value={r.ordenServicioGenerador}
                  onChange={(e) => actualizarFila(i, { ordenServicioGenerador: e.target.value })}
                />

                {esMultiparada && (
                  <>
                    <label>Parte del flete de esta carga (opcional)</label>
                    <input
                      type="number"
                      value={r.valorFleteRemesa ?? ""}
                      onChange={(e) =>
                        actualizarFila(i, {
                          valorFleteRemesa:
                            e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                    />
                    <p className="section-desc">
                      Sirve para repartir la retencion de ICA entre municipios. Si lo dejas vacio,
                      se reparte proporcional al peso.
                    </p>
                  </>
                )}
              </div>
            ))}

            <button
              type="button"
              className="btn-secundario"
              onClick={agregarRemesa}
              disabled={remesas.length >= MAX_REMESAS}
            >
              + Agregar otra carga
            </button>

            {pesoTotal > 0 && (
              <p className="section-desc" style={{ marginTop: "0.6rem" }}>
                Peso total del viaje: <strong>{moneda(pesoTotal)} kg</strong>
              </p>
            )}
          </div>
        </div>
      )}

      {/* ---------- PASO 2 ---------- */}
      {!cargandoCatalogos && paso === 2 && (
        <div className="form-section">
          <div>
            <div className="section-title">Valores del manifiesto</div>
            <div className="section-desc">Aplican al viaje completo, no a cada carga.</div>
          </div>
          <div>
            <label>Via a utilizar</label>
            <select
              value={codVia ?? ""}
              onChange={(e) => setCodVia(e.target.value || null)}
              disabled={vias.length === 0}
            >
              <option value="">Via estandar de SICETAC (el RNDC la asigna)</option>
              {vias.map((v) => (
                <option key={v.codVia} value={v.codVia}>
                  {v.esEstandar ? "(estandar) " : ""}
                  {v.descripcion}
                  {v.valorSicetac ? ` — piso ${moneda(v.valorSicetac)}` : ""}
                </option>
              ))}
            </select>

            {cargandoVias && (
              <p className="section-desc">Consultando vias y tarifas en SICETAC...</p>
            )}
            {periodoSicetac && !viasDesdeCache && (
              <p className="section-desc">Valores de SICETAC del periodo {periodoSicetac}.</p>
            )}
            {viasDesdeCache && vias.length > 0 && (
              <div className="alert warning">
                No se pudo consultar SICETAC ahora. Se muestran los ultimos valores consultados,
                que pueden estar desactualizados.
              </div>
            )}
            {!cargandoVias && vias.length === 0 && municipioOrigen && municipioDestino && (
              <p className="section-desc">
                SICETAC no devolvio vias para {municipioOrigen} → {municipioDestino}. El manifiesto
                saldra con la via estandar que asigne el RNDC.
              </p>
            )}
            {viaSeleccionada?.valorSicetac && (
              <p className="section-desc">
                Piso de esta via: {moneda(viaSeleccionada.valorSicetac)} (movilizacion mas{" "}
                {horasPactadas.toFixed(2)} horas pactadas).
              </p>
            )}
            {avisoPisoSicetac && <div className="alert warning">{avisoPisoSicetac}</div>}

            <label>Valor del flete pactado</label>
            <input
              type="number"
              value={valorFleteReal ?? ""}
              onChange={(e) => {
                setFleteEditado(true);
                setValorFleteReal(e.target.value === "" ? null : Number(e.target.value));
              }}
            />
            {plantillaPrincipal?.valorFleteBase && (
              <p className="section-desc">
                Tarifa de la plantilla: {moneda(plantillaPrincipal.valorFleteBase)}. Puedes
                cambiarla para este viaje sin afectar la plantilla.
              </p>
            )}

            <label>Retencion FOPAT (0,1% del flete)</label>
            <input
              type="number"
              value={retencionFopat ?? ""}
              onChange={(e) => {
                setFopatEditado(true);
                setRetencionFopat(e.target.value === "" ? null : Number(e.target.value));
              }}
            />
            <p className="section-desc">
              Se calcula solo al escribir el flete. Este es el valor que la empresa le declara a la
              DIAN el mes siguiente, y queda registrado en el viaje para poder cuadrar el pago.
              {fopatEditado && (
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => {
                    setFopatEditado(false);
                    setRetencionFopat(fopatCalculado);
                  }}
                >
                  Volver al calculado ({moneda(fopatCalculado)})
                </button>
              )}
            </p>
            {avisoFopat && <div className="alert warning">{avisoFopat}</div>}

            <label>Valor del anticipo entregado</label>
            <input
              type="number"
              value={valorAnticipo ?? ""}
              onChange={(e) =>
                setValorAnticipo(e.target.value === "" ? null : Number(e.target.value))
              }
            />
            <p className="section-desc">
              No puede superar el neto a pagar, o sea el flete menos las tres retenciones.
            </p>

            <label>Fecha de pago del saldo (vacio = fecha del ultimo descargue)</label>
            <input
              type="date"
              value={fechaPagoSaldo}
              onChange={(e) => setFechaPagoSaldo(e.target.value)}
            />
            <p className="section-desc">
              Maximo 5 dias habiles despues de la cita de descargue.
            </p>

            {pideViajesDia && (
              <>
                <label>Cantidad de viajes en el dia</label>
                <input
                  type="number"
                  value={viajesDia ?? ""}
                  onChange={(e) =>
                    setViajesDia(e.target.value === "" ? null : Number(e.target.value))
                  }
                />
              </>
            )}

            <div style={{ marginTop: "0.8rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  style={{ width: "auto" }}
                  checked={mostrarVacios}
                  onChange={(e) => setMostrarVacios(e.target.checked)}
                />
                Este viaje tiene trayectos en vacio pactados
              </label>
            </div>

            {mostrarVacios && (
              <div style={{ marginTop: "0.6rem" }}>
                <p className="section-desc">
                  Solo si le pagas al transportador por recorrer un tramo sin carga. Los municipios
                  van con el codigo RNDC de 8 digitos.
                </p>

                <label>Vacio 1 - municipio origen (donde arranca sin carga)</label>
                <input value={vacio1Origen} onChange={(e) => setVacio1Origen(e.target.value)} />
                <label>Vacio 1 - municipio destino (donde carga la primera remesa)</label>
                <input value={vacio1Destino} onChange={(e) => setVacio1Destino(e.target.value)} />
                <label>Vacio 1 - valor pactado</label>
                <input
                  type="number"
                  value={vacio1Valor ?? ""}
                  onChange={(e) =>
                    setVacio1Valor(e.target.value === "" ? null : Number(e.target.value))
                  }
                />

                <label>Vacio 2 - municipio origen (donde descarga la ultima remesa)</label>
                <input value={vacio2Origen} onChange={(e) => setVacio2Origen(e.target.value)} />
                <label>Vacio 2 - municipio destino (donde termina el viaje)</label>
                <input value={vacio2Destino} onChange={(e) => setVacio2Destino(e.target.value)} />
                <label>Vacio 2 - valor pactado</label>
                <input
                  type="number"
                  value={vacio2Valor ?? ""}
                  onChange={(e) =>
                    setVacio2Valor(e.target.value === "" ? null : Number(e.target.value))
                  }
                />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );

  const pie = (
    <>
      {paso > 0 && (
        <button className="btn-secondary" onClick={() => setPaso(paso - 1)}>
          Atras
        </button>
      )}
      {paso < PASOS.length - 1 ? (
        <button className="btn-primary" onClick={() => setPaso(paso + 1)} disabled={!puedeAvanzar}>
          Siguiente
        </button>
      ) : (
        <button className="btn-primary" onClick={generarManifiesto} disabled={enviando}>
          {enviando ? "Generando..." : "Generar manifiesto"}
        </button>
      )}
    </>
  );

  // Se puede usar como pagina o dentro de una ventana modal.
  if (alCerrar) {
    return (
      <Modal
        titulo="Nuevo despacho"
        ancho="wide"
        pasos={PASOS}
        pasoActual={paso}
        alCerrar={alCerrar}
        pie={pie}
      >
        {contenido}
      </Modal>
    );
  }

  return (
    <div className="panel">
      <div className="stepper-header">
        {PASOS.map((p, i) => (
          <div
            key={p}
            className={
              i === paso ? "stepper-step active" : i < paso ? "stepper-step done" : "stepper-step"
            }
          >
            <span className="dot">{i < paso ? "✓" : i + 1}</span>
            <span>{p}</span>
          </div>
        ))}
      </div>
      {contenido}
      <div className="modal-footer">{pie}</div>
    </div>
  );
}
