/**
 * Cliente de la API del backend.
 *
 * Reemplaza al ApiService de Angular. La diferencia de fondo: aqui cada
 * funcion devuelve una Promise en vez de un Observable, asi que se consume con
 * `await` y no con `.subscribe()`.
 *
 * Las URL son relativas (`/api/...`) y no absolutas a localhost:3000: el proxy
 * de Vite las redirige al backend en desarrollo, y en produccion se sirven
 * desde el mismo origen. Asi no hay que tocar CORS ni cambiar la URL al
 * desplegar.
 */

import type {
  Conductor,
  DatosRndc,
  EmpresaMonitoreo,
  Municipio,
  ParametrosEmpresa,
  PeticionDespacho,
  PlantillaViaje,
  Remolque,
  RespuestaViasSicetac,
  ResumenAlertas,
  RutaConTarifa,
  Tercero,
  Vehiculo,
  Via,
  Viaje,
  ViajeRemesa,
  PreviaAnulacion,
  SugerenciaVehiculo,
  Usuario,
} from "./tipos";

const BASE = "/api";

/**
 * Error con el cuerpo que devolvio el backend.
 *
 * Importa conservarlo: cuando el RNDC rechaza un despacho, el backend responde
 * 422 con el viaje completo adentro (mensajeError, codigoError, avisos). Si se
 * pierde ese cuerpo, la pantalla no puede explicar que paso.
 */
export class ErrorApi extends Error {
  /**
   * mensaje: texto para mostrar; estado: codigo HTTP (0 = sin conexion);
   * cuerpo: la respuesta completa del backend (por ejemplo el viaje con su error).
   */
  constructor(
    mensaje: string,
    public readonly estado: number,
    public readonly cuerpo: any
  ) {
    super(mensaje);
    this.name = "ErrorApi";
  }
}

/** Se dispara cuando el backend dice que no hay sesion valida. */
export const EVENTO_SESION_VENCIDA = "tms:sesion-vencida";

/**
 * Hace una peticion a la API (/api + ruta) y devuelve el JSON de respuesta.
 *
 * Como funciona:
 * 1. fetch con Content-Type JSON; la cookie de sesion la manda el navegador.
 * 2. Sin conexion: ErrorApi con estado 0 y un mensaje claro.
 * 3. Respuesta vacia (204): devuelve null.
 * 4. Error HTTP: si es 401 por sesion vencida avisa a toda la aplicacion
 *    (EVENTO_SESION_VENCIDA, vuelve el login) y lanza ErrorApi con el mensaje
 *    del backend y el cuerpo completo.
 */
async function pedir<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`${BASE}${ruta}`, {
      headers: { "Content-Type": "application/json" },
      ...opciones,
    });
  } catch (exc) {
    throw new ErrorApi(
      "No se pudo contactar el servidor. Revisa que el backend este corriendo.",
      0,
      null
    );
  }

  // 204 y respuestas vacias no traen JSON que parsear.
  const texto = await respuesta.text();
  const cuerpo = texto ? JSON.parse(texto) : null;

  if (!respuesta.ok) {
    // Sesion vencida o cerrada en otro lado: se avisa a toda la aplicacion
    // (ProveedorSesion escucha este evento y vuelve a mostrar el login).
    if (respuesta.status === 401 && cuerpo?.sesion === false) {
      window.dispatchEvent(new Event(EVENTO_SESION_VENCIDA));
    }
    const mensaje =
      cuerpo?.mensajeError ?? cuerpo?.error ?? `Error ${respuesta.status} del servidor`;
    throw new ErrorApi(mensaje, respuesta.status, cuerpo);
  }
  return cuerpo as T;
}

/** GET a la API. */
const get = <T>(ruta: string) => pedir<T>(ruta);
/** POST a la API con el cuerpo en JSON. */
const post = <T>(ruta: string, datos: unknown) =>
  pedir<T>(ruta, { method: "POST", body: JSON.stringify(datos) });
/** PUT a la API con el cuerpo en JSON. */
const put = <T>(ruta: string, datos: unknown) =>
  pedir<T>(ruta, { method: "PUT", body: JSON.stringify(datos) });
/** DELETE a la API. */
const del = <T>(ruta: string) => pedir<T>(ruta, { method: "DELETE" });

// ---------------------------------------------------------------------------
// Catalogo
// ---------------------------------------------------------------------------

/** Una fila del libro de consecutivos (una por remesa). */
export interface FilaConsecutivo {
  viajeId: number;
  remesaId: number;
  orden: number;
  fechaPlanillada: string;
  placa: string | null;
  cliente: string | null;
  pesoReal: number | null;
  valorManifiesto: number | null;
  retencionFopat: number | null;
  valorAnticipo: number | null;
  citaCargue: string;
  citaDescargue: string;
  consecutivoManifiesto: string | null;
  radicadoManifiesto: string | null;
  consecutivoRemesa: string | null;
  radicadoRemesa: string | null;
  estadoViaje: string;
  estadoRemesa: string;
  codMunicipioCargue: string | null;
  municipioCargue: string | null;
  producto: string | null;
  codMercancia: string | null;
  remitenteTipoId: string | null;
  remitenteNit: string | null;
  remitenteNombre: string | null;
  codMunicipioDescargue: string | null;
  municipioDescargue: string | null;
  destinatarioTipoId: string | null;
  destinatarioNit: string | null;
  destinatarioNombre: string | null;
  conductor: string | null;
  creadoPor: string | null;
}

export interface TerceroDetalle {
  nombre: string;
  nit: string;
  tipoId: string;
  sede: string;
  ciudad: string | null;
  codMunicipio: string | null;
  direccion: string | null;
}

/** Respuesta de GET /despacho/:id/detalle. */
export interface DetalleViaje {
  viaje: Viaje;
  tipoManifiesto: string | null;
  origen: string | null;
  destino: string | null;
  vehiculo: { placa: string; marca: string | null; configuracion: string | null; titular: string | null; titularId: string | null; titularTipoId: string | null } | null;
  remolque: { placa: string } | null;
  conductor: { nombre: string; cedula: string; licencia: string | null } | null;
  conductor2: { nombre: string; cedula: string } | null;
  monitoreo: { nombre: string | null; nit: string } | null;
  remesas: Array<
    ViajeRemesa & {
      plantilla: string | null;
      producto: string | null;
      codMercancia: string | null;
      codTipoEmpaque: string | null;
      unidadMedidaProducto: string | null;
      pactoCargue: string | null;
      pactoDescargue: string | null;
      contratante: TerceroDetalle | null;
      remitente: TerceroDetalle | null;
      destinatario: TerceroDetalle | null;
    }
  >;
}

/** Cumplido inicial del GPS. consultado=false: no se pudo preguntar al RNDC. */
export interface TiemposGps {
  consultado: boolean;
  radicado?: string | null;
  llegadaCargue?: string | null;
  salidaCargue?: string | null;
  llegadaDescargue?: string | null;
  salidaDescargue?: string | null;
}

/** Cumplido de una remesa tal como quedo en el RNDC (o en el sistema, si el RNDC no responde). */
export interface CumplidoRegistrado {
  fuente: "RNDC" | "sistema";
  noCumplida?: boolean;
  radicado?: string | null;
  fechaRegistro?: string | null;
  cantidadEntregada?: number | null;
  llegadaCargue?: string | null;
  entradaCargue?: string | null;
  salidaCargue?: string | null;
  llegadaDescargue?: string | null;
  entradaDescargue?: string | null;
  salidaDescargue?: string | null;
}

/** Respuesta de GET /despacho/:id/cumplir/previa. */
export interface PreviaCumplidoManifiesto {
  valorFlete: number;
  valorAnticipo: number;
  vacio1Valor: number;
  vacio2Valor: number;
  tarifaRetencionFuente?: number;
  titularEsRegimenSimple: boolean;
  aplicaFopat: boolean;
  retencionFuente: number;
  retencionFopat: number | null;
  motivosDescuento: Record<string, string>;
  motivosAdicional: string[];
  tiempos: TiemposLogisticos;
}

/** Pactado contra ejecutado (minutos), como el bloque "Tiempos logisticos" del portal. */
export interface TiemposLogisticos {
  remesas: Array<{
    consecutivo: string | null;
    fuente: "RNDC" | "sistema" | null;
    pactadoCargue: number | null;
    pactadoDescargue: number | null;
    ejecutadoCargue: number | null;
    ejecutadoDescargue: number | null;
  }>;
  pactadoCargue: number | null;
  pactadoDescargue: number | null;
  ejecutadoCargue: number | null;
  ejecutadoDescargue: number | null;
  /** Minutos desde la llegada hasta la salida (la espera cuenta): los usa el RNDC para el piso. */
  conEsperaCargue: number | null;
  conEsperaDescargue: number | null;
  /** Valor hora de SICETAC de la via del viaje. */
  valorHora: number | null;
  errorSicetac: string | null;
  /**
   * Piso SICETAC de la via con las horas pactadas: el valor a pagar del
   * cumplido debe ser igual o mayor [Guia Cumplido 3.4 y 3.9].
   */
  piso: {
    /** Piso del cumplido: movilizacion + valor hora x horas ejecutadas (o pactadas si no hay tiempos). */
    valor: number;
    conHorasEjecutadas: boolean;
    horas: number;
    /** Piso con las horas pactadas, el que se verifico al despachar. */
    valorDespacho: number;
    horasPactadas: number;
    valorMoviliza: number;
    codVia: string | null;
    via: string | null;
    periodo: string | null;
    /** Si SICETAC no respondio y se usaron los valores guardados: cuando se obtuvieron. */
    guardadoEn: string | null;
  } | null;
  /** (ejecutado - pactado) en horas x valor hora. Positivo = adicional; negativo = descuento. */
  diferenciaValorCargue: number | null;
  diferenciaValorDescargue: number | null;
}

/** Como se entrego una clave temporal: por correo, o en pantalla si no se pudo. */
export interface EntregaClave {
  enviadoPorCorreo: boolean;
  claveTemporal?: string;
  avisoCorreo?: string;
}

/** Sesion y usuarios. La cookie de sesion la maneja el navegador solo. */
export const auth = {
  /** Usuario de la sesion actual (401 si no hay sesion). */
  sesion: () => get<Usuario>("/auth/sesion"),
  /** Inicia sesion con correo y clave; el backend pone la cookie. */
  login: (email: string, clave: string) => post<Usuario>("/auth/login", { email, clave }),
  /** Cierra la sesion y borra la cookie. */
  logout: () => post<void>("/auth/logout", {}),
  /** Cambia la clave propia (pide la actual). */
  cambiarClave: (actual: string, nueva: string) =>
    post<Usuario>("/auth/cambiar-clave", { actual, nueva }),

  /** Usuarios del sistema. */
  listarUsuarios: () => get<Usuario[]>("/usuarios"),
  /**
   * La clave temporal se envia por correo. Solo si el correo no esta
   * configurado o falla, llega en la respuesta (una sola vez).
   */
  crearUsuario: (email: string, nombre: string) =>
    post<Usuario & EntregaClave>("/usuarios", { email, nombre }),
  /** Cambia nombre y/o estado activo de un usuario. */
  actualizarUsuario: (id: number, datos: { nombre?: string; activo?: boolean }) =>
    put<Usuario>(`/usuarios/${id}`, datos),
  /** Genera una clave temporal nueva para un usuario (por correo, o en la respuesta). */
  restablecerClave: (id: number) => post<EntregaClave>(`/usuarios/${id}/restablecer-clave`, {}),

  /** "Olvide mi contrasena": envia un codigo de 6 digitos al correo. */
  recuperar: (email: string) => post<{ ok: boolean; minutos: number }>("/auth/recuperar", { email }),
  /** Crea la clave nueva con el codigo de 6 digitos que llego al correo. */
  confirmarRecuperacion: (email: string, codigo: string, nueva: string) =>
    post<{ ok: boolean }>("/auth/recuperar/confirmar", { email, codigo, nueva }),
};

/**
 * Llamadas de catalogo, despacho, cumplidos e impresion. Cada una corresponde
 * a una ruta del backend (/api/catalogo/... y /api/despacho/...).
 */
export const api = {
  /** Vehiculos del catalogo (activos e inactivos; sin los eliminados). */
  getVehiculos: () => get<Vehiculo[]>("/catalogo/vehiculos"),
  /** Crea un vehiculo (o recupera uno eliminado con la misma placa). */
  crearVehiculo: (datos: Partial<Vehiculo>) =>
    post<Vehiculo>("/catalogo/vehiculos", datos),
  /** Lo que no se mande conserva su valor actual. */
  actualizarVehiculo: (id: number, datos: Partial<Vehiculo>) =>
    put<Vehiculo>(`/catalogo/vehiculos/${id}`, datos),
  /**
   * Borrado logico: el vehiculo sale de todas las listas pero se conserva
   * para los viajes que ya lo usaron. Crear otra vez la misma placa lo recupera.
   */
  eliminarVehiculo: (id: number) => del<void>(`/catalogo/vehiculos/${id}`),

  // ---------- Empresas de monitoreo de flota ----------

  /** Empresas de monitoreo de flota (GPS) activas. */
  getEmpresasMonitoreo: () => get<EmpresaMonitoreo[]>("/catalogo/monitoreo"),
  /** Registra una empresa de monitoreo de flota (GPS). */
  crearEmpresaMonitoreo: (datos: { nit: string; nombre: string }) =>
    post<EmpresaMonitoreo>("/catalogo/monitoreo", datos),
  /** Cambia NIT y/o nombre de una empresa de monitoreo. */
  actualizarEmpresaMonitoreo: (id: number, datos: { nit?: string; nombre?: string }) =>
    put<EmpresaMonitoreo>(`/catalogo/monitoreo/${id}`, datos),
  /** Desactiva una empresa de monitoreo. */
  eliminarEmpresaMonitoreo: (id: number) => del<void>(`/catalogo/monitoreo/${id}`),
  /** Proveedor de GPS por defecto de un vehiculo. */
  fijarMonitoreoVehiculo: (vehiculoId: number, nitMonitoreoFlota: string | null) =>
    put<Vehiculo>(`/catalogo/vehiculos/${vehiculoId}/monitoreo`, { nitMonitoreoFlota }),

  /** Conductores del catalogo. */
  getConductores: () => get<Conductor[]>("/catalogo/conductores"),
  /** Crea un conductor. */
  crearConductor: (datos: Partial<Conductor>) =>
    post<Conductor>("/catalogo/conductores", datos),
  /** Edita un conductor; lo que no se mande no cambia. */
  actualizarConductor: (id: number, datos: Partial<Conductor>) =>
    put<Conductor>(`/catalogo/conductores/${id}`, datos),

  /** Remolques del catalogo. */
  getRemolques: () => get<Remolque[]>("/catalogo/remolques"),
  /** Crea un remolque. */
  crearRemolque: (datos: Partial<Remolque>) =>
    post<Remolque>("/catalogo/remolques", datos),
  /** Edita un remolque; lo que no se mande no cambia. */
  actualizarRemolque: (id: number, datos: Partial<Remolque>) =>
    put<Remolque>(`/catalogo/remolques/${id}`, datos),

  /** Clientes, remitentes y destinatarios. */
  getTerceros: () => get<Tercero[]>("/catalogo/terceros"),
  /** Crea un tercero. avisoCoordenada trae el problema de su coordenada, si hay. */
  crearTercero: (datos: Partial<Tercero>) =>
    post<Tercero & { avisoCoordenada?: string | null }>("/catalogo/terceros", datos),
  /** Edita un tercero. avisoCoordenada trae el problema de su coordenada, si hay. */
  actualizarTercero: (id: number, datos: Partial<Tercero>) =>
    put<Tercero & { avisoCoordenada?: string | null }>(`/catalogo/terceros/${id}`, datos),

  /** Plantillas de viaje activas, con sus terceros. */
  getPlantillas: () => get<PlantillaViaje[]>("/catalogo/plantillas"),
  /** Crea una plantilla de viaje. */
  crearPlantilla: (datos: Partial<PlantillaViaje>) =>
    post<PlantillaViaje>("/catalogo/plantillas", datos),
  /** Lo que no se mande conserva su valor actual. */
  actualizarPlantilla: (id: number, datos: Partial<PlantillaViaje>) =>
    put<PlantillaViaje>(`/catalogo/plantillas/${id}`, datos),
  /** "Elimina" (desactiva) una plantilla que ya no se usa. */
  eliminarPlantilla: (id: number) => del<void>(`/catalogo/plantillas/${id}`),

  /** Catalogo DIVIPOLA. Vacio si aun no se importo el CSV de municipios. */
  getMunicipios: () => get<Municipio[]>("/catalogo/municipios"),

  // ---------- Vias y SICETAC ----------

  /** Ultimo resultado guardado, sin consultar al Ministerio. */
  getVias: (origen: string, destino: string) =>
    get<Via[]>(`/catalogo/vias?origen=${origen}&destino=${destino}`),

  /**
   * Vias consultadas en linea a SICETAC, con el piso de cada una.
   * `horas` son las horas pactadas de cargue y descargue: entran en el piso.
   */
  getViasSicetac: (origen: string, destino: string, configuracion: string, horas: number) =>
    get<RespuestaViasSicetac>(
      `/catalogo/vias/sicetac?origen=${origen}&destino=${destino}` +
        `&configuracion=${encodeURIComponent(configuracion)}&horas=${horas}`
    ),

  // ---------- Tarifas por ruta ----------

  /**
   * Rutas de las plantillas activas con cuantas plantillas tiene cada una y su
   * rango de tarifas: punto de partida para actualizar tarifas por ruta.
   */
  getRutasConTarifas: () => get<RutaConTarifa[]>("/catalogo/tarifas/rutas"),

  /** Plantillas que cambiarian al actualizar el flete base de una ruta, con su valor actual. */
  previsualizarTarifa: (origen: string, destino: string) =>
    get<Array<{ id: number; nombre: string; valorFleteBase: number | null }>>(
      `/catalogo/tarifas/previsualizar?origen=${origen}&destino=${destino}`
    ),

  /** Fija el flete base de todas las plantillas de una ruta. Devuelve cuantas cambiaron. */
  actualizarTarifaRuta: (origen: string, destino: string, valorFleteBase: number) =>
    put<{ actualizadas: number; valorFleteBase: number }>("/catalogo/tarifas", {
      origen,
      destino,
      valorFleteBase,
    }),

  // ---------- Alertas y parametros ----------

  /** `inactivos` agrega los documentos de vehiculos, remolques y conductores inactivos. */
  getAlertas: (dias = 30, inactivos = false) =>
    get<ResumenAlertas>(`/catalogo/alertas?dias=${dias}${inactivos ? "&inactivos=1" : ""}`),

  /** Parametros de la empresa (poliza, retencion...) y aviso de vigencia de la poliza. */
  getParametros: () => get<ParametrosEmpresa>("/catalogo/parametros"),
  /** Guarda los parametros enviados; los demas no cambian. */
  guardarParametros: (datos: Partial<ParametrosEmpresa>) =>
    put<ParametrosEmpresa>("/catalogo/parametros", datos),

  // ---------- Despacho ----------

  /**
   * Despacha un viaje: el backend valida, expide las remesas y el manifiesto en
   * el RNDC y devuelve el viaje (con su error si el RNDC lo rechazo).
   */
  despachar: (datos: PeticionDespacho) => post<Viaje>("/despacho", datos),

  /** Todos los viajes, con el plazo del cumplido de los que ya descargaron. */
  getHistorial: () => get<Viaje[]>("/despacho/historial"),
  /** Libro de consecutivos: una fila por remesa, como la hoja de control. */
  getConsecutivos: () => get<FilaConsecutivo[]>("/despacho/consecutivos"),
  /** Todo lo que se registro al despachar un viaje. */
  getDetalleViaje: (viajeId: number) => get<DetalleViaje>(`/despacho/${viajeId}/detalle`),

  /** Remolque y conductor que suele usar el vehiculo (historial o catalogo). */
  getSugerencias: (vehiculoId: number) =>
    get<SugerenciaVehiculo>(`/despacho/sugerencias/${vehiculoId}`),

  /** Siguiente numero de manifiesto disponible. Es una sugerencia, no una reserva. */
  getSiguienteConsecutivo: () => get<{ base: string }>("/despacho/siguiente-consecutivo"),

  /**
   * Retoma un viaje a medias: reutiliza las remesas ya creadas en el RNDC y
   * envia lo que falte. `cambios` corrige datos del manifiesto (vehiculo,
   * conductor, remolque, EMF, valores, numero). Si el RNDC vuelve a rechazar,
   * lanza ErrorApi con el viaje actualizado en `cuerpo`.
   */
  reintentarViaje: (viajeId: number, cambios: Record<string, unknown>) =>
    post<Viaje>(`/despacho/${viajeId}/reintentar`, cambios),

  /** Que se anularia y en que orden, con los motivos validos y el tope mensual. */
  getPreviaAnulacion: (viajeId: number) =>
    get<PreviaAnulacion>(`/despacho/${viajeId}/anulacion`),
  /**
   * Anula en el RNDC: cumplido inicial (54), manifiesto (32) y remesas (9).
   * Si un paso falla, lanza ErrorApi con el viaje actualizado en `cuerpo`.
   */
  anularViaje: (
    viajeId: number,
    datos: { motivoManifiesto?: string; motivoCumplido: string; motivoRemesa: string; observaciones: string }
  ) => post<Viaje & { remesas: ViajeRemesa[] }>(`/despacho/${viajeId}/anular`, datos),

  /** Remesas de un viaje, en orden. */
  getRemesasDeViaje: (viajeId: number) =>
    get<ViajeRemesa[]>(`/despacho/${viajeId}/remesas`),

  /** Un viaje con sus remesas. */
  getViaje: (viajeId: number) => get<Viaje & { remesas: ViajeRemesa[] }>(`/despacho/${viajeId}`),

  /** Todo lo que el viaje envia al RNDC, sin enviar nada. */
  getDatosRndc: (viajeId: number) => get<DatosRndc>(`/despacho/${viajeId}/datos-rndc`),
  /**
   * El RNDC dijo "DUPLICADO": la remesa (o el manifiesto) ya existia de un
   * intento anterior. Se toma ese radicado, despues de que la persona confirma
   * que es el mismo documento.
   */
  usarRemesaExistente: (remesaId: number) =>
    post<Viaje & { remesas: ViajeRemesa[] }>(`/despacho/remesas/${remesaId}/usar-existente`, {}),
  /** Toma el radicado de un manifiesto que el RNDC reporto como ya existente. */
  usarManifiestoExistente: (viajeId: number) =>
    post<Viaje & { remesas: ViajeRemesa[] }>(`/despacho/${viajeId}/usar-manifiesto-existente`, {}),

  /** Cumplido normal de una remesa (proceso 5). Fechas en ISO. */
  cumplirRemesa: (
    remesaId: number,
    datos: {
      cantidadEntregada: number;
      llegadaCargue: string;
      entradaCargue: string;
      salidaCargue: string;
      llegadaDescargue: string;
      entradaDescargue: string;
      salidaDescargue: string;
    }
  ) => post<{ viaje: Viaje; remesas: ViajeRemesa[] }>(`/despacho/remesas/${remesaId}/cumplir`, datos),
  /**
   * Tiempos que ya reporto el GPS (cumplido inicial, proceso 45). En el
   * formulario vienen puestos y se pueden corregir.
   */
  getGpsRemesa: (remesaId: number) => get<TiemposGps>(`/despacho/remesas/${remesaId}/gps`),
  /** Lo que quedo registrado en el cumplido de una remesa (leido del RNDC). */
  getCumplidoRemesa: (remesaId: number) =>
    get<CumplidoRegistrado>(`/despacho/remesas/${remesaId}/cumplido`),
  /** Anula el cumplido de una remesa (proceso 28) para corregirlo. */
  anularCumplidoRemesa: (remesaId: number, motivo: string, observaciones: string) =>
    post<{ viaje: Viaje; remesas: ViajeRemesa[] }>(`/despacho/remesas/${remesaId}/anular-cumplido`, {
      motivo,
      observaciones,
    }),

  /** Valores de partida para la ventana de cumplido del manifiesto. */
  getPreviaCumplidoManifiesto: (viajeId: number) =>
    get<PreviaCumplidoManifiesto>(`/despacho/${viajeId}/cumplir/previa`),
  /** Adopta los cumplidos hechos en el portal del RNDC (solo lectura alla). */
  sincronizarCumplido: (viajeId: number) =>
    post<{ adoptados: string[]; error?: string; viaje?: Viaje; remesas?: ViajeRemesa[] }>(
      `/despacho/${viajeId}/cumplir/sincronizar`,
      {}
    ),

  /**
   * Cumple el manifiesto (proceso 6) con la fecha de entrega, adicionales,
   * descuentos y retenciones. Antes adopta lo cumplido en el portal; el RNDC
   * exige todas las remesas cumplidas y lo dice con su error si falta alguna.
   */
  cumplirManifiesto: (viajeId: number, datos: Record<string, unknown> = {}) =>
    post<Viaje & { remesas: ViajeRemesa[] }>(`/despacho/${viajeId}/cumplir`, datos),

  /** FOPAT causado y pendiente de pago, por mes. */
  getResumenFopat: () =>
    get<Array<{ mes: string; manifiestos: number; causado: number; pendiente: number }>>(
      "/despacho/fopat"
    ),

  // ---------- Documentos para imprimir ----------
  // Son URL y no peticiones: se abren en otra pestaña para que el navegador
  // muestre el PDF con su propio visor.

  /** PDF oficial del RNDC; por defecto con el logo de la empresa estampado. */
  urlPdfManifiesto: (viajeId: number, original = false) =>
    `${BASE}/despacho/${viajeId}/manifiesto.pdf${original ? "?original=1" : ""}`,
  /** Remesa imprimible (HTML con el formato oficial), para abrir en otra pestana. */
  urlImprimirRemesa: (remesaId: number) => `${BASE}/despacho/remesas/${remesaId}/imprimir`,
};

// ---------------------------------------------------------------------------
// Ayudas de presentacion
// ---------------------------------------------------------------------------

const FORMATO_MONEDA = new Intl.NumberFormat("es-CO");

/**
 * Formato que entiende <input type="datetime-local">: YYYY-MM-DDTHH:mm.
 * Se arma con los componentes locales y no con toISOString(), que convierte a
 * UTC y en Colombia adelantaria el reloj cinco horas.
 */
export function aInputLocal(fecha: Date): string {
  const dos = (n: number) => String(n).padStart(2, "0");
  return (
    `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}` +
    `T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`
  );
}

/** Valor en pesos con punto de miles (4.019.761); "-" sin valor. */
export function moneda(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "-";
  return FORMATO_MONEDA.format(valor);
}

/**
 * Fecha para mostrar, en hora de Colombia.
 *
 * Se fija la zona a proposito: el backend guarda y entrega en UTC, y dejar que
 * el navegador use la suya haria que un cargue de madrugada se viera con otra
 * fecha segun donde este el equipo.
 */
export function fechaHora(valor: string | null | undefined): string {
  if (!valor) return "-";
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(valor));
}

/**
 * Para columnas DATE (vencimientos de SOAT, tecnomecanica, licencia...).
 *
 * El backend las entrega como medianoche UTC ("2029-04-06T00:00:00.000Z").
 * soloFecha() las pasa a hora de Bogota y quedaban UN DIA ANTES (05/04/2029).
 * Aqui se lee el dia tal cual, sin zona horaria.
 */
export function soloDia(valor: string | null | undefined): string {
  if (!valor) return "-";
  const [a, m, d] = valor.slice(0, 10).split("-");
  return d && m && a ? `${d}/${m}/${a}` : "-";
}

/** Hoy en Colombia como "AAAA-MM-DD", para comparar contra columnas DATE. */
export function hoyColombia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}

/** Solo la fecha (DD/MM/AAAA) de un instante, en hora de Colombia; "-" sin valor. */
export function soloFecha(valor: string | null | undefined): string {
  if (!valor) return "-";
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(valor));
}

/** Los avisos del backend vienen en un solo campo separados por " | ". */
export function separarAvisos(avisos: string | null | undefined): string[] {
  return avisos ? avisos.split(" | ").filter(Boolean) : [];
}

// ---------------------------------------------------------------------------
// Cuadro pagos (control operativo y financiero de los viajes)
// ---------------------------------------------------------------------------
export type EstadoPapeles = "EN_RUTA" | "CONDUCTOR" | "PARQUEADERO" | "OFICINA" | "RADICADO";
export type Flota = "LOPEZ" | "MYC" | "TERCERO";
export type EstadoCuadro = "ANULADO" | "PAGADO" | "FACTURADO" | "FACTURADO_SIN_DATOS" | "RADICADO" | "SIN_RADICAR" | "EN_RUTA";

export interface FilaCuadro {
  id: number;
  fecha: string;
  vehiculoId: number | null;
  placa: string;
  flota: Flota;
  conductor: string | null;
  empresa: string;
  viajeId: number | null;
  viajeRemesaId: number | null;
  manifiesto: string | null;
  remesa: string | null;
  remision: string | null;
  pesoKg: number | null;
  tipoFlete: "KILO" | "FIJO";
  tarifaKilo: number | null;
  valorFijo: number | null;
  valorFlete: number | null;
  fechaDescargue: string | null;
  estadoPapeles: EstadoPapeles;
  flujoCorame: boolean;
  fechaRadicado: string | null;
  facturado: boolean;
  facturaNumero: string | null;
  facturaFecha: string | null;
  facturaFechaPago: string | null;
  fechaPagoSaldo: string | null;
  venceSaldo: string | null;
  revisadoContabilidadPor: string | null;
  revisadoContabilidadEn: string | null;
  revisadoGerenciaPor: string | null;
  revisadoGerenciaEn: string | null;
  anulado: boolean;
  totalAnticipos: number;
  anticiposSinPagar: number;
  notas: number;
  ultimaNota: string | null;
  estado: EstadoCuadro;
  todoPagado: boolean;
}

export interface AnticipoBomba {
  id: number;
  bombaId: number;
  bomba: string;
  ciudad: string | null;
  valor: number;
  fecha: string;
  fechaPago: string | null;
  nota: string | null;
  creadoPor: string | null;
}

export interface NotaCuadro {
  id: number;
  texto: string;
  creadaEn: string;
  autor: string | null;
}

export interface DetalleCuadro extends FilaCuadro {
  anticipos: AnticipoBomba[];
  listaNotas: NotaCuadro[];
}

export interface Bomba {
  id: number;
  nombre: string;
  ciudad: string | null;
  activa: boolean;
}

/**
 * Llamadas del cuadro pagos (/api/cuadro). Las que cambian algo devuelven el
 * viaje actualizado con sus anticipos y notas.
 */
export const apiCuadro = {
  /** Todos los viajes del cuadro. */
  listar: () => get<FilaCuadro[]>("/cuadro"),
  /** Un viaje con anticipos y notas. */
  obtener: (id: number) => get<DetalleCuadro>(`/cuadro/${id}`),
  /** Crea un viaje sin manifiesto. */
  crear: (datos: Record<string, unknown>) => post<DetalleCuadro>("/cuadro", datos),
  /** Guarda los campos enviados de un viaje. */
  actualizar: (id: number, datos: Record<string, unknown>) => put<DetalleCuadro>(`/cuadro/${id}`, datos),
  /** Borra un viaje creado a mano. */
  borrar: (id: number) => del<{ ok: true }>(`/cuadro/${id}`),
  /** Marca o quita la revision de contabilidad o de gerencia. */
  revisar: (id: number, quien: "CONTABILIDAD" | "GERENCIA", revisado: boolean) =>
    post<DetalleCuadro>(`/cuadro/${id}/revision`, { quien, revisado }),
  /** Asigna una factura (numero y fecha) a varios viajes. */
  facturar: (ids: number[], facturaNumero: string, facturaFecha: string) =>
    post<{ actualizados: number }>("/cuadro/facturar", { ids, facturaNumero, facturaFecha }),
  /** Agrega una nota al viaje. */
  agregarNota: (id: number, texto: string) => post<DetalleCuadro>(`/cuadro/${id}/notas`, { texto }),
  /** Borra una nota. */
  borrarNota: (id: number, notaId: number) => del<DetalleCuadro>(`/cuadro/${id}/notas/${notaId}`),
  /** Registra un anticipo de bomba. */
  agregarAnticipo: (id: number, datos: Record<string, unknown>) => post<DetalleCuadro>(`/cuadro/${id}/anticipos`, datos),
  /** Cambia la fecha de pago a la bomba o la nota de un anticipo. */
  actualizarAnticipo: (id: number, anticipoId: number, datos: Record<string, unknown>) =>
    put<DetalleCuadro>(`/cuadro/${id}/anticipos/${anticipoId}`, datos),
  /** Quita un anticipo. */
  borrarAnticipo: (id: number, anticipoId: number) => del<DetalleCuadro>(`/cuadro/${id}/anticipos/${anticipoId}`),
  /** Catalogo de bombas aliadas. */
  bombas: () => get<Bomba[]>("/cuadro/bombas"),
  /** Crea una bomba. */
  crearBomba: (datos: { nombre: string; ciudad: string }) => post<{ id: number }>("/cuadro/bombas", datos),
  /** Cambia nombre, ciudad o si esta activa; devuelve la lista. */
  actualizarBomba: (id: number, datos: Partial<Bomba>) => put<Bomba[]>(`/cuadro/bombas/${id}`, datos),
};
