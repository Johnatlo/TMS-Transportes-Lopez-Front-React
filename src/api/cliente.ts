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
  constructor(
    mensaje: string,
    public readonly estado: number,
    public readonly cuerpo: any
  ) {
    super(mensaje);
    this.name = "ErrorApi";
  }
}

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
    const mensaje =
      cuerpo?.mensajeError ?? cuerpo?.error ?? `Error ${respuesta.status} del servidor`;
    throw new ErrorApi(mensaje, respuesta.status, cuerpo);
  }
  return cuerpo as T;
}

const get = <T>(ruta: string) => pedir<T>(ruta);
const post = <T>(ruta: string, datos: unknown) =>
  pedir<T>(ruta, { method: "POST", body: JSON.stringify(datos) });
const put = <T>(ruta: string, datos: unknown) =>
  pedir<T>(ruta, { method: "PUT", body: JSON.stringify(datos) });
const del = <T>(ruta: string) => pedir<T>(ruta, { method: "DELETE" });

// ---------------------------------------------------------------------------
// Catalogo
// ---------------------------------------------------------------------------

export const api = {
  getVehiculos: () => get<Vehiculo[]>("/catalogo/vehiculos"),
  crearVehiculo: (datos: Partial<Vehiculo>) =>
    post<Vehiculo>("/catalogo/vehiculos", datos),
  /** Lo que no se mande conserva su valor actual. */
  actualizarVehiculo: (id: number, datos: Partial<Vehiculo>) =>
    put<Vehiculo>(`/catalogo/vehiculos/${id}`, datos),

  // ---------- Empresas de monitoreo de flota ----------

  getEmpresasMonitoreo: () => get<EmpresaMonitoreo[]>("/catalogo/monitoreo"),
  crearEmpresaMonitoreo: (datos: { nit: string; nombre: string }) =>
    post<EmpresaMonitoreo>("/catalogo/monitoreo", datos),
  actualizarEmpresaMonitoreo: (id: number, datos: { nit?: string; nombre?: string }) =>
    put<EmpresaMonitoreo>(`/catalogo/monitoreo/${id}`, datos),
  eliminarEmpresaMonitoreo: (id: number) => del<void>(`/catalogo/monitoreo/${id}`),
  /** Proveedor de GPS por defecto de un vehiculo. */
  fijarMonitoreoVehiculo: (vehiculoId: number, nitMonitoreoFlota: string | null) =>
    put<Vehiculo>(`/catalogo/vehiculos/${vehiculoId}/monitoreo`, { nitMonitoreoFlota }),

  getConductores: () => get<Conductor[]>("/catalogo/conductores"),
  crearConductor: (datos: Partial<Conductor>) =>
    post<Conductor>("/catalogo/conductores", datos),
  actualizarConductor: (id: number, datos: Partial<Conductor>) =>
    put<Conductor>(`/catalogo/conductores/${id}`, datos),

  getRemolques: () => get<Remolque[]>("/catalogo/remolques"),
  crearRemolque: (datos: Partial<Remolque>) =>
    post<Remolque>("/catalogo/remolques", datos),
  actualizarRemolque: (id: number, datos: Partial<Remolque>) =>
    put<Remolque>(`/catalogo/remolques/${id}`, datos),

  getTerceros: () => get<Tercero[]>("/catalogo/terceros"),
  crearTercero: (datos: Partial<Tercero>) =>
    post<Tercero & { avisoCoordenada?: string | null }>("/catalogo/terceros", datos),
  actualizarTercero: (id: number, datos: Partial<Tercero>) =>
    put<Tercero & { avisoCoordenada?: string | null }>(`/catalogo/terceros/${id}`, datos),

  getPlantillas: () => get<PlantillaViaje[]>("/catalogo/plantillas"),
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

  getRutasConTarifas: () => get<RutaConTarifa[]>("/catalogo/tarifas/rutas"),

  previsualizarTarifa: (origen: string, destino: string) =>
    get<Array<{ id: number; nombre: string; valorFleteBase: number | null }>>(
      `/catalogo/tarifas/previsualizar?origen=${origen}&destino=${destino}`
    ),

  actualizarTarifaRuta: (origen: string, destino: string, valorFleteBase: number) =>
    put<{ actualizadas: number; valorFleteBase: number }>("/catalogo/tarifas", {
      origen,
      destino,
      valorFleteBase,
    }),

  // ---------- Alertas y parametros ----------

  getAlertas: (dias = 30) => get<ResumenAlertas>(`/catalogo/alertas?dias=${dias}`),

  getParametros: () => get<ParametrosEmpresa>("/catalogo/parametros"),
  guardarParametros: (datos: Partial<ParametrosEmpresa>) =>
    put<ParametrosEmpresa>("/catalogo/parametros", datos),

  // ---------- Despacho ----------

  despachar: (datos: PeticionDespacho) => post<Viaje>("/despacho", datos),

  getHistorial: () => get<Viaje[]>("/despacho/historial"),

  /** Siguiente numero disponible. Es una sugerencia, no una reserva. */
  getSiguienteConsecutivo: () => get<{ base: string }>("/despacho/siguiente-consecutivo"),

  getRemesasDeViaje: (viajeId: number) =>
    get<ViajeRemesa[]>(`/despacho/${viajeId}/remesas`),

  /** FOPAT causado y pendiente de pago, por mes. */
  getResumenFopat: () =>
    get<Array<{ mes: string; manifiestos: number; causado: number; pendiente: number }>>(
      "/despacho/fopat"
    ),

  // ---------- Documentos para imprimir ----------
  // Son URL y no peticiones: se abren en otra pestaña para que el navegador
  // muestre el PDF con su propio visor.

  urlPdfManifiesto: (viajeId: number) => `${BASE}/despacho/${viajeId}/manifiesto.pdf`,
  urlImprimirRemesa: (remesaId: number) => `${BASE}/despacho/remesas/${remesaId}/imprimir`,
};

// ---------------------------------------------------------------------------
// Ayudas de presentacion
// ---------------------------------------------------------------------------

const FORMATO_MONEDA = new Intl.NumberFormat("es-CO");

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
