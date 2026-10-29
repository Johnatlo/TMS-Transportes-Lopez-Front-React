/**
 * Tipos del dominio, espejo de los del backend.
 *
 * Son los mismos que tenia el servicio de Angular: no dependen del framework,
 * asi que pasan tal cual. Cuando cambie una interfaz en `backend/src/repo.ts`
 * hay que reflejarla aqui.
 *
 * Las fechas llegan como string porque viajan en JSON. Se convierten a Date
 * solo donde hagan falta, no al recibirlas.
 */

/**
 * Ultimo registro en el RNDC de un tercero, conductor, vehiculo o remolque
 * (procesos 11 y 12, ver backend src/rndc/maestros.ts).
 */
export interface RegistroRndc {
  /** Radicado del ultimo registro aceptado. */
  rndcRadicado?: string | null;
  /** Cuando se registro. */
  rndcEn?: string | null;
  /** Mensaje del RNDC si el ultimo intento fue rechazado. */
  rndcError?: string | null;
}

/** Respuesta de registrar un maestro en el RNDC. */
export interface ResultadoRegistroRndc {
  ok: boolean;
  radicado: string | null;
  /** El RNDC ya tenia exactamente esos datos. */
  yaEstabaIgual: boolean;
  error: string | null;
  /** Lo que no se envio y por que (ej. un telefono de 7 digitos). */
  avisos?: string[];
}

export interface Remolque extends RegistroRndc {
  id: number;
  placa: string;
  numEjes: number | null;
  capacidadKg: number | null;
  fechaVencSoat: string | null;
  fechaVencTecnomecanica: string | null;
  activo: boolean;
}

export interface Vehiculo extends RegistroRndc {
  id: number;
  placa: string;
  placaRemolque: string | null;
  marca: string | null;
  configuracion: string | null;
  capacidadKg: number | null;
  fechaVencSoat: string | null;
  fechaVencTecnomecanica: string | null;
  activo: boolean;
  codTipoIdTenedor: string;
  /** Titular del manifiesto: a quien se le paga el flete. */
  numIdTenedor: string | null;
  codTipoCarroceria: string;
  pesoVehiculoVacio: number | null;
  /** true si el PBV supera 10.5 t: el manifiesto debe llevar aporte FOPAT. */
  aplicaFopat: boolean;
  /** Proveedor de GPS por defecto del vehiculo (NIT de la EMF). */
  nitMonitoreoFlota: string | null;
  /** Flota propia (LOPEZ o MYC) o TERCERO. */
  flota?: "LOPEZ" | "MYC" | "TERCERO";
  /** Socio dueno (MAURICIO, CELSO, MILLER o LUISA) para separar la cartera; null = tercero. */
  dueno?: string | null;
  /** Propietario segun la tarjeta de propiedad. Informativo. */
  propietarioNit: string | null;
  /** Nombre del titular del manifiesto. Informativo: no viaja al RNDC. */
  nombreTenedor: string | null;
  /** Cedula del conductor que suele manejarlo (sugerencia del despacho). */
  cedulaConductorHabitual: string | null;
  /** Link de la plataforma GPS de este vehiculo (si no, el de su empresa de monitoreo). */
  gpsUrl?: string | null;
  /** Usuario de la plataforma GPS. */
  gpsUsuario?: string | null;
  /** Si tiene clave del GPS guardada (la clave solo llega con getAccesoGps). */
  gpsTieneClave?: boolean;
}

/** Como entrar a la plataforma GPS de un vehiculo (GET /vehiculos/:id/gps). */
export interface AccesoGps {
  placa: string;
  /** Empresa de monitoreo del vehiculo. */
  proveedor: string | null;
  url: string | null;
  usuario: string | null;
  clave: string | null;
  /** Si la clave guardada no se pudo leer (falta la llave de cifrado...). */
  aviso: string | null;
}

/** Remolque y conductor sugeridos para un vehiculo, con el porque. */
export interface SugerenciaVehiculo {
  remolque: { id: number; origen: string } | null;
  conductor: { id: number; origen: string } | null;
}

/** Empresa de monitoreo de flota registrada en el RNDC. */
export interface EmpresaMonitoreo {
  id: number;
  /** Lo que viaja en NITMONITOREOFLOTA. */
  nit: string;
  nombre: string;
  /** Link de la plataforma GPS del proveedor. */
  urlPlataforma?: string | null;
}

export interface Conductor extends RegistroRndc {
  id: number;
  cedula: string;
  nombre: string;
  licencia: string | null;
  categoriaLicencia: string | null;
  fechaVencLicencia: string | null;
  activo: boolean;
  codTipoId: string;
  /** Direccion y municipio: el RNDC los exige para registrarlo como tercero. */
  direccion?: string | null;
  ciudad?: string | null;
  codMunicipioRndc?: string | null;
}

export interface Tercero extends RegistroRndc {
  id: number;
  nit: string;
  nombre: string;
  direccion: string | null;
  ciudad: string | null;
  telefono: string | null;
  rol: string | null;
  codTipoId: string;
  codSede: string;
  /** Coordenadas de la sede, copiadas del maestro de terceros del RNDC. */
  latitud: number | null;
  longitud: number | null;
  /**
   * Codigo DIVIPOLA del municipio de la sede. Precarga la ruta de la plantilla
   * y sirve para validar que la ruta calce con los sitios de cargue/descargue.
   */
  codMunicipioRndc: string | null;
  /** Nombre de la sede en el RNDC (obligatorio con NIT). */
  nombreSede?: string | null;
}

/** Municipio del catalogo DIVIPOLA. */
export interface Municipio {
  /** 8 digitos: 5 del municipio + 3 del centro poblado (000 = cabecera). */
  codigo: string;
  nombre: string;
  departamento: string | null;
}

export interface PlantillaViaje {
  id: number;
  nombre: string;
  contratanteId: number;
  remitenteId: number;
  destinatarioId: number;
  /**
   * Ruta del viaje (DIVIPOLA, 8 digitos). Dato propio de la plantilla: se
   * precarga con el municipio del remitente y del destinatario, pero se puede
   * cambiar. Con este par se consultan las vias a SICETAC.
   */
  municipioOrigen: string | null;
  municipioDestino: string | null;
  tipoMercancia: string | null;
  /** Tarifa pactada para la ruta. Se precarga en el despacho. */
  valorFleteBase: number | null;
  fleteActualizadoEn: string | null;
  contratante: Tercero;
  remitente: Tercero;
  destinatario: Tercero;
  tipoOperacionRemesa: string;
  /** G=General, W=Vacio, I=Ida y regreso, M=Multiparada, U=Urbano, D=Varios viajes/dia */
  tipoManifiesto: string;
  codMunicipioIntermedio: string | null;
  codNaturalezaCarga: string;
  codUnidadMedida: string;
  codTipoEmpaque: string;
  codMercancia: string | null;
  subpartidaCode: string | null;
  codigoArancelCode: string | null;
  empaquePrimario: string | null;
  unidadMedidaProducto: string;
  horasPactoCargue: number;
  minutosPactoCargue: number;
  horasPactoDescargue: number;
  minutosPactoDescargue: number;
  /** Factor de ICA (por mil) del municipio de cargue. */
  factorIcaCargue: number;
  retencionIcaManifiesto: number;
  codResponsablePagoCargue: string;
  codResponsablePagoDescargue: string;
  aceptacionElectronica: string;
  codMunicipioPagoSaldo: string | null;
  tarifaRetencionFuente: number;
  titularEsRegimenSimple: boolean;
}

export interface Viaje {
  id: number;
  /** Plantilla de la primera remesa: de ella sale la ruta del viaje. null en los viajes del portal. */
  plantillaId: number | null;
  /** null si el vehiculo o el conductor de un viaje del portal no estan en el catalogo. */
  vehiculoId: number | null;
  conductorId: number | null;
  /** TMS: despachado desde el sistema. PORTAL: expedido en el portal del RNDC (lo trae la sincronizacion). */
  origen?: "TMS" | "PORTAL";
  /** Placa, cedula del conductor y remolque como los reporta el RNDC (viajes del portal). */
  placaRndc?: string | null;
  conductorRndc?: string | null;
  remolqueRndc?: string | null;
  conductor2Id: number | null;
  remolqueId: number | null;
  fechaHoraCargue: string;
  fechaHoraDescargue: string | null;
  estado: string;
  numeroRemesaRndc: string | null;
  numeroManifiestoRndc: string | null;
  /** Se imprimio un manifiesto de contingencia (y por que); null cuando ya se imprimio el oficial. */
  contingenciaEn?: string | null;
  contingenciaMotivo?: string | null;
  consecutivoRemesa: string | null;
  consecutivoManifiesto: string | null;
  mensajeError: string | null;
  /** Codigo de error del RNDC (ej. "REM112"), para soporte. */
  codigoError: string | null;
  errorCrudo: string | null;
  /** Avisos no bloqueantes (ej. manifiesto tardio). Separados por " | ". */
  avisos: string | null;
  fechaCreacion: string;
  valorFleteReal: number | null;
  valorAnticipoManifiesto: number;
  /** FOPAT efectivamente reportado en el manifiesto. */
  retencionFopat: number | null;
  fopatPagado: boolean;
  fechaPagoFopat: string | null;
  fechaPagoSaldo: string | null;
  codVia: string | null;
  nitMonitoreoFlota: string | null;
  viajesDia: number | null;
  vacio1Origen: string | null;
  vacio1Destino: string | null;
  vacio1Valor: number;
  vacio2Origen: string | null;
  vacio2Destino: string | null;
  vacio2Valor: number;
  /** Anulacion (procesos 54, 32 y 9). */
  motivoAnulacion: string | null;
  observacionesAnulacion: string | null;
  /** Radicado del RNDC de la anulacion del manifiesto. */
  radicadoAnulacion: string | null;
  fechaAnulacion: string | null;
  /**
   * Auditoria: quien expidio y quien anulo el viaje. Los viajes anteriores al
   * login no tienen usuario (llegan nulos).
   */
  creadoPorNombre?: string | null;
  anuladoPorNombre?: string | null;
  /** Cumplido del manifiesto (proceso 6). */
  radicadoCumplido?: string | null;
  /** Anulacion del cumplido del manifiesto (proceso 29), al anular un viaje cumplido. */
  radicadoAnulacionCumplidoManifiesto?: string | null;
  fechaCumplido?: string | null;
  cumplidoPorNombre?: string | null;
  /** Solo en el historial, para manifiestos vigentes sin cumplir. */
  plazoCumplido?: PlazoCumplido;
}

/** Vista previa de una anulacion: pasos, motivos y tope mensual. */
export interface PreviaAnulacion {
  anulable: boolean;
  estado: string;
  pasos: string[];
  /** true si nada quedo creado en el RNDC: solo se marca como anulado aqui. */
  soloLocal: boolean;
  tope: { expedidos: number; anulados: number; porcentaje: number; maximo: number } | null;
  motivos: {
    manifiesto: Record<string, string>;
    cumplido: Record<string, string>;
    remesa: Record<string, string>;
  };
}

/** Una carga del viaje. Un manifiesto ampara hasta 5. */
export interface ViajeRemesa {
  id: number;
  viajeId: number;
  /** null en las remesas expedidas en el portal del RNDC. */
  plantillaId: number | null;
  /** Radicado del cumplido inicial del GPS (proceso 45), si existe. */
  radicadoCumplidoInicial?: string | null;
  orden: number;
  consecutivoRemesa: string | null;
  numeroRemesaRndc: string | null;
  pesoReal: number | null;
  cantidadReal: number | null;
  fechaHoraCargue: string;
  fechaHoraDescargue: string;
  ordenServicioGenerador: string | null;
  valorFleteRemesa: number | null;
  estado: string;
  mensajeError: string | null;
  /** Radicados de anulacion del cumplido inicial (54) y de la remesa (9). */
  radicadoAnulacionCumplido: string | null;
  radicadoAnulacion: string | null;
  /** Cumplido (proceso 5): kilos entregados, entradas reales y radicado. */
  cantidadEntregada: number | null;
  entradaCargue: string | null;
  entradaDescargue: string | null;
  llegadaCargue?: string | null;
  salidaCargue?: string | null;
  llegadaDescargue?: string | null;
  salidaDescargue?: string | null;
  radicadoCumplido: string | null;
  /** Anulacion del cumplido de la remesa (proceso 28). */
  radicadoAnulacionCumplidoRemesa?: string | null;
  fechaCumplido: string | null;
}

/**
 * Todo lo que un viaje envia (o enviaria) al RNDC, etiqueta por etiqueta.
 * Llega en cada error de despacho o reintento, y en GET /despacho/:id/datos-rndc.
 */
export interface DatosRndc {
  manifiesto: Record<string, unknown> | null;
  errorManifiesto: string | null;
  remesas: Array<{
    consecutivo: string | null;
    estado: string;
    radicado: string | null;
    mensajeError: string | null;
    datos: Record<string, unknown> | null;
    error: string | null;
  }>;
  via: { codVia: string; descripcion: string; pisoSicetac: number | null } | null;
  rutaVias: { origen: string; destino: string } | null;
  valorFlete: number | null;
}

/** Plazo del cumplido: 5 dias habiles desde la entrega (sin contar festivos). */
export interface PlazoCumplido {
  diasHabilesTranscurridos: number;
  diasHabilesRestantes: number;
  vencido: boolean;
}

export interface ParametrosEmpresa {
  tomadorPolizaCarga: string;
  numeroPolizaTransporte: string | null;
  companiaSeguro: string | null;
  fechaVencimientoPolizaCarga: string | null;
  /** Si toda la flota supera 10.5 t, el manifiesto siempre lleva FOPAT. */
  aplicaFopat: boolean;
  tarifaRetencionFuente: number;
  actualizadoEn: string | null;
  /** Del .env del backend, solo lectura. */
  nitEmpresa?: string;
  nombreEmpresa?: string;
  ambienteRndc?: string;
  /** Aviso si la poliza esta vencida o por vencerse. */
  avisoPoliza?: string | null;
}

export interface Via {
  codVia: string;
  descripcion: string;
  /** Piso tarifario: movilizacion mas las horas pactadas. */
  valorSicetac: number | null;
  esEstandar: boolean;
  kilometros?: number | null;
  valorMoviliza?: number | null;
  valorHora?: number | null;
}

export interface RespuestaViasSicetac {
  vias: Via[];
  /** Periodo de SICETAC que finalmente trajo datos. */
  periodoUsado?: string | null;
  periodosSinDatos?: string[];
  /** true si el servicio no respondio y se usaron valores guardados. */
  desdeCache?: boolean;
  error?: string;
}

export interface AlertaDocumento {
  tipo: "SOAT" | "TECNOMECANICA" | "LICENCIA" | "POLIZA";
  sujeto: string;
  identificacion: string | null;
  fechaVencimiento: string | null;
  /** Negativo si ya vencio. */
  diasRestantes: number | null;
  severidad: "VENCIDO" | "POR_VENCER" | "VIGENTE";
  mensaje: string;
  /** Registro y campo de donde sale la fecha: permite corregirla desde la alerta. */
  origen: OrigenAlerta;
  /** false si el registro esta inactivo (solo llegan al pedir inactivos). */
  activo: boolean;
}

export interface OrigenAlerta {
  entidad: "vehiculo" | "remolque" | "conductor" | "empresa";
  /** null para la empresa (una sola fila de parametros). */
  id: number | null;
  campo: "fechaVencSoat" | "fechaVencTecnomecanica" | "fechaVencLicencia" | "fechaVencimientoPolizaCarga";
}

export interface ResumenAlertas {
  vencidos: AlertaDocumento[];
  porVencer: AlertaDocumento[];
  sinFecha: AlertaDocumento[];
  diasAviso: number;
  revisados: { vehiculos: number; conductores: number };
  incluyeInactivos: boolean;
}

export interface RutaConTarifa {
  codMunicipioOrigen: string;
  codMunicipioDestino: string;
  municipioOrigen: string;
  municipioDestino: string;
  plantillas: number;
  fleteMinimo: number | null;
  fleteMaximo: number | null;
  sinTarifa: number;
  ultimaActualizacion: string | null;
}

/** Una carga dentro de la peticion de despacho. */
export interface RemesaADespachar {
  plantillaId: number;
  fechaHoraCargue: string;
  fechaHoraDescargue: string;
  pesoReal?: number;
  cantidadReal?: number;
  ordenServicioGenerador?: string;
  valorFleteRemesa?: number;
}

export interface PeticionDespacho {
  vehiculoId: number;
  conductorId: number;
  /** null: vehiculo rigido, sin remolque. */
  remolqueId: number | null;
  conductor2Id?: number;
  /** Una entrada por cada cliente o parada del viaje. Maximo 5. */
  remesas: RemesaADespachar[];
  /** Plantilla que aporta los terminos del manifiesto (la de la primera carga). */
  plantillaId?: number;
  /**
   * Numero base del viaje: el manifiesto lo usa tal cual y las remesas
   * adicionales le agregan letra. Vacio = el backend sugiere el siguiente.
   */
  consecutivoBase?: string;
  valorFleteReal?: number;
  valorAnticipoManifiesto?: number;
  /** Si va vacio, el backend calcula el 0.1%. */
  retencionFopat?: number;
  /** Via elegida. Vacia = el RNDC asigna la estandar de SICETAC. */
  codVia?: string;
  /** Empresa de monitoreo del viaje. Vacia = la del vehiculo. */
  nitMonitoreoFlota?: string;
  fechaPagoSaldo?: string;
  viajesDia?: number;
  vacio1Origen?: string;
  vacio1Destino?: string;
  vacio1Valor?: number;
  vacio2Origen?: string;
  vacio2Destino?: string;
  vacio2Valor?: number;
}

/** Usuario del sistema. Por ahora sin roles: todos pueden todo. */
export interface Usuario {
  id: number;
  email: string;
  nombre: string;
  activo: boolean;
  /** Entro con una clave temporal: debe cambiarla antes de seguir. */
  debeCambiarClave: boolean;
  ultimoAcceso: string | null;
  creadoEn: string;
}
