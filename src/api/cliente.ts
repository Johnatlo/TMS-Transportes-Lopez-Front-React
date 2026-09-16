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

// ---------------------------------------------------------------------------
// Catalogo
// ---------------------------------------------------------------------------

export const api = {
  getVehiculos: () => get<Vehiculo[]>("/catalogo/vehiculos"),
  crearVehiculo: (datos: Partial<Vehiculo>) =>
    post<Vehiculo>("/catalogo/vehiculos", datos),

  getConductores: () => get<Conductor[]>("/catalogo/conductores"),
  crearConductor: (datos: Partial<Conductor>) =>
    post<Conductor>("/catalogo/conductores", datos),

  getRemolques: () => get<Remolque[]>("/catalogo/remolques"),
  crearRemolque: (datos: Partial<Remolque>) =>
    post<Remolque>("/catalogo/remolques", datos),

  getTerceros: () => get<Tercero[]>("/catalogo/terceros"),
  crearTercero: (datos: Partial<Tercero>) =>
    post<Tercero & { avisoCoordenada?: string | null }>("/catalogo/terceros", datos),

  getPlantillas: () => get<PlantillaViaje[]>("/catalogo/plantillas"),
  crearPlantilla: (datos: Partial<PlantillaViaje>) =>
    post<PlantillaViaje>("/catalogo/plantillas", datos),

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
