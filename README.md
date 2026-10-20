# TMS Transportes López — Frontend

Aplicación web del TMS de **Transportes López C S.A.S.**, hecha en **React +
TypeScript** con **Vite**. Es la pantalla con la que se despachan los viajes
ante el RNDC, se cumplen y anulan, se lleva el **Cuadro pagos** y se
administran los catálogos y los usuarios. Toda la lógica de negocio y la
comunicación con el RNDC están en el backend; el frontend llama a su API.

> **Documentación relacionada**
> - [`../backend/README.md`](../backend/README.md): API, flujos con el RNDC y modelo de datos.
> - [`GUIA-UI.md`](GUIA-UI.md): guía visual (colores, fuentes, tablas, botones).
> - [`PRUEBAS.md`](PRUEBAS.md): pruebas unitarias.
> - Cada función y componente tiene un comentario que explica qué hace y cómo;
>   la [sección 8](#8-referencia-de-funciones-y-componentes) los reúne todos.

## Contenido

1. [Pantallas](#1-pantallas)
2. [Tecnologías](#2-tecnologías)
3. [Cómo correrlo](#3-cómo-correrlo)
4. [Estructura del código](#4-estructura-del-código)
5. [Cómo está hecho](#5-cómo-está-hecho)
6. [Componentes compartidos](#6-componentes-compartidos)
7. [Compilar y desplegar](#7-compilar-y-desplegar)
8. [Referencia de funciones y componentes](#8-referencia-de-funciones-y-componentes)

---

## 1. Pantallas

| Menú | Archivo | Para qué sirve |
|---|---|---|
| **Inicio** | `paginas/Dashboard.tsx` | Indicadores, documentos más urgentes, viajes de hoy, últimos viajes, viajes por semana y mapa de seguimiento (posición estimada). |
| **Despachar** | `paginas/Despacho.tsx` | Asistente de tres pasos (vehículo y conductor, cargas, valores) que expide remesas y manifiesto en el RNDC. También corrige y reintenta un viaje fallido (`/despacho?viaje=N`). |
| **Viajes** | `paginas/Historial.tsx` | Todos los despachos con su estado y plazo del cumplido, y sus acciones: imprimir, cumplir, corregir y reintentar, anular. Vista "Consecutivos manifiestos y remesas" (una fila por remesa). Clic en una fila: todo lo registrado al despachar. |
| **Cuadro pagos** | `paginas/cuadro/CuadroCentral.tsx` | Seguimiento de cada viaje, con o sin manifiesto: papeles, radicación, factura, anticipos de bomba, pago al dueño, revisiones y notas. Reemplaza la hoja de Excel "CUADRO CENTRAL". |
| **Plantillas** | `paginas/Plantillas.tsx` | Plantillas de viaje (cliente, ruta, mercancía, tiempos y flete) y actualización de tarifas por ruta. |
| **Clientes**, **Flota**, **Conductores**, **Configuración** | `paginas/Catalogo.tsx` | Catálogos: terceros; vehículos (flota López/MYC o tercero), remolques y empresas de monitoreo; conductores; parámetros de la empresa. |
| **Usuarios** | `paginas/Usuarios.tsx` | Crear usuarios, activarlos o desactivarlos y restablecer su clave. |
| (sin sesión) | `paginas/Login.tsx` | Inicio de sesión y recuperación de contraseña por código al correo. |

**Ventanas principales:**

| Ventana | Archivo | Qué hace |
|---|---|---|
| Cumplir viaje | `componentes/CumplirViaje.tsx` | Cumple cada remesa (tiempos del GPS puestos y editables) y el manifiesto con el piso SICETAC del cumplido. Adopta lo cumplido en el portal. |
| Anular viaje | `componentes/AnularViaje.tsx` | Muestra qué se anulará y en qué orden, pide los motivos y muestra los radicados. |
| Corregir y reintentar | `componentes/ReintentarViaje.tsx` | Explica el error y deja corregir los datos del manifiesto antes de reenviar. |
| Documentos del viaje | `componentes/DocumentosViaje.tsx` | PDF oficial del manifiesto (con o sin logo) y remesas imprimibles. |
| Detalle del viaje | `componentes/DetalleViaje.tsx` | Todo lo registrado al despachar, de solo lectura. |
| Datos enviados al RNDC | `componentes/DatosRndc.tsx` | Los datos exactos del manifiesto y de cada remesa tal como van al RNDC. |
| Alertas de documentos | `componentes/AlertasDocumentos.tsx` | Documentos vencidos o por vencer, con la fecha editable en la misma fila. |
| Detalle del cuadro | `paginas/cuadro/DetalleCuadro.tsx` | Un viaje del cuadro pagos completo. |

---

## 2. Tecnologías

| Uso | Tecnología |
|---|---|
| Interfaz | React 18 con TypeScript |
| Compilación y servidor de desarrollo | Vite |
| Navegación | React Router 6 |
| Mapa | Leaflet |
| Pruebas | Vitest |
| Estilos | CSS propio (`estilos.css` + `tema.css`, ver `GUIA-UI.md`) |

---

## 3. Cómo correrlo

```bash
cd frontend-react
npm install
npm run dev        # http://localhost:4200
```

El backend debe estar corriendo en el puerto 3000. Vite reenvía `/api` hacia
allá (`vite.config.ts`), así que en desarrollo no hay CORS de por medio.

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga al guardar |
| `npm run build` | Revisa los tipos (`tsc -b`) y compila a `dist/` |
| `npm run preview` | Sirve `dist/` en local para probar el build |
| `npm test` / `npm run test:watch` | Pruebas unitarias |
| `npm run docs` | Regenera la sección 8 de este README desde los comentarios del código |

---

## 4. Estructura del código

```
frontend-react/src/
├── main.tsx               Arranque: React, enrutador, sesión y estilos
├── App.tsx                Login / cambio de clave / marco y rutas (cada pantalla se carga al abrirla)
├── api/
│   ├── cliente.ts         Todas las llamadas a la API y los formatos (moneda, fechas)
│   ├── tipos.ts           Tipos de datos (espejo de los del backend)
│   └── mercancias.ts      Códigos de mercancía más usados
├── ganchos/
│   ├── useDatos.ts        Cargar datos con estados de carga, error y recarga
│   ├── useSesion.tsx      Sesión del usuario (contexto)
│   └── useMunicipios.ts   Municipios para buscar por nombre
├── componentes/           Piezas compartidas y ventanas (sección 6 y tabla de ventanas)
├── paginas/               Una pantalla por archivo (sección 1)
│   ├── cuadro/            Cuadro pagos: pantalla, detalle, ventanas y estados
│   └── estadosViaje.ts    Nombres y colores de los estados del viaje
├── estilos.css, tema.css  Estilos (tema.css redefine colores y fuentes)
└── **/*.test.ts           Pruebas unitarias
herramientas/
└── generar-referencia.cjs Regenera la sección 8 de este README
```

---

## 5. Cómo está hecho

Conceptos de React que se repiten en todo el código:

- **Cargar datos:** `useDatos(() => api.getAlgo(), [dependencias])` devuelve
  `{ datos, cargando, error, recargar }`. Las pantallas muestran
  `<Cargando />` o `<ErrorCarga />` mientras tanto.
- **Promesas, no observables:** cada llamada de `api` devuelve una Promise y se
  usa con `await`. Si el backend responde con error, se lanza `ErrorApi` con
  el mensaje y el cuerpo completo (por ejemplo, el viaje con el error del RNDC).
- **No se muta el estado:** para cambiar una lista se crea una nueva
  (`setRemesas(remesas.map(...))`); mutarla no redibuja la pantalla.
- **Cálculos en el cuerpo del componente:** un total se calcula con una
  constante antes del `return` y se recalcula en cada render.
- **Sesión:** la cookie la maneja el navegador. Si el backend responde que la
  sesión venció, `cliente.ts` dispara un evento y la aplicación vuelve al login.
- **Fechas:** todo se muestra en hora de Colombia, sin importar la zona del
  equipo. Las fechas sin hora (columnas DATE) se muestran tal cual, sin pasar
  por la zona horaria, para que no se corran un día.
- **Carga por pantalla:** cada página se descarga la primera vez que se abre
  (`React.lazy` en `App.tsx`); mientras tanto el menú sigue visible.

---

## 6. Componentes compartidos

| Componente | Archivo | Uso |
|---|---|---|
| `TablaDatos` | `componentes/TablaDatos.tsx` | Todo listado: pestañas con contador, buscador sin tildes, filtros por columna, orden, páginas de 50 y exportar a CSV. |
| `Pastilla` | `componentes/TablaDatos.tsx` | Estado con color (incluye los colores del cuadro pagos). |
| `Modal` | `componentes/Modal.tsx` | Ventana: se cierra con la X o Escape (no con clic fuera), se maximiza o cambia de tamaño. |
| `ComboBuscable` | `componentes/ComboBuscable.tsx` | Lista desplegable con buscador para muchos registros. |
| `FormularioGenerico` | `componentes/FormularioGenerico.tsx` | Formularios de catálogo a partir de una lista de campos. |
| `Cargando`, `ErrorCarga`, `Vacio`, `Avisos` | `componentes/Estado.tsx` | Mensajes de carga, error, lista vacía y avisos. |
| `Shell` | `componentes/Shell.tsx` | Marco con menú lateral y barra superior. |
| `PantallaAcceso` | `componentes/PantallaAcceso.tsx` | Marco de las pantallas sin sesión. |
| `MapaSeguimiento` | `componentes/MapaSeguimiento.tsx` | Mapa con la posición estimada de los vehículos en camino. |
| Iconos | `componentes/Iconos.tsx` | Íconos SVG del menú y la barra. |

---

## 7. Compilar y desplegar

```bash
npm run build                                          # genera dist/
scp -r dist root@<servidor>:/opt/frontend-react/dist-nuevo
```

En el servidor se respalda la versión actual, se vacía `dist` y se copia
**adentro** la nueva (no se renombran carpetas: Caddy está pegado a esa
carpeta exacta). Los pasos completos están en `../backend/DEPLOY.md`.

---

## 8. Referencia de funciones y componentes

Generada a partir de los comentarios del código con `npm run docs`. Cada
entrada indica la firma, el tipo (función, componente, método) y qué hace y
cómo.

<!-- REFERENCIA:INICIO -->
_375 funciones, componentes, métodos y rutas en 54 archivos._

- [`src/App.tsx`](#srcapptsx) (1)
- [`src/api/cliente.ts`](#srcapiclientets) (132)
- [`src/componentes/AccesoGps.tsx`](#srccomponentesaccesogpstsx) (3)
- [`src/componentes/AlertasDocumentos.tsx`](#srccomponentesalertasdocumentostsx) (4)
- [`src/componentes/AlertasSeguimiento.tsx`](#srccomponentesalertasseguimientotsx) (2)
- [`src/componentes/AnularViaje.tsx`](#srccomponentesanularviajetsx) (3)
- [`src/componentes/CambiarClave.tsx`](#srccomponentescambiarclavetsx) (1)
- [`src/componentes/ComboBuscable.tsx`](#srccomponentescombobuscabletsx) (1)
- [`src/componentes/CumplirViaje.tsx`](#srccomponentescumplirviajetsx) (9)
- [`src/componentes/DetalleViaje.tsx`](#srccomponentesdetalleviajetsx) (3)
- [`src/componentes/DocumentosViaje.tsx`](#srccomponentesdocumentosviajetsx) (2)
- [`src/componentes/Estado.tsx`](#srccomponentesestadotsx) (4)
- [`src/componentes/EstadoSincronizacion.tsx`](#srccomponentesestadosincronizaciontsx) (3)
- [`src/componentes/FormularioGenerico.tsx`](#srccomponentesformulariogenericotsx) (2)
- [`src/componentes/Iconos.tsx`](#srccomponentesiconostsx) (24)
- [`src/componentes/Indicador.tsx`](#srccomponentesindicadortsx) (1)
- [`src/componentes/LibroConsecutivos.tsx`](#srccomponenteslibroconsecutivostsx) (6)
- [`src/componentes/MapaSeguimiento.tsx`](#srccomponentesmapaseguimientotsx) (2)
- [`src/componentes/Modal.tsx`](#srccomponentesmodaltsx) (1)
- [`src/componentes/PantallaAcceso.tsx`](#srccomponentespantallaaccesotsx) (1)
- [`src/componentes/ReintentarViaje.tsx`](#srccomponentesreintentarviajetsx) (3)
- [`src/componentes/Seccion.tsx`](#srccomponentessecciontsx) (1)
- [`src/componentes/Shell.tsx`](#srccomponentesshelltsx) (3)
- [`src/componentes/TablaDatos.tsx`](#srccomponentestabladatostsx) (7)
- [`src/ganchos/useAltoTabla.ts`](#srcganchosusealtotablats) (1)
- [`src/ganchos/useDatos.ts`](#srcganchosusedatosts) (1)
- [`src/ganchos/useMunicipios.ts`](#srcganchosusemunicipiosts) (1)
- [`src/ganchos/useSesion.tsx`](#srcganchosusesesiontsx) (2)
- [`src/paginas/Catalogo.tsx`](#srcpaginascatalogotsx) (21)
- [`src/paginas/Dashboard.tsx`](#srcpaginasdashboardtsx) (14)
- [`src/paginas/Despacho.tsx`](#srcpaginasdespachotsx) (5)
- [`src/paginas/FormularioPlantilla.tsx`](#srcpaginasformularioplantillatsx) (4)
- [`src/paginas/Historial.tsx`](#srcpaginashistorialtsx) (2)
- [`src/paginas/Login.tsx`](#srcpaginaslogintsx) (3)
- [`src/paginas/Plantillas.tsx`](#srcpaginasplantillastsx) (2)
- [`src/paginas/Usuarios.tsx`](#srcpaginasusuariostsx) (4)
- [`src/paginas/cuadro/CuadroAnticipos.tsx`](#srcpaginascuadrocuadroanticipostsx) (7)
- [`src/paginas/cuadro/CuadroCentral.tsx`](#srcpaginascuadrocuadrocentraltsx) (4)
- [`src/paginas/cuadro/DetalleCuadro.tsx`](#srcpaginascuadrodetallecuadrotsx) (6)
- [`src/paginas/cuadro/EnvioFacturacion.tsx`](#srcpaginascuadroenviofacturaciontsx) (3)
- [`src/paginas/cuadro/ImportarAnticipos.tsx`](#srcpaginascuadroimportaranticipostsx) (2)
- [`src/paginas/cuadro/PastillasEstado.tsx`](#srcpaginascuadropastillasestadotsx) (1)
- [`src/paginas/cuadro/VentanasCuadro.tsx`](#srcpaginascuadroventanascuadrotsx) (3)
- [`src/paginas/cuadro/estadosCuadro.ts`](#srcpaginascuadroestadoscuadrots) (7)
- [`src/paginas/cuadro/excelFacturacion.ts`](#srcpaginascuadroexcelfacturacionts) (7)
- [`src/paginas/cuadro/facturacion.ts`](#srcpaginascuadrofacturacionts) (21)
- [`src/paginas/estadosViaje.ts`](#srcpaginasestadosviajets) (1)
- [`src/paginas/seguimiento/AnticiposEmpresas.tsx`](#srcpaginasseguimientoanticiposempresastsx) (4)
- [`src/paginas/seguimiento/Cartera.tsx`](#srcpaginasseguimientocarteratsx) (5)
- [`src/paginas/seguimiento/ImportarCartera.tsx`](#srcpaginasseguimientoimportarcarteratsx) (3)
- [`src/paginas/seguimiento/PagoTerceros.tsx`](#srcpaginasseguimientopagotercerostsx) (5)
- [`src/paginas/seguimiento/Papeles.tsx`](#srcpaginasseguimientopapelestsx) (7)
- [`src/paginas/seguimiento/cargaExcel.ts`](#srcpaginasseguimientocargaexcelts) (8)
- [`src/paginas/seguimiento/liquidacionTerceros.ts`](#srcpaginasseguimientoliquidaciontercerosts) (2)

### `src/App.tsx`

> Raiz de la aplicacion: sin sesion muestra el login; con clave temporal, el
> cambio obligatorio de clave; con sesion, el marco (Shell) y las rutas de
> cada pantalla, que se descargan al abrirlas por primera vez (React.lazy).

- **`App()`** · _componente React_
  Clientes, Flota, Conductores y Configuracion son el mismo Catalogo con
  distintas pestanas. La `key` distinta hace que React monte uno nuevo al
  pasar de una seccion a otra: si no, reutilizaria el anterior y se quedaria
  con su pestana y su busqueda.

### `src/api/cliente.ts`

> Cliente de la API del backend.
>
> Reemplaza al ApiService de Angular. La diferencia de fondo: aqui cada
> funcion devuelve una Promise en vez de un Observable, asi que se consume con
> `await` y no con `.subscribe()`.
>
> Las URL son relativas (`/api/...`) y no absolutas a localhost:3000: el proxy
> de Vite las redirige al backend en desarrollo, y en produccion se sirven
> desde el mismo origen. Asi no hay que tocar CORS ni cambiar la URL al
> desplegar.

- **`ErrorApi`** · _clase_
  Error con el cuerpo que devolvio el backend.

  Importa conservarlo: cuando el RNDC rechaza un despacho, el backend responde
  422 con el viaje completo adentro (mensajeError, codigoError, avisos). Si se
  pierde ese cuerpo, la pantalla no puede explicar que paso.

  - **`ErrorApi.constructor(mensaje, estado, cuerpo)`** · _método_
    mensaje: texto para mostrar; estado: codigo HTTP (0 = sin conexion);
    cuerpo: la respuesta completa del backend (por ejemplo el viaje con su error).

- **`pedir(ruta, opciones)`** · _función_
  Hace una peticion a la API (/api + ruta) y devuelve el JSON de respuesta.

  Como funciona:
  1. fetch con Content-Type JSON; la cookie de sesion la manda el navegador.
  2. Sin conexion: ErrorApi con estado 0 y un mensaje claro.
  3. Respuesta vacia (204): devuelve null.
  4. Error HTTP: si es 401 por sesion vencida avisa a toda la aplicacion
     (EVENTO_SESION_VENCIDA, vuelve el login) y lanza ErrorApi con el mensaje
     del backend y el cuerpo completo.

- **`get(ruta)`** · _función_
  GET a la API.

- **`post(ruta, datos)`** · _función_
  POST a la API con el cuerpo en JSON.

- **`put(ruta, datos)`** · _función_
  PUT a la API con el cuerpo en JSON.

- **`del(ruta)`** · _función_
  DELETE a la API.

- **`auth`** · _módulo_
  Sesion y usuarios. La cookie de sesion la maneja el navegador solo.

  - **`auth.sesion()`** · _método_
    Usuario de la sesion actual (401 si no hay sesion).

  - **`auth.login(email, clave)`** · _método_
    Inicia sesion con correo y clave; el backend pone la cookie.

  - **`auth.logout()`** · _método_
    Cierra la sesion y borra la cookie.

  - **`auth.cambiarClave(actual, nueva)`** · _método_
    Cambia la clave propia (pide la actual).

  - **`auth.listarUsuarios()`** · _método_
    Usuarios del sistema.

  - **`auth.crearUsuario(email, nombre)`** · _método_
    La clave temporal se envia por correo. Solo si el correo no esta
    configurado o falla, llega en la respuesta (una sola vez).

  - **`auth.actualizarUsuario(id, datos)`** · _método_
    Cambia nombre y/o estado activo de un usuario.

  - **`auth.restablecerClave(id)`** · _método_
    Genera una clave temporal nueva para un usuario (por correo, o en la respuesta).

  - **`auth.recuperar(email)`** · _método_
    "Olvide mi contrasena": envia un codigo de 6 digitos al correo.

  - **`auth.confirmarRecuperacion(email, codigo, nueva)`** · _método_
    Crea la clave nueva con el codigo de 6 digitos que llego al correo.

- **`api`** · _módulo_
  Llamadas de catalogo, despacho, cumplidos e impresion. Cada una corresponde
  a una ruta del backend (/api/catalogo/... y /api/despacho/...).

  - **`api.getVehiculos()`** · _método_
    Vehiculos del catalogo (activos e inactivos; sin los eliminados).

  - **`api.crearVehiculo(datos)`** · _método_
    Crea un vehiculo (o recupera uno eliminado con la misma placa).

  - **`api.actualizarVehiculo(id, datos)`** · _método_
    Lo que no se mande conserva su valor actual.

  - **`api.eliminarVehiculo(id)`** · _método_
    Borrado logico: el vehiculo sale de todas las listas pero se conserva
    para los viajes que ya lo usaron. Crear otra vez la misma placa lo recupera.

  - **`api.getAccesoGps(id)`** · _método_
    Link, usuario y clave de la plataforma GPS del vehiculo (para ver la hora de salida del cargue).

  - **`api.getEmpresasMonitoreo()`** · _método_
    Empresas de monitoreo de flota (GPS) activas.

  - **`api.crearEmpresaMonitoreo(datos)`** · _método_
    Registra una empresa de monitoreo de flota (GPS).

  - **`api.actualizarEmpresaMonitoreo(id, datos)`** · _método_
    Cambia NIT y/o nombre de una empresa de monitoreo.

  - **`api.eliminarEmpresaMonitoreo(id)`** · _método_
    Desactiva una empresa de monitoreo.

  - **`api.fijarMonitoreoVehiculo(vehiculoId, nitMonitoreoFlota)`** · _método_
    Proveedor de GPS por defecto de un vehiculo.

  - **`api.getConductores()`** · _método_
    Conductores del catalogo.

  - **`api.crearConductor(datos)`** · _método_
    Crea un conductor.

  - **`api.actualizarConductor(id, datos)`** · _método_
    Edita un conductor; lo que no se mande no cambia.

  - **`api.getRemolques()`** · _método_
    Remolques del catalogo.

  - **`api.crearRemolque(datos)`** · _método_
    Crea un remolque.

  - **`api.actualizarRemolque(id, datos)`** · _método_
    Edita un remolque; lo que no se mande no cambia.

  - **`api.getTerceros()`** · _método_
    Clientes, remitentes y destinatarios.

  - **`api.crearTercero(datos)`** · _método_
    Crea un tercero. avisoCoordenada trae el problema de su coordenada, si hay.

  - **`api.actualizarTercero(id, datos)`** · _método_
    Edita un tercero. avisoCoordenada trae el problema de su coordenada, si hay.

  - **`api.registrarEnRndc(maestro, id)`** · _método_
    Crea o actualiza en el RNDC un tercero, conductor, vehiculo o remolque con
    los datos que tiene hoy el catalogo (procesos 11 y 12).

  - **`api.getPlantillas()`** · _método_
    Plantillas de viaje activas, con sus terceros.

  - **`api.crearPlantilla(datos)`** · _método_
    Crea una plantilla de viaje.

  - **`api.actualizarPlantilla(id, datos)`** · _método_
    Lo que no se mande conserva su valor actual.

  - **`api.eliminarPlantilla(id)`** · _método_
    "Elimina" (desactiva) una plantilla que ya no se usa.

  - **`api.getMunicipios()`** · _método_
    Catalogo DIVIPOLA. Vacio si aun no se importo el CSV de municipios.

  - **`api.getVias(origen, destino)`** · _método_
    Ultimo resultado guardado, sin consultar al Ministerio.

  - **`api.getViasSicetac(origen, destino, configuracion, horas)`** · _método_
    Vias consultadas en linea a SICETAC, con el piso de cada una.
    `horas` son las horas pactadas de cargue y descargue: entran en el piso.

  - **`api.getRutasConTarifas()`** · _método_
    Rutas de las plantillas activas con cuantas plantillas tiene cada una y su
    rango de tarifas: punto de partida para actualizar tarifas por ruta.

  - **`api.previsualizarTarifa(origen, destino)`** · _método_
    Plantillas que cambiarian al actualizar el flete base de una ruta, con su valor actual.

  - **`api.actualizarTarifaRuta(origen, destino, valorFleteBase)`** · _método_
    Fija el flete base de todas las plantillas de una ruta. Devuelve cuantas cambiaron.

  - **`api.getAlertas(dias, inactivos)`** · _método_
    `inactivos` agrega los documentos de vehiculos, remolques y conductores inactivos.

  - **`api.getParametros()`** · _método_
    Parametros de la empresa (poliza, retencion...) y aviso de vigencia de la poliza.

  - **`api.guardarParametros(datos)`** · _método_
    Guarda los parametros enviados; los demas no cambian.

  - **`api.despachar(datos)`** · _método_
    Despacha un viaje: el backend valida, expide las remesas y el manifiesto en
    el RNDC y devuelve el viaje (con su error si el RNDC lo rechazo).

  - **`api.getHistorial()`** · _método_
    Todos los viajes, con el plazo del cumplido de los que ya descargaron.

  - **`api.getConsecutivos()`** · _método_
    Libro de consecutivos: una fila por remesa, como la hoja de control.

  - **`api.getSincronizacion()`** · _método_
    Estado de la sincronizacion automatica con el RNDC (cada 10 minutos).

  - **`api.sincronizarRndc(completa)`** · _método_
    Sincroniza ya: los ultimos dias, o todo desde septiembre con completa=true.

  - **`api.getDetalleViaje(viajeId)`** · _método_
    Todo lo que se registro al despachar un viaje.

  - **`api.getSugerencias(vehiculoId)`** · _método_
    Remolque y conductor que suele usar el vehiculo (historial o catalogo).

  - **`api.getSiguienteConsecutivo()`** · _método_
    Siguiente numero de manifiesto disponible. Es una sugerencia, no una reserva.

  - **`api.reintentarViaje(viajeId, cambios)`** · _método_
    Retoma un viaje a medias: reutiliza las remesas ya creadas en el RNDC y
    envia lo que falte. `cambios` corrige datos del manifiesto (vehiculo,
    conductor, remolque, EMF, valores, numero). Si el RNDC vuelve a rechazar,
    lanza ErrorApi con el viaje actualizado en `cuerpo`.

  - **`api.getPreviaAnulacion(viajeId)`** · _método_
    Que se anularia y en que orden, con los motivos validos y el tope mensual.

  - **`api.anularViaje(viajeId, datos)`** · _método_
    Anula en el RNDC: cumplido inicial (54), manifiesto (32) y remesas (9).
    Si un paso falla, lanza ErrorApi con el viaje actualizado en `cuerpo`.

  - **`api.getRemesasDeViaje(viajeId)`** · _método_
    Remesas de un viaje, en orden.

  - **`api.getViaje(viajeId)`** · _método_
    Un viaje con sus remesas.

  - **`api.getDatosRndc(viajeId)`** · _método_
    Todo lo que el viaje envia al RNDC, sin enviar nada.

  - **`api.usarRemesaExistente(remesaId)`** · _método_
    El RNDC dijo "DUPLICADO": la remesa (o el manifiesto) ya existia de un
    intento anterior. Se toma ese radicado, despues de que la persona confirma
    que es el mismo documento.

  - **`api.usarManifiestoExistente(viajeId)`** · _método_
    Toma el radicado de un manifiesto que el RNDC reporto como ya existente.

  - **`api.cumplirRemesa(remesaId, datos)`** · _método_
    Cumplido normal de una remesa (proceso 5). Fechas en ISO.

  - **`api.getGpsRemesa(remesaId)`** · _método_
    Tiempos que ya reporto el GPS (cumplido inicial, proceso 45). En el
    formulario vienen puestos y se pueden corregir.

  - **`api.getCumplidoRemesa(remesaId)`** · _método_
    Lo que quedo registrado en el cumplido de una remesa (leido del RNDC).

  - **`api.anularCumplidoRemesa(remesaId, motivo, observaciones)`** · _método_
    Anula el cumplido de una remesa (proceso 28) para corregirlo.

  - **`api.getPreviaCumplidoManifiesto(viajeId)`** · _método_
    Valores de partida para la ventana de cumplido del manifiesto.

  - **`api.sincronizarCumplido(viajeId)`** · _método_
    Adopta los cumplidos hechos en el portal del RNDC (solo lectura alla).

  - **`api.cumplirManifiesto(viajeId, datos)`** · _método_
    Cumple el manifiesto (proceso 6) con la fecha de entrega, adicionales,
    descuentos y retenciones. Antes adopta lo cumplido en el portal; el RNDC
    exige todas las remesas cumplidas y lo dice con su error si falta alguna.

  - **`api.getResumenFopat()`** · _método_
    FOPAT causado y pendiente de pago, por mes.

  - **`api.urlPdfManifiesto(viajeId, original)`** · _método_
    PDF oficial del RNDC; por defecto con el logo de la empresa estampado.

  - **`api.urlImprimirRemesa(remesaId)`** · _método_
    Remesa imprimible (HTML con el formato oficial), para abrir en otra pestana.

- **`aInputLocal(fecha)`** · _función_
  Formato que entiende <input type="datetime-local">: YYYY-MM-DDTHH:mm.
  Se arma con los componentes locales y no con toISOString(), que convierte a
  UTC y en Colombia adelantaria el reloj cinco horas.

- **`moneda(valor)`** · _función_
  Valor en pesos con punto de miles (4.019.761); "-" sin valor.

- **`fechaHora(valor)`** · _función_
  Fecha para mostrar, en hora de Colombia.

  Se fija la zona a proposito: el backend guarda y entrega en UTC, y dejar que
  el navegador use la suya haria que un cargue de madrugada se viera con otra
  fecha segun donde este el equipo.

- **`soloDia(valor)`** · _función_
  Para columnas DATE (vencimientos de SOAT, tecnomecanica, licencia...).

  El backend las entrega como medianoche UTC ("2029-04-06T00:00:00.000Z").
  soloFecha() las pasa a hora de Bogota y quedaban UN DIA ANTES (05/04/2029).
  Aqui se lee el dia tal cual, sin zona horaria.

- **`hoyColombia()`** · _función_
  Hoy en Colombia como "AAAA-MM-DD", para comparar contra columnas DATE.

- **`soloFecha(valor)`** · _función_
  Solo la fecha (DD/MM/AAAA) de un instante, en hora de Colombia; "-" sin valor.

- **`radicadoDuplicado(texto)`** · _función_
  Radicado que el RNDC informa cuando un documento ya existe ("DUPLICADO:123").

- **`apiCuadro`** · _módulo_
  Llamadas del cuadro pagos (/api/cuadro). Las que cambian algo devuelven el
  viaje actualizado con sus anticipos y notas.

  - **`apiCuadro.listar()`** · _método_
    Todos los viajes del cuadro.

  - **`apiCuadro.obtener(id)`** · _método_
    Un viaje con anticipos y notas.

  - **`apiCuadro.crear(datos)`** · _método_
    Crea un viaje sin manifiesto.

  - **`apiCuadro.actualizar(id, datos)`** · _método_
    Guarda los campos enviados de un viaje.

  - **`apiCuadro.borrar(id)`** · _método_
    Borra un viaje creado a mano.

  - **`apiCuadro.revisar(id, quien, revisado)`** · _método_
    Marca o quita la revision de contabilidad o de gerencia.

  - **`apiCuadro.facturar(ids, facturaNumero, facturaFecha, facturaVence)`** · _método_
    Asigna una factura (numero y fecha) a varios viajes.

  - **`apiCuadro.agregarNota(id, texto)`** · _método_
    Agrega una nota al viaje.

  - **`apiCuadro.borrarNota(id, notaId)`** · _método_
    Borra una nota.

  - **`apiCuadro.agregarAnticipo(id, datos)`** · _método_
    Registra un anticipo de bomba.

  - **`apiCuadro.actualizarAnticipo(id, anticipoId, datos)`** · _método_
    Cambia la fecha de pago a la bomba o la nota de un anticipo.

  - **`apiCuadro.borrarAnticipo(id, anticipoId)`** · _método_
    Quita un anticipo.

  - **`apiCuadro.cuadroAnticipos()`** · _método_
    Cuadro de anticipos: todos los tramos (ida y vuelta), lo mas reciente primero.

  - **`apiCuadro.actualizarTramo(anticipoId, datos)`** · _método_
    Cambia fecha de pago, nota o viaje de un tramo; devuelve el cuadro de anticipos.

  - **`apiCuadro.resumenBomba()`** · _método_
    Cuentas con la bomba: deuda, pagado, abonado por el socio, pendiente y cupo disponible.

  - **`apiCuadro.guardarParametrosBomba(datos)`** · _método_
    Cambia el cupo con la bomba o el precio / descuento por galon sugeridos.

  - **`apiCuadro.abonosSocio()`** · _método_
    Abonos del socio a la bomba.

  - **`apiCuadro.registrarAbono(datos)`** · _método_
    Registra un abono del socio; devuelve todos.

  - **`apiCuadro.borrarAbono(id)`** · _método_
    Borra un abono del socio; devuelve los que quedan.

  - **`apiCuadro.actualizarTanqueo(tanqueoId, datos)`** · _método_
    Factura de la bomba (numero, fecha) o bomba de un tanqueo; devuelve el cuadro de anticipos.

  - **`apiCuadro.tarifas()`** · _método_
    La matriz de fletes.

  - **`apiCuadro.importarTarifas(tarifas)`** · _método_
    Reemplaza la matriz completa con la importada del Excel.

  - **`apiCuadro.actualizarTarifa(id, datos)`** · _método_
    Cambia una tarifa.

  - **`apiCuadro.porFacturar()`** · _método_
    Viajes listos para facturar y la ultima tarifa usada con cada cliente.

  - **`apiCuadro.enviarFacturacion(filas)`** · _método_
    Guarda en cada viaje lo que va en el cuadro de la contadora.

  - **`apiCuadro.previaAnticipos(filas)`** · _método_
    Propone el viaje de cada fila del Excel de anticipos (no guarda).

  - **`apiCuadro.importarAnticipos(filas)`** · _método_
    Carga los anticipos confirmados (cada fila con su viaje).

  - **`apiCuadro.bombas()`** · _método_
    Catalogo de bombas aliadas.

  - **`apiCuadro.crearBomba(datos)`** · _método_
    Crea una bomba.

  - **`apiCuadro.actualizarBomba(id, datos)`** · _método_
    Cambia nombre, ciudad o si esta activa; devuelve la lista.

- **`apiSeguimiento`** · _módulo_
  Llamadas de Seguimiento papeles, Cartera y la campana de seguimiento.

  - **`apiSeguimiento.alertas()`** · _método_
    Alertas de papeles, facturacion y cartera.

  - **`apiSeguimiento.papeles()`** · _método_
    Viajes sin factura con su alerta.

  - **`apiSeguimiento.registrarPapeles(id, datos)`** · _método_
    Registra lo que se supo de los papeles; devuelve el viaje del cuadro.

  - **`apiSeguimiento.cartera(dueno)`** · _método_
    Facturas por cobrar, totales por cliente y facturados sin datos (solo de un dueno, si se pide).

  - **`apiSeguimiento.anticiposEmpresas()`** · _método_
    Viajes con anticipo que da la empresa y lo que debe cada cliente.

  - **`apiSeguimiento.terceros()`** · _método_
    Viajes de vehiculos terceros con lo que se les paga, y el resumen por tercero.

  - **`apiSeguimiento.pagarTerceros(ids, fecha, cuentaCobro)`** · _método_
    Se le pago al tercero esos viajes (con el numero de su cuenta de cobro, si se escribe).

  - **`apiSeguimiento.pagarAnticiposEmpresa(ids, fecha)`** · _método_
    La empresa pago el anticipo de esos viajes.

  - **`apiSeguimiento.guardarAnticipoCliente(facturaNumero, empresa, valor)`** · _método_
    Anticipo (o abono) que el cliente ya pago de una factura; 0 lo quita.

  - **`apiSeguimiento.previaCartera(facturas)`** · _método_
    Propone como cargar las facturas del Excel "Cartera Total" (no guarda).

  - **`apiSeguimiento.importarCartera(facturas)`** · _método_
    Carga las facturas confirmadas.

  - **`apiSeguimiento.guardarPlazo(datos)`** · _método_
    Guarda el plazo y el contacto de cobro de un cliente; devuelve todos.

  - **`apiSeguimiento.gestiones(facturaNumero, empresa)`** · _método_
    Gestiones de cobro de una factura.

  - **`apiSeguimiento.agregarGestion(datos)`** · _método_
    Anota una gestion de cobro; devuelve las de esa factura.

  - **`apiSeguimiento.registrarPago(facturaNumero, empresa, fecha)`** · _método_
    Registra el pago de una factura (todos sus viajes).

### `src/componentes/AccesoGps.tsx`

> Acceso a la plataforma GPS del vehiculo elegido en el despacho: link (abre
> en otra pestana), usuario y clave con boton de copiar. Sirve para revisar a
> que hora salio del sitio de cargue mientras se planilla.

- **`esLinkSeguro(url)`** · _función_
  Solo se enlaza un http(s): el backend ya lo exige, esto es una segunda barrera.

- **`Copiar({...})`** · _componente React_
  Boton que copia un texto al portapapeles y dice "Copiado" un momento.

- **`AccesoGps({...})`** · _componente React_
  Panel con el acceso al GPS del vehiculo. La clave se muestra oculta hasta
  pulsar "Ver". Si no hay nada guardado, explica donde agregarlo.

### `src/componentes/AlertasDocumentos.tsx`

> Ventana de documentos vencidos o por vencer (SOAT, tecnomecanica, licencia,
> poliza), con la fecha editable en la misma fila para ponerla al dia.

- **`llave(a)`** · _función_
  Llave estable de una alerta: el registro y el campo del que sale. Con el
  indice de la lista como llave, al refrescar (el documento corregido sale de
  la lista) React le pasaria el estado de edicion a la fila de abajo.

- **`actualizarOrigen(origen, cambio)`** · _función_
  Aplica un cambio al registro del que sale la alerta: la nueva fecha de
  vencimiento, o `activo: true` para reactivarlo.

- **`AlertasDocumentos({...})`** · _componente React_
  Documentos vencidos o por vencer, en una ventana aparte para no ocupar la
  pantalla de inicio. Se abre desde el boton "Documentos" de la barra
  superior o desde el indicador del Inicio.

  Cada fila se puede actualizar ahi mismo: se escribe la nueva fecha de
  vencimiento y se guarda en el vehiculo, remolque, conductor o empresa.

- **`FilaAlerta({...})`** · _componente React_
  Una alerta. Tiene su propio estado de edicion: cada fila se edita por
  separado sin afectar a las demas.

### `src/componentes/AlertasSeguimiento.tsx`

> Ventana de alertas de seguimiento (boton del reloj en la barra superior):
> papeles que hay que perseguir despues del descargue, viajes por facturar y
> facturas por cobrar. Clic en una alerta lleva a su pantalla con ese viaje o
> esa factura abiertos.

- **`rutaDe(a)`** · _función_
  Ruta de la pantalla que resuelve la alerta, con el viaje o la factura a abrir.

- **`AlertasSeguimiento({...})`** · _componente React_
  Lista de alertas por grupo; abre en el primer grupo que tenga algo.

### `src/componentes/AnularViaje.tsx`

> Ventana para anular un viaje en el RNDC: muestra que se anulara y en que
> orden, pide los motivos y muestra los radicados de anulacion.

- **`esAnulable(v)`** · _función_
  true si el viaje se puede anular desde Viajes (estados de ESTADOS_ANULABLES).

- **`AnularViaje({...})`** · _componente React_
  Ventana para anular un viaje en el RNDC.

  Primero muestra que se va a anular y en que orden (lo calcula el backend),
  los motivos que acepta el RNDC y como va el tope mensual. Anular no se puede
  deshacer y el numero del viaje no se puede volver a usar, por eso se pide
  una confirmacion explicita.

- **`ResultadoAnulado({...})`** · _componente React_
  Mensaje final de una anulacion correcta, con los radicados de anulacion del
  manifiesto y de cada remesa.

### `src/componentes/CambiarClave.tsx`

> Formulario para cambiar la propia contrasena (obligatorio con clave
> temporal, o voluntario desde el menu del avatar).

- **`CambiarClave({...})`** · _componente React_
  Formulario para cambiar la propia contrasena. Se usa en dos lugares:
  - Obligatorio, a pantalla completa, cuando se entra con una clave temporal.
  - Voluntario, desde el menu del avatar.

### `src/componentes/ComboBuscable.tsx`

> Lista desplegable con buscador, para elegir entre muchos registros
> (vehiculos, conductores, terceros, plantillas, municipios).

- **`ComboBuscable({...})`** · _componente React_
  Select con busqueda: en vez de desplegar la lista completa (placas, nombres
  de clientes, cedulas...), se escribe encima y se filtra.

  Reemplaza los <select> que se llenan con datos de la base (vehiculos,
  conductores, remolques, terceros, plantillas). Los <select> de opciones fijas
  (tipo de identificacion, tipo de manifiesto) no necesitan esto: son pocas
  opciones y no hace falta buscar entre ellas.

  El id suele ser numerico (el id de la base), pero puede ser texto: los
  codigos DIVIPOLA empiezan por cero (05001000) y como numero lo perderian.
  `K` es ese tipo; TypeScript lo deduce de `obtenerId`, asi que los usos
  existentes con ids numericos no cambian.

### `src/componentes/CumplirViaje.tsx`

> Ventana para cumplir un viaje en el RNDC: cada remesa (proceso 5) con sus
> tiempos (los del GPS vienen puestos) y luego el manifiesto (proceso 6) con
> valores, retenciones y el piso SICETAC del cumplido. Al abrir trae del RNDC
> lo que ya se cumplio en el portal.

- **`esCumplible(v)`** · _función_
  Solo se cumplen viajes con manifiesto vigente (ver despacho.ts).

- **`formularioInicial(r)`** · _función_
  Valores iniciales de una remesa: lo cargado y las citas que se pusieron al
  despachar. Llegada y entrada a la hora de la cita, salida una hora despues.
  Nada puede ser futuro: si la cita del descargue aun no llega, se propone la
  hora actual. Todo se puede corregir antes de enviar.

- **`CumplirViaje({...})`** · _componente React_
  Ventana para cumplir un viaje en el RNDC: primero cada remesa (proceso 5) y,
  cuando todas estan cumplidas, el manifiesto (proceso 6). Es el orden que
  exige el RNDC [Guia Cumplido de Remesa y Manifiesto, pag. 3].

  Cada remesa tiene su propio formulario y su propio estado de envio: se
  guardan en un objeto indexado por el id de la remesa, asi cumplir una no
  reinicia lo que se escribio en otra.

- **`FormularioCumplido({...})`** · _componente React_
  Formulario del cumplido de UNA remesa: kilos entregados y los seis tiempos
  logisticos.

  Los tiempos que reporto el GPS vienen puestos con la pastilla "GPS"; si se
  cambian, se marcan "Editado" con el valor original y un boton para volver
  al del GPS. Ninguna hora puede ser futura. El boton se habilita con kilos y
  las seis horas llenas.

- **`PisoSicetac({...})`** · _componente React_
  Piso SICETAC contra el valor a pagar del cumplido. El RNDC rechaza un valor
  a pagar menor [Guia Cumplido 3.4 y 3.9.1], salvo flota propia (valor 0).

- **`AvisoPlazo({...})`** · _componente React_
  Aviso del plazo de 5 dias habiles, con el tono segun lo que falte.

- **`duracion(min)`** · _función_
  63 -> "1 h 3 min".

- **`TablaTiempos({...})`** · _componente React_
  Tiempos logisticos del manifiesto: pactados contra los que registro el GPS
  (o los del cumplido de cada remesa), y el valor que eso suma o resta con el
  valor hora de SICETAC. Es la misma comparacion que muestra el portal al
  cumplir; el valor es una sugerencia que se aplica con un clic.

- **`DetalleCumplido({...})`** · _componente React_
  Lo que quedo registrado en el cumplido de una remesa, leido del RNDC, para
  revisar que esta bien. Si algo esta mal, se anula el cumplido (proceso 28)
  y la remesa vuelve al formulario con esos mismos datos para corregirlos.

### `src/componentes/DetalleViaje.tsx`

> Ventana de solo lectura con todo lo registrado al despachar un viaje.

- **`Datos({...})`** · _componente React_
  Pares etiqueta / valor en dos columnas. Lo vacio se muestra como "-".

- **`tercero(t)`** · _función_
  Nombre de un tercero y debajo su identificacion, sede y ciudad.

- **`DetalleViaje({...})`** · _componente React_
  Todo lo que se registro al despachar un viaje, de solo lectura: documentos
  y radicados, vehiculo y conductores, valores, cada remesa con sus partes y
  su mercancia, y quien expidio, cumplio o anulo.

### `src/componentes/DocumentosViaje.tsx`

> Documentos de un viaje expedido: PDF oficial del manifiesto (con o sin logo)
> y remesas imprimibles.

- **`DocumentosViaje({...})`** · _componente React_
  Documentos que el conductor debe llevar en el viaje: el manifiesto
  electronico de carga (PDF oficial del RNDC, con el logo de la empresa) y la
  remesa de cada carga.

  El manifiesto es el documento que exige la autoridad en via: el policia
  escanea su QR para verificar que es el original del RNDC. El logo se
  estampa lejos del QR, que queda intacto.

- **`VentanaDocumentosViaje({...})`** · _componente React_
  Los mismos documentos en una ventana, para abrirlos desde una lista.

### `src/componentes/Estado.tsx`

> Bloques que se repiten en toda pantalla que consulta la API: el mensaje de
> "cargando", el de error y el de lista vacia.

- **`Cargando({...})`** · _componente React_
  Mensaje "Cargando ..." mientras llegan los datos.

- **`ErrorCarga({...})`** · _componente React_
  Mensaje de error al cargar datos, con boton "Reintentar" si se da alReintentar.

- **`Vacio({...})`** · _componente React_
  Mensaje para una lista sin resultados.

- **`Avisos({...})`** · _componente React_
  Los avisos del backend no son errores: la operacion salio bien pero hay algo
  que el despachador debe saber (manifiesto tardio, coordenada sin precision).

### `src/componentes/EstadoSincronizacion.tsx`

> Barra con el estado de la sincronizacion automatica con el RNDC: cuando
> corrio por ultima vez, que trajo (manifiestos del portal, cumplidos,
> anulaciones) y un boton para sincronizar ya sin esperar la siguiente vuelta.

- **`hace(iso)`** · _función_
  "hace 3 min", "hace 2 h"... desde una fecha ISO.

- **`textoResumen(r)`** · _función_
  Frase con lo que cambio en la ultima sincronizacion, o null si no cambio nada.

- **`EstadoSincronizacion({...})`** · _componente React_
  Estado de la sincronizacion. `alSincronizar` se llama despues de una
  sincronizacion manual, para recargar la lista de la pantalla.

### `src/componentes/FormularioGenerico.tsx`

> Formulario construido a partir de una descripcion de campos.
>
> Equivale a form-modal.component de Angular. Se conserva el enfoque para las
> pantallas de catalogo, donde los formularios son listas planas de campos sin
> dependencias entre si. Para el despacho NO se usa: alli los campos dependen
> unos de otros y conviene escribirlos a mano.

- **`FormularioGenerico({...})`** · _componente React_
  Pinta un formulario por secciones (titulo y descripcion a la izquierda,
  campos a la derecha) a partir de la lista de campos. Cada cambio entrega un
  modelo NUEVO a alCambiar (nunca se muta el actual, para que React redibuje).

- **`Campo({...})`** · _componente React_
  Un campo segun su tipo: casilla, lista desplegable o caja de texto, numero o
  fecha, con su ayuda debajo si la tiene.

### `src/componentes/Iconos.tsx`

> Iconos de trazo simple (24x24, stroke = currentColor), para el menu y la
> barra superior. Toman el color del texto que los rodea.

- **`Icono({...})`** · _componente React_
  Lienzo SVG comun de los iconos (24x24, trazo del color del texto, 18 px por defecto).

- **`IconoInicio()`** · _componente React_
  Icono del menu Inicio.

- **`IconoCamion()`** · _componente React_
  Icono del menu Despachar.

- **`IconoViajes()`** · _componente React_
  Icono del menu Viajes.

- **`IconoPlantillas()`** · _componente React_
  Icono del menu Plantillas.

- **`IconoClientes()`** · _componente React_
  Icono del menu Clientes.

- **`IconoFlota()`** · _componente React_
  Icono del menu Flota.

- **`IconoConductores()`** · _componente React_
  Icono del menu Conductores.

- **`IconoConfiguracion()`** · _componente React_
  Icono del menu Configuracion.

- **`IconoCampana()`** · _componente React_
  Icono de alertas.

- **`IconoFlecha()`** · _componente React_
  Icono de flecha a la derecha.

- **`IconoContraer()`** · _componente React_
  Icono para contraer el menu lateral.

- **`IconoMenu()`** · _componente React_
  Icono del menu en el celular.

- **`IconoCalendario()`** · _componente React_
  Icono de calendario.

- **`IconoCheck()`** · _componente React_
  Icono de confirmacion.

- **`IconoGrafica()`** · _componente React_
  Icono de grafica.

- **`IconoMapa()`** · _componente React_
  Icono de mapa.

- **`IconoDocumento()`** · _componente React_
  Icono de documento (Cuadro pagos).

- **`IconoUsuarios()`** · _componente React_
  Icono del menu Usuarios.

- **`IconoOjo()`** · _componente React_
  Icono para mostrar la contrasena.

- **`IconoOjoTachado()`** · _componente React_
  Icono para ocultar la contrasena.

- **`IconoCartera()`** · _componente React_
  Icono del menu Cartera (billete).

- **`IconoReloj()`** · _componente React_
  Icono de alertas de seguimiento (reloj).

- **`IconoBomba()`** · _componente React_
  Icono del menu Anticipos (surtidor de combustible).

### `src/componentes/Indicador.tsx`

- **`Indicador({...})`** · _componente React_
  Tarjeta de indicador (Inicio, Cartera, Anticipos): titulo, valor grande y,
  opcional, un icono, la variacion frente al periodo anterior (con signo y
  flecha, no solo color) y un detalle al lado.

  `dinero` usa la letra de montos; `alerta` pinta el valor en rojo (mismo tamano).

### `src/componentes/LibroConsecutivos.tsx`

> Libro de consecutivos de manifiestos y remesas: una fila por remesa, con
> las columnas de la hoja de control de la empresa.

- **`estadoFila(f)`** · _función_
  Estado de la fila: el del viaje, salvo que la remesa ya este cumplida.

- **`tonoFila(f)`** · _función_
  Color de la pastilla de estado: gris si anulado, verde si cumplido, y si no
  el tono del estado del viaje.

- **`dia(fecha)`** · _función_
  Dia en hora de Colombia (el servidor guarda en UTC: de noche ya es el dia siguiente).

- **`mesDe(fecha)`** · _función_
  "julio de 2026", para filtrar por mes como las hojas mensuales del Excel.

- **`persona(tipo, nit, nombre)`** · _función_
  Nombre de remitente o destinatario y debajo su NIT o CC.

- **`LibroConsecutivos({...})`** · _componente React_
  Libro de consecutivos de manifiestos y remesas: una fila por remesa, con
  las columnas de la hoja de control que llevaba la empresa. El viaje de
  varias remesas ocupa varias filas (00006193, 00006193B...); el valor del
  manifiesto y el FOPAT van solo en la primera. Clic en una fila abre todo lo
  que se registro al despachar.

### `src/componentes/MapaSeguimiento.tsx`

> Mapa (Leaflet) con la posicion ESTIMADA de los vehiculos en camino: en
> linea recta entre cargue y descargue segun el tiempo entre las citas.

- **`coordenadaValida(lat, lon)`** · _función_
  Colombia continental, aproximado: descarta coordenadas de relleno (999...).

- **`MapaSeguimiento({...})`** · _componente React_
  Mapa con los vehiculos en camino.

  El sistema no recibe GPS: la posicion es ESTIMADA, en linea recta entre el
  sitio de cargue y el de descargue, segun el tiempo transcurrido entre las
  dos citas. Sirve para ver de un vistazo que viaje va por donde; la posicion
  real la tiene la empresa de monitoreo.

  Leaflet maneja el mapa por su cuenta (no es un componente de React): se crea
  una sola vez en un useEffect y en otro se redibujan los puntos cuando
  cambian. El cleanup destruye el mapa al salir de la pantalla.

### `src/componentes/Modal.tsx`

> Ventana modal comun: se cierra con la X o Escape (no con clic fuera), se
> puede maximizar o cambiar de tamano, y puede mostrar pasos de un asistente.

- **`Modal({...})`** · _componente React_
  Ventana modal. Equivale a modal.component de Angular y reutiliza sus mismas
  clases de CSS (.modal-overlay, .modal-card, .stepper-header).

  `pasos` dibuja el indicador del asistente cuando la ventana tiene varios
  pasos; si se omite, la ventana es simple.

  Solo se cierra con la X o con Escape: un clic fuera no la cierra, para no
  perder lo escrito. Se puede maximizar con el boton de la cabecera o cambiar
  de tamano arrastrando la esquina inferior derecha.

### `src/componentes/PantallaAcceso.tsx`

> Marco de las pantallas sin sesion: tarjeta con logo y formulario a la
> izquierda y foto a la derecha.

- **`PantallaAcceso({...})`** · _componente React_
  Marco de las pantallas sin sesion (login, recuperar contrasena y el cambio
  obligatorio de la clave temporal).

  Una tarjeta centrada sobre la foto de fondo, partida en dos: a la izquierda
  el logo y el formulario que llegue como `children`; a la derecha una foto
  con el nombre del sistema. Las dos fotos van en el CSS (.pantalla-acceso y
  .acceso-foto), asi se cambian sin tocar el componente.

  En pantallas angostas la mitad de la foto se oculta y queda solo el formulario.

### `src/componentes/ReintentarViaje.tsx`

> Ventana para retomar un viaje fallido: explica el error, muestra que
> remesas ya estan en el RNDC y deja corregir los datos del manifiesto.

- **`esReintentable(v)`** · _función_
  true si el viaje quedo en un estado de error desde el que se puede reintentar.

- **`correccionDe(v)`** · _función_
  Valores iniciales del formulario de correccion: los datos actuales del manifiesto.

- **`ReintentarViaje({...})`** · _componente React_
  Ventana para retomar un viaje que quedo a medias.

  Muestra el error, que remesas ya estan en el RNDC y deja corregir los datos
  del manifiesto. Lo que se corrija en el Catalogo (por ejemplo el titular del
  vehiculo) tambien se toma: el backend relee todo al reintentar.

### `src/componentes/Seccion.tsx`

- **`Seccion({...})`** · _componente React_
  Bloque con titulo (y, opcional, algo al lado del titulo) dentro de un detalle.

### `src/componentes/Shell.tsx`

> Marco de la aplicacion con sesion: menu lateral, barra superior (alertas,
> usuario) y el contenido de la pantalla actual.

- **`usarShell()`** · _función_
  Las paginas leen el contexto del marco con este gancho. Es el mecanismo de
  React Router para pasar datos del layout a las rutas hijas sin props: el
  Shell lo entrega en <Outlet context={...}> y la pagina lo recibe aqui.

- **`leerContraido()`** · _función_
  Preferencia del menu contraido. Solo es comodidad: si falla, se ignora.

- **`Shell()`** · _componente React_
  Marco de la aplicacion, siguiendo el template de docs/template de ejemplo.png:
  menu lateral claro con iconos, la empresa abajo y el boton para contraerlo;
  barra superior con el titulo, "+" (nuevo despacho), la campana de alertas y
  el avatar.

  Las alertas de documentos se cargan aqui una sola vez: la campana se ve en
  todas las pantallas y el Inicio reutiliza los mismos datos.

### `src/componentes/TablaDatos.tsx`

- **`texto(v)`** · _función_
  Valor de una celda como texto (null y undefined -> "").

- **`sinTildes(s)`** · _función_
  Texto sin tildes y en minuscula, para buscar sin importar acentos ni mayusculas.

- **`TablaDatos({...})`** · _componente React_
  Tabla de listados con pestanas, busqueda, filtros, orden, exportacion y paginas.

  Como funciona (en este orden, con useMemo para no recalcular de mas):
  1. Pestanas: filtra por la pestana activa y cuenta las filas de cada una.
  2. Busqueda: compara el texto sin tildes contra el 'valor' de cada columna.
  3. Filtros: un desplegable por columna 'filtrable' con sus valores reales.
  4. Orden: clic en el encabezado (ascendente, descendente, sin orden).
  5. Paginas de 50; al cambiar busqueda, filtros u orden vuelve a la primera.
  Exportar descarga un CSV (separado por ';', con BOM para que Excel lea las
  tildes) con todo lo filtrado, no solo la pagina visible.

- **`Paginacion({...})`** · _componente React_
  "1-50 de 312" y los botones de pagina. Tambien la usan tablas que no son TablaDatos.

- **`Pastilla({...})`** · _componente React_
  Pastilla de estado con punto de color (ver GUIA-UI.md, "Estados").

- **`IconoFiltro()`** · _componente React_
  Icono del boton Filtros.

- **`IconoExportar()`** · _componente React_
  Icono del boton Exportar.

### `src/ganchos/useAltoTabla.ts`

> Altura de una tabla para que quepa en la pantalla sin bajar la pagina: asi
> su barra de desplazamiento horizontal queda siempre a la vista (antes estaba
> al final de todas las filas).

- **`useAltoTabla(reserva)`** · _función_
  Devuelve una ref para el contenedor con scroll de la tabla. Le pone de
  altura maxima lo que queda de pantalla desde donde empieza la tabla (con la
  pagina arriba del todo), menos `reserva` px para lo que va debajo (la
  paginacion, el margen). Se recalcula al cambiar el tamano de la ventana o
  cuando cambia lo que hay encima (un aviso que aparece, filtros...).

### `src/ganchos/useDatos.ts`

> Gancho para cargar datos de la API con estados de carga, error y recarga.

- **`useDatos(cargar, dependencias)`** · _función_
  Carga datos de la API y expone los tres estados que toda pantalla necesita:
  cargando, error y datos.

  En Angular esto se resolvia con `subscribe()` dentro de `ngOnInit`. Aqui se
  encapsula para no repetir el mismo `useState` triple en cada pantalla.

  `recargar` sirve despues de guardar algo: vuelve a pedir sin recargar la
  pagina.

  Ojo con `dependencias`: es el arreglo que decide cuando se vuelve a pedir,
  igual que en useEffect. Si la funcion usa una variable que cambia (el id de
  un vehiculo, por ejemplo), esa variable tiene que estar aqui.

### `src/ganchos/useMunicipios.ts`

> Gancho con los municipios DIVIPOLA para buscar por nombre.

- **`useMunicipios(terceros)`** · _función_
  Municipios para elegir y mostrar la ruta de una plantilla.

  La fuente principal es el catalogo DIVIPOLA del backend. Si todavia no se
  importo (tabla vacia), se arma una lista con los municipios de los terceros
  que ya se conocen, para que el despachador pueda buscar por nombre igual.

  `useMemo` evita recalcular la lista en cada render: solo se rehace cuando
  cambia el catalogo o la lista de terceros. Sin el, cada tecla escrita en
  cualquier campo del formulario volveria a recorrer cientos de terceros.

### `src/ganchos/useSesion.tsx`

> Sesion del usuario: proveedor de contexto y gancho para leerla. Vuelve al
> login cuando el backend avisa que la sesion vencio.

- **`ProveedorSesion({...})`** · _componente React_
  Guarda quien esta conectado y lo comparte con toda la aplicacion.

  Es un Context de React: un valor que cualquier componente de adentro puede
  leer con useSesion(), sin pasarlo de mano en mano por props. Al montarse
  pregunta al backend "quien soy" (la cookie la manda el navegador solo); y
  escucha el evento de sesion vencida que dispara el cliente de la API ante
  un 401, para volver al login sin importar en que pantalla se estaba.

- **`useSesion()`** · _función_
  Sesion actual (estado, usuario, entrar, salir). Debe usarse dentro de <ProveedorSesion>.

### `src/paginas/Catalogo.tsx`

> Pantallas de catalogo: Flota (vehiculos, remolques, monitoreo),
> Conductores, Clientes (terceros) y Configuracion (parametros de la
> empresa). Listas con su estado de documentos y formularios de crear/editar.

- **`tituloRegistro(p, m)`** · _función_
  "Vehiculo SKN250", "Conductor PEDRO PEREZ"... para los avisos del registro.

- **`Catalogo({...})`** · _componente React_
  El catalogo se usa desde varias entradas del menu (Flota, Conductores,
  Clientes, Configuracion): cada una muestra solo sus pestanas. Sin la prop,
  se ven todas.

- **`Tabla({...})`** · _componente React_
  Tabla simple del catalogo con paginas de 50: muestra "Cargando" o el error
  mientras corresponde, y vuelve a la primera pagina cuando cambia la lista.

- **`EstadoRndc({...})`** · _componente React_
  Estado del registro en el RNDC: registrado (con radicado), rechazado (con el
  mensaje en el titulo) o sin registrar desde la aplicacion. `detallado`
  muestra el mensaje completo (en la ventana de edicion).

- **`EstadoRegistro({...})`** · _componente React_
  Insignia del registro: Inactivo, Al dia o Revisar (documento vencido).

- **`Vencimiento({...})`** · _componente React_
  Fecha de vencimiento, en rojo si ya paso.

- **`PanelEmpresa()`** · _componente React_
  Parametros de la empresa: poliza, FOPAT y tarifa de retefuente.
  Es una sola fila, no una lista, asi que se edita en linea.

- **`aModelo(registro)`** · _función_
  Copia del registro lista para el formulario.

- **`soloCambios(original, actual)`** · _función_
  Solo lo que cambio respecto al original. Mandar el registro completo
  revalidaria campos que nadie toco (por ejemplo una configuracion vieja) y
  haria fallar una edicion que no tenia nada que ver.

- **`coincide(texto, ...campos)`** · _función_
  Busca el texto en cualquiera de los campos (sin distinguir mayusculas).

- **`titularEsEmpresa(v, nitEmpresa)`** · _función_
  Misma regla que mismaIdentificacion() del backend: iguales, o distintos solo
  por el digito de verificacion al final.

- **`configuracionValida(c)`** · _función_
  true si la configuracion del vehiculo es una de las que acepta SICETAC.

- **`vigente(fecha)`** · _función_
  Vigente si no tiene fecha o si vence hoy o despues (comparando el dia, no la hora).

- **`kg(valor)`** · _función_
  Kilos con punto de miles y "kg"; "-" sin valor.

- **`iniciales(nombre)`** · _función_
  Iniciales de las dos primeras palabras de un nombre (para el avatar).

- **`textoNuevo(p)`** · _función_
  Texto del boton de crear de cada pestana: "Nuevo vehiculo", "Nueva empresa de monitoreo"...

- **`tituloModal(p, edicion, modelo)`** · _función_
  Titulo de la ventana: "Nuevo vehiculo" o "Editar vehiculo SKN250".

- **`seccionEstado(que)`** · _función_
  Seccion "Estado" del formulario (casilla Activo): un registro inactivo no
  aparece en el despacho pero se conserva para el historial.

- **`seccionesDe(p, empresas, edicion)`** · _función_
  Secciones del formulario segun la pestana. Al editar se agrega la seccion
  de estado (activo/inactivo), que al crear no tiene sentido.

- **`seccionesVehiculo(empresas)`** · _función_
  El formulario de vehiculos incluye el proveedor de GPS, cuyas opciones salen
  del catalogo de empresas de monitoreo y por eso no pueden ser fijas.

- **`SelectorGps({...})`** · _componente React_
  Cambia en linea el proveedor de GPS de un vehiculo ya registrado. Es lo que
  permite completar la flota que ya estaba cargada sin reimportarla.

### `src/paginas/Dashboard.tsx`

> Pantalla de inicio: indicadores, documentos mas urgentes, viajes de hoy,
> ultimos viajes, viajes por semana y mapa de seguimiento.

- **`Dashboard()`** · _componente React_
  Pantalla de inicio, organizada como docs/template de ejemplo.png:
  indicadores arriba, los documentos mas urgentes, los viajes de hoy, los
  ultimos viajes, los viajes por semana y el mapa de seguimiento.

  Todo se calcula en el navegador con listas que ya existen (historial de
  viajes, vehiculos, conductores y plantillas). Si el volumen crece, conviene
  mover los conteos al backend.

  Un viaje cumplido es "Finalizado"; los demas toman su estado de las CITAS de
  cargue y descargue del manifiesto (el sistema no recibe la posicion GPS).

- **`estadoViaje(v, ahora)`** · _función_
  Estado para el tablero: Anulado, Finalizado (cumplido o ya paso la cita de
  descargue), Con incidencia (cualquier error), Programado (aun no carga) o En
  camino (entre la cita de cargue y la de descargue).

- **`claseEstado(e)`** · _función_
  Clase CSS del color de cada estado del tablero.

- **`avance(v, ahora)`** · _función_
  Fraccion del viaje recorrida (0 a 1) segun la hora actual entre la cita de
  cargue y la de descargue. Para la barra de progreso.

- **`claveDia(d)`** · _función_
  "AAAA-MM-DD" del dia en Colombia.

- **`hora(valor)`** · _función_
  "HH:MM" en hora de Colombia; vacio sin valor.

- **`diaMes(valor)`** · _función_
  "DD/MM" en hora de Colombia (no del texto UTC: de noche seria el dia siguiente).

- **`ruta(p)`** · _función_
  "Ciudad origen -> ciudad destino" de una plantilla, con el municipio corto.

- **`corto(ciudad)`** · _función_
  "SOACHA CUNDINAMARCA" -> "Soacha": el municipio sin el departamento.

- **`variacion(actual, previo)`** · _función_
  Variacion porcentual; null si no hay base para comparar.

- **`viajesPorSemana(viajes, ahora)`** · _función_
  Viajes confirmados por semana (lunes a domingo, hora de Colombia), por fecha
  de expedicion. Devuelve la semana actual y las 4 anteriores.

- **`AlertaDestacada({...})`** · _componente React_
  Tarjeta con el documento mas urgente (o un mensaje si no hay): quien, que
  documento y en cuantos dias vence. Al hacer clic abre todas las alertas.

- **`AvatarConductor({...})`** · _componente React_
  Circulo con las iniciales del conductor (su nombre completo al pasar el mouse).

- **`GraficaSemana({...})`** · _componente React_
  Viajes por dia de la semana elegida. Cada dia lleva dos barras: la semana
  anterior en azul claro (de fondo, para comparar) y la elegida en azul. Una
  sola metrica, dos periodos: el claro es solo referencia.

### `src/paginas/Despacho.tsx`

> Pantalla Despachar: asistente para expedir un viaje (remesas y manifiesto)
> en el RNDC, y para corregir y reintentar un viaje fallido.

- **`consecutivoRemesa(base, orden)`** · _función_
  Consecutivo de cada remesa a partir del numero base del viaje.

  Convencion de la empresa: la primera remesa lleva el numero tal cual (el
  mismo del manifiesto) y las siguientes agregan una letra. Es la misma regla
  que aplica el backend; aqui esta solo para mostrar la vista previa.

- **`proximaHoraEnPunto()`** · _función_
  Hoy, a la siguiente hora en punto. Es la cita de cargue mas frecuente.

- **`filaVacia()`** · _función_
  Carga nueva vacia: cargue en la proxima hora en punto y descargue un dia despues.

- **`Despacho({...})`** · _componente React_
  Pantalla Despachar: asistente de tres pasos para expedir un viaje.

  1. Vehiculo y conductor (con el remolque y conductor habituales sugeridos).
  2. Cargas: una o varias remesas, cada una desde una plantilla, con citas y peso.
  3. Valores: flete, anticipo y via con su piso SICETAC.
  Al enviar, el backend expide las remesas y el manifiesto en el RNDC y la
  pantalla muestra los documentos. Si se abre con ?viaje=N, carga un viaje
  fallido completo para corregirlo y reintentarlo.

- **`diasDesdeHoy(n)`** · _función_
  "AAAA-MM-DD" de hoy + n dias, en hora de Colombia (para inputs type="date").

### `src/paginas/FormularioPlantilla.tsx`

> Formulario para crear o editar una plantilla de viaje: terceros, ruta,
> mercancia, tiempos pactados y valores.

- **`partidaDe(codigo)`** · _función_
  "004707" -> "4707": la lista trabaja con los 4 digitos.

- **`FormularioPlantilla({...})`** · _componente React_
  Crea o edita una plantilla.

  Si llega `plantilla`, el formulario abre en modo edicion con sus valores.
  El valor que recibe `useState(...)` solo se usa en el PRIMER render: por eso
  basta con pasarle el dato de la plantilla ahi y no hace falta un useEffect
  para "copiar" la plantilla al estado.

- **`SelectorMunicipio({...})`** · _componente React_
  Municipio con buscador por nombre, mas el codigo DIVIPOLA editable a mano.

  Los dos controles escriben el MISMO estado (`valor`): elegir en la lista
  llena el codigo, y escribir el codigo selecciona el municipio si esta en la
  lista. El campo de codigo existe porque la lista puede no traer el municipio
  que se necesita (por ejemplo, donde arranca un tramo en vacio).

- **`SelectorTercero({...})`** · _componente React_
  Lista desplegable para elegir un tercero (cliente, remitente o destinatario).

### `src/paginas/Historial.tsx`

> Pantalla Viajes: lista de despachos y libro de consecutivos, con las
> acciones de cada viaje.

- **`Historial()`** · _componente React_
  Pantalla Viajes: todos los despachos con su estado, plazo del cumplido y
  acciones (imprimir, cumplir, corregir y reintentar, anular). Tiene dos
  vistas: "Viajes" (uno por fila) y "Consecutivos manifiestos y remesas"
  (una fila por remesa, como el libro de control). Clic en una fila abre todo
  lo que se registro al despachar.

- **`PlazoCumplido({...})`** · _componente React_
  Dias habiles que quedan para cumplir, en la columna de estado.

### `src/paginas/Login.tsx`

> Pantalla de inicio de sesion y recuperacion de contrasena por codigo al correo.

- **`Login()`** · _componente React_
  Pantalla de inicio de sesion: email y contrasena.

  Es un <form> de verdad (no botones sueltos): asi Enter envia, el navegador
  ofrece guardar la contrasena y los gestores de claves la reconocen.

- **`CampoClave({...})`** · _componente React_
  Campo de contrasena con el boton del ojo para verla. El boton solo cambia el
  `type` del input entre "password" y "text"; el valor es el mismo.

- **`Recuperar({...})`** · _componente React_
  Recuperar la contrasena en dos pasos: pedir un codigo al correo y luego,
  con ese codigo, crear la contrasena nueva.

### `src/paginas/Plantillas.tsx`

> Pantalla Plantillas: lista de plantillas de viaje y actualizacion de tarifas por ruta.

- **`Plantillas()`** · _componente React_
  Pantalla Plantillas: lista de plantillas de viaje (nombre, ruta,
  contratante, mercancia y tarifa); crear, editar y eliminar (desactivar), y
  actualizar tarifas por ruta.

- **`ModalTarifas({...})`** · _componente React_
  Actualizacion masiva de tarifas por ruta.

  Va en dos tiempos a proposito: primero se elige la ruta, luego se MUESTRA que
  plantillas se van a tocar, y solo despues aparece el campo del nuevo valor.
  Saltarse la previsualizacion es como se le cambia sin querer la tarifa a un
  cliente con precio negociado.

### `src/paginas/Usuarios.tsx`

> Pantalla Usuarios: crear usuarios, cambiarles el nombre, activarlos o
> desactivarlos y restablecer su clave (temporal, por correo o en pantalla).

- **`Usuarios()`** · _componente React_
  Administracion de usuarios. Sin roles por ahora: cualquier usuario activo
  crea, renombra (a si mismo y a los demas), desactiva y restablece cuentas.

  Las contrasenas temporales las genera el servidor y se muestran UNA sola
  vez: hay que copiarlas y entregarlas al usuario, que debera cambiarla en su
  primer ingreso.

- **`NuevoUsuario({...})`** · _componente React_
  Ventana para crear un usuario con correo y nombre. Al crearlo devuelve como
  se entrego la clave temporal (por correo o en pantalla).

- **`CambiarNombre({...})`** · _componente React_
  Ventana para cambiar el nombre de un usuario (el propio o el de otro).

- **`ClaveTemporal({...})`** · _componente React_
  Muestra UNA vez la clave temporal cuando no se envio por correo (con el
  motivo, si lo hay), para dictarla o copiarla.

### `src/paginas/cuadro/CuadroAnticipos.tsx`

> Pantalla Anticipos (como el Excel "cuadro de anticipos"): los anticipos de
> efectivo y combustible de todos los viajes y las cuentas con la bomba.
>
> - Arriba: deuda a la bomba, pagado, abonado por el socio (el Zorro) y cupo
>   de credito disponible (editable, junto con el precio y el descuento por
>   galon sugeridos para el cruce).
> - Vistas: por viaje (un tramo de ida o vuelta por fila), por tanqueo (ida y
>   vuelta juntas), deuda pendiente, pagado a la bomba, abonos del socio y
>   cruce con la relacion de la bomba: con los galones del tiquete, el
>   combustible se calcula como en el Excel (galones x precio - descuento).

- **`agruparPorTanqueo(tramos)`** · _función_
  Agrupa los tramos por tanqueo (los anticipos viejos sin tanqueo quedan solos).

- **`flotaTexto(f)`** · _función_
  "LOPEZ", "M&C" o "TERCERO" para la columna Empresa del vehiculo.

- **`diferencia(t)`** · _función_
  Lo que el tramo cambio con el cruce: combustible calculado - lo que se habia registrado.

- **`Recorrido({...})`** · _componente React_
  Recorrido (empresa del viaje) o la vuelta que aun espera el proximo viaje.

- **`CuadroAnticipos()`** · _componente React_
  Pantalla Anticipos. Los anticipos se registran en cada viaje del Cuadro
  pagos; aqui se ven todos, se corrobora la factura de la bomba, se registra
  lo pagado y lo abonado por el socio, y se cruza con la relacion de la bomba.

- **`VentanaCupo({...})`** · _componente React_
  Cupo de credito con la bomba y precio / descuento por galon sugeridos para el cruce.

- **`VentanaAbono({...})`** · _componente React_
  Abono del socio directamente a la bomba: quien, cuando y cuanto a cada viaje
  (los que se cargaron con el). El total es la suma de los viajes.

### `src/paginas/cuadro/CuadroCentral.tsx`

> Pantalla Cuadro pagos: seguimiento de cada viaje (con o sin manifiesto)
> desde que carga hasta que todo queda pagado. Reemplaza la hoja de Excel
> "CUADRO CENTRAL".

- **`cobroVencido(f)`** · _función_
  Ya paso la fecha pago cliente y la factura no se ha pagado.

- **`RutaCuadro({...})`** · _componente React_
  "ORIGEN → DESTINO" en dos lineas: el origen arriba y el destino debajo.

- **`enCurso(f)`** · _función_
  Ni anulado ni todo pagado.

- **`CuadroCentral()`** · _componente React_
  Cuadro pagos: el control de cada viaje desde que carga hasta que todo
  queda pagado, tenga o no manifiesto. Reemplaza la hoja "CUADRO PAGOS".

### `src/paginas/cuadro/DetalleCuadro.tsx`

> Ventana de un viaje del cuadro pagos: papeles, datos, flete, factura, pago
> al dueno, revisiones, anticipos (efectivo y combustible) y notas.

- **`aFormulario(d)`** · _función_
  Viaje -> valores del formulario, todos como texto (asi trabajan los inputs).

- **`DetalleCuadro({...})`** · _componente React_
  Un viaje del cuadro pagos: papeles, datos, flete, factura, pagos,
  revisiones, anticipos y notas. Papeles, revisiones, anticipos y
  notas se guardan al instante; los demas datos con "Guardar cambios".

- **`anticipoVacio()`** · _función_
  Formulario vacio de un anticipo nuevo (con la fecha de hoy al momento de pedirlo).

- **`pesos(v)`** · _función_
  Numero de un campo de pesos ("" -> 0).

- **`Anticipos({...})`** · _componente React_
  Anticipos del viaje (aparte del anticipo del manifiesto): cada tramo con su
  efectivo y su combustible (bomba / EDS). Si el anticipo es de ida y vuelta,
  el de vuelta queda guardado y se suma solo al proximo viaje de la placa.

- **`Notas({...})`** · _componente React_
  Notas con autor y fecha, la mas reciente arriba.

### `src/paginas/cuadro/EnvioFacturacion.tsx`

> Envio a facturacion: arma el cuadro que se le manda a la contadora (factura
> en World Office) con los viajes listos para facturar. Cada fila trae la
> tarifa sugerida de la matriz de fletes y todo se puede ajustar antes de
> descargar el Excel. Tambien: importar y editar la matriz de fletes.

- **`EnvioFacturacion({...})`** · _componente React_
  Ventana del envio a facturacion. Al "Guardar y descargar Excel" guarda en
  cada viaje marcado lo que se envia (tarifa, peso, valor, remision, nota,
  factura) y descarga el cuadro con un bloque por cliente (razon social), con
  un mismo numero de factura para todos sus viajes.

- **`FilaEditable({...})`** · _componente React_
  Una fila editable del cuadro de envio.

- **`VentanaMatriz({...})`** · _componente React_
  Matriz de fletes: importar el Excel "MATRIZ FLETES" (reemplaza la actual) y
  ajustar valor, tipo y peso minimo de cada tarifa.

### `src/paginas/cuadro/ImportarAnticipos.tsx`

> Carga inicial de los anticipos desde el Excel de las EDS (una sola vez).
>
> 1. Se elige el archivo; el navegador lee las filas de anticipos.
> 2. El servidor propone el viaje de cada anticipo (misma placa, fecha
>    cercana y mismo cliente: "EMPRESA PROV").
> 3. Se revisan las dudosas y se confirma. Las que ya estaban cargadas (misma
>    placa, fecha y valores) se saltan; las que quedan sin viaje no se cargan.

- **`etiquetaViaje(c)`** · _función_
  Texto de un viaje del cuadro para la lista (fecha, cliente, manifiesto).

- **`ImportarAnticipos({...})`** · _componente React_
  Ventana de la carga de anticipos: leer el Excel, revisar el viaje de cada fila y cargar.

### `src/paginas/cuadro/PastillasEstado.tsx`

- **`PastillasEstado({...})`** · _componente React_
  Estado de un viaje del cuadro: la pastilla de los papeles y, al lado, la de
  la factura si ya se facturo. "Todo pagado" y "Anulado" van solos.

### `src/paginas/cuadro/VentanasCuadro.tsx`

> Ventanas auxiliares del cuadro pagos: nuevo viaje sin manifiesto, facturar
> varios viajes y catalogo de bombas aliadas.

- **`NuevoViajeCuadro({...})`** · _componente React_
  Viaje sin manifiesto de la empresa: urbanos, o viajes que planilla el mismo
  generador de carga. Solo lo minimo; el resto se completa en el detalle.

- **`FacturarVarios({...})`** · _componente React_
  Una factura para varios viajes a la vez (los urbanos se facturan juntos).
  Lista los viajes sin numero de factura; se filtran por empresa y se marcan.

- **`VentanaBombas({...})`** · _componente React_
  Bombas aliadas que entregan anticipos.

### `src/paginas/cuadro/estadosCuadro.ts`

> Nombres, colores y reglas de presentacion del cuadro pagos (estados,
> papeles, flota, fechas y vencimiento de saldos).

- **`tonoEstadoCuadro(f)`** · _función_
  Color de la pastilla de estado, con el significado de los colores del Excel.
  Todo pagado siempre es verde.

- **`etiquetaEstadoCuadro(f)`** · _función_
  Nombre del estado para mostrar; "Todo pagado" cuando ya se pago todo.

- **`tonoEstadoFactura(e)`** · _función_
  Color de la pastilla de la factura: azul sin datos, celeste facturado.

- **`muestraFactura(f)`** · _función_
  Pastilla de factura que se muestra junto a la de papeles: ninguna si aun no
  se facturo, ni cuando ya esta todo pagado o anulado (esos reemplazan a todo).

- **`textoEstados(f)`** · _función_
  Los dos estados en un texto ("Listo para facturar · Facturado"), para buscar y filtrar.

- **`pasosPapeles(flujoCorame)`** · _función_
  Pasos de los papeles. Parqueadero, oficina y "radicados" (el ultimo, ya
  radicados en el cliente) solo para CORAME / Cartones America.

- **`saldoVencido(f)`** · _función_
  Saldo de un tercero sin pagar y ya vencido (su viernes de pago ya llego).

### `src/paginas/cuadro/excelFacturacion.ts`

> Excel del envio a facturacion (igual a docs/EJEMPLO CUADRO ENVIO DE
> FACTURACION.png) y lectura del Excel de la matriz de fletes.
>
> exceljs se carga solo cuando se usa (import dinamico): es pesado y la
> mayoria de las pantallas no lo necesitan.

- **`fechaExcel(f)`** · _función_
  "2026-10-05" -> Date a mediodia local (que Excel no lo corra de dia).

- **`remisionExcel(r)`** · _función_
  Remision como numero si es solo digitos (como en el ejemplo); si no, texto.

- **`encabezado(hoja)`** · _función_
  Pinta el encabezado de un bloque (fondo azul, negrita, centrado).

- **`viaje(hoja, e)`** · _función_
  Agrega un viaje al bloque con los formatos de cada columna.

- **`descargarCuadroEnvio(bloques, nombreArchivo)`** · _función_
  Arma el Excel del envio: un bloque por factura (encabezado azul y sus
  viajes), separados por una fila vacia, como el ejemplo. Lo descarga.

- **`valorCelda(v)`** · _función_
  Valor de una celda de exceljs: el resultado si es formula, el texto si es enriquecido.

- **`leerMatrizFletes(archivo)`** · _función_
  Lee el Excel "MATRIZ FLETES": busca la fila de titulos (EMPRESA, RAZON
  SOCIAL, VALOR, TIPO, OBSERVACIONES) y devuelve las filas de abajo.
  Lanza Error si el archivo no tiene esa forma.

### `src/paginas/cuadro/facturacion.ts`

> Reglas del envio a facturacion (cuadro para la contadora): sugerir la
> tarifa de la matriz de fletes, el peso a facturar, el total y la nota de la
> factura, y agrupar los viajes por factura. Sin React: se prueban aparte
> (facturacion.test.ts).

- **`normalizarNombre(s)`** · _función_
  Nombre comparable: mayusculas, sin tildes, sin puntuacion y sin sufijos
  legales. "RECOLAM S.EN C." -> "RECOLAM"; "TOLUA ... S.A.S." -> "TOLUA ...".

- **`palabras(s)`** · _función_
  Palabras del nombre, sin la "S" final para que RECICLAJE y RECICLAJES coincidan.

- **`parecido(empresa, tarifa)`** · _función_
  Que tanto se parece una tarifa al cliente del viaje (0 = nada). Se compara
  contra la razon social de la tarifa y contra su nombre:
  3 = igual, 2 = uno contiene al otro, 1 = comparten la mayoria de palabras.

- **`tarifasDelCliente(empresa, tarifas)`** · _función_
  Las tarifas del cliente, la mas parecida primero y luego la de nombre mas corto.

- **`sugerirTarifa(empresa, tarifas, ultimaId)`** · _función_
  Tarifa sugerida para un viaje: la ultima usada con ese cliente; si no, la
  mas parecida que no sea especial (-34 TON, clientes o ciudades adicionales,
  urbano); si solo hay especiales, la primera. null si no hay ninguna.

- **`pesoAFacturar(pesoKg, tarifa)`** · _función_
  Peso a facturar: el fijo de la tarifa si lo tiene (33000 kg, sin importar el
  tiquete); si no, el real, o el minimo pactado si fue por menos (34000 kg).

- **`totalPorPeso(pesoKg, valorTon)`** · _función_
  Total por peso: toneladas x valor por tonelada, en pesos enteros.

- **`adicionalDe(tarifa)`** · _función_
  Adicional de la tarifa, como en la formula del Excel: POR (2 clientes) suma
  300.000 y POR3 (3 clientes) 600.000 al valor x toneladas. null en las demas.

- **`placaConGuion(placa)`** · _función_
  "SZP339" -> "SZP-339" (como va en la nota y en el cuadro).

- **`miles(n)`** · _función_
  34000 -> "34,000" (asi escriben las cifras en la nota).

- **`notaFactura(d)`** · _función_
  Nota de la factura, como la escriben a mano:
  "REMISION 1111 TON 34,000 $150,000 SZP-339" (por peso) o
  "REMISION 1111 $4,500,000 SZP-339" (fijo). CORAME / Cartones America van
  con el numero del "transporte" en vez de la remision.

- **`totalDe(e)`** · _función_
  Total de una fila: el fijo, o toneladas x valor + el adicional por clientes.

- **`notaDe(e)`** · _función_
  La nota que corresponde a los datos de la fila.

- **`aplicarTarifa(e, tarifa)`** · _función_
  Aplica una tarifa a la fila: tipo, valor, adicional, peso a facturar y razon
  social. Una tarifa sin valor (vacio o "?" en la matriz) deja el valor vacio
  para escribirlo a mano. La nota se rearma si no se edito a mano.

- **`filaInicial(f, tarifas, ultimaId)`** · _función_
  Fila inicial del cuadro de envio. Si el viaje ya se habia enviado, se parte
  de lo guardado; si no, de la tarifa sugerida.

- **`claveCliente(razonSocial)`** · _función_
  Llave para juntar los viajes de un mismo cliente: la razon social sin
  tildes, puntuacion ni sufijos legales ("TOLUA ... S.A.S." = "Tolua ... SAS").

- **`agruparPorCliente(filas)`** · _función_
  Bloques del cuadro: los viajes con la misma razon social van juntos, en un
  solo bloque (una factura por cliente), en el orden en que aparece cada
  cliente. Los que no tienen razon social van cada uno aparte.

- **`unificarFacturas(filas)`** · _función_
  Un mismo numero de factura para todos los viajes de un cliente: los que no
  lo tienen toman el que ya se escribio en otro viaje de la misma razon
  social. Si un cliente tiene dos numeros distintos no se puede decidir solo:
  se devuelve en `conflictos` (uno por cliente) para que lo corrijan.

- **`convertirMatriz(filas)`** · _función_
  Convierte las filas del Excel "MATRIZ FLETES" en tarifas.

  - Sin nombre: se ignora. Valor no numerico ("?"): sin valor.
  - Las filas "X -34 TON" (fijo cuando va por menos de 34 toneladas) no son
    una tarifa aparte: se convierten en peso minimo de 34000 kg de "X".
  - "el peso debe de ser 33,000" en las observaciones: peso fijo de 33000 kg.
  - Un valor por tonelada menor de 1.000 esta escrito por kilo (PEGANTE
    URBANO: 28,663636 x 33.000 kg = 945.900): se pasa a valor por tonelada.

- **`enInput(n)`** · _función_
  Texto de un numero para un input ("" si no hay).

- **`deInput(s)`** · _función_
  Valor de un input numerico (null si esta vacio o no es numero).

### `src/paginas/estadosViaje.ts`

> Estados del viaje para mostrar: nombre para la gente y tono de color.

- **`tonoEstado(estado)`** · _función_
  Color de la pastilla de un estado de viaje: verde cumplido, azul expedido,
  gris anulado, amarillo mientras se envia, rojo los errores.

### `src/paginas/seguimiento/AnticiposEmpresas.tsx`

> Anticipos que dan las empresas (clientes) en sus viajes: los del Zorro
> (Ecoambiental, Reciclajes Bogota, Bodegas de Reciclaje), Aburra Limpio y los
> viajes sin manifiesto (salvo urbanos). Es aparte de los anticipos de la
> bomba. Aqui se registra cuanto dio cada empresa y cuando lo pago, y se ve lo
> que debe cada una para cobrarlo. Se usa en Cartera y en Anticipos.

- **`motivo(f)`** · _función_
  Por que el viaje lleva anticipo de la empresa.

- **`AnticiposEmpresas({...})`** · _componente React_
  Vista completa: totales, lo que debe cada empresa (con "registrar pago" de
  todos sus anticipos) y los viajes. Clic en un viaje abre su anticipo. Con
  `abrirViaje` abre de una ese viaje (desde la alerta de la campana).

- **`EditarAnticipo({...})`** · _componente React_
  El anticipo de un viaje: valor, fecha de pago o "no aplica".

- **`PagarEmpresa({...})`** · _componente React_
  Registra el pago de todos los anticipos por cobrar de una empresa.

### `src/paginas/seguimiento/Cartera.tsx`

> Pantalla Cartera: todo lo que los clientes le deben a la empresa. Cada
> factura con numero y fecha entra aqui sola (desde el cuadro pagos) hasta
> que se registra la fecha pago factura. Tambien los saldos de antes de
> septiembre cargados sin viaje, y se puede ver solo lo de un dueno. Vence en la fecha pago cliente (o, si
> no esta escrita, a los dias de credito del cliente); pasada, avisa para
> llamar y cobrar.

- **`totalFactura(f)`** · _función_
  Lo que debe el cliente en total (sin filtro por dueno).

- **`textoVencimiento(f)`** · _función_
  "Vencida hace 12 dias", "Vence hoy", "Vence en 8 dias".

- **`Cartera()`** · _componente React_
  Cartera: totales, edades por cliente y facturas por cobrar. Clic en una
  factura abre sus viajes, las gestiones de cobro y el registro del pago.
  Abre directo una factura con ?factura=<numero>&empresa=<cliente>.

- **`DetalleFactura({...})`** · _componente React_
  Una factura por cobrar: sus viajes, el contacto de cobro del cliente, las
  gestiones (con la fecha que prometio pagar) y el registro del pago.

- **`PlazosClientes({...})`** · _componente React_
  Plazo de credito y contacto de cobro de cada cliente. Se listan los
  clientes con plazo guardado y los que tienen facturas por cobrar; los que no
  tienen plazo usan 30 dias.

### `src/paginas/seguimiento/ImportarCartera.tsx`

> Carga inicial de la cartera desde el Excel "Cartera Total" (una sola vez).
>
> 1. Se elige el archivo; el navegador lee las facturas pendientes.
> 2. El servidor propone como cargar cada una: las de antes de septiembre
>    como saldo sin viaje; las de septiembre en adelante ligadas a sus viajes
>    del cuadro pagos (el viaje de cada placa).
> 3. Se revisan las dudosas (cliente distinto, varios viajes posibles, placa
>    sin viajes) y se confirma. Reimportar no duplica.

- **`etiquetaViaje(c)`** · _función_
  Texto de un viaje del cuadro para la lista.

- **`ImportarCartera({...})`** · _componente React_
  Ventana de la carga de cartera: leer el Excel, revisar cada factura y cargar.

- **`FilasFactura({...})`** · _componente React_
  Las filas de una factura: su cabecera (modo) y una linea por placa.

### `src/paginas/seguimiento/PagoTerceros.tsx`

> Pago a terceros: lo que se le paga al dueno de cada vehiculo tercero por sus
> viajes. Reemplaza la "Matriz Terceros" de Excel (una hoja por tercero).
>
> Por viaje se escribe lo pactado con el tercero (por tonelada o fijo), el
> adicional por transferencia, cuando entrego los documentos y su cuenta de
> cobro. El efectivo y el combustible salen de los anticipos de la bomba. Las
> retenciones se ven siempre y se descuentan solo si se marca. Se le paga el
> viernes (descargue lunes o martes: el de esa semana; de miercoles en
> adelante: el de la siguiente). "Por tercero" junta lo que se le debe a cada
> uno para registrar el pago de una vez.

- **`listo(v)`** · _función_
  Listo para pagar: pactado, con documentos y sin pagar.

- **`toneladas(kg)`** · _función_
  Kilos a toneladas para mostrar (34000 -> "34"); sin peso, "-".

- **`PagoTerceros()`** · _componente React_
  Pagina completa: totales, viajes o resumen por tercero, editor del viaje y registro de pago.

- **`EditarPago({...})`** · _componente React_
  Formulario del pago de un viaje: lo pactado, la transferencia, documentos, retenciones y fechas.

- **`PagarTercero({...})`** · _componente React_
  Registra el pago de todos los viajes listos de un tercero, con su cuenta de cobro.

### `src/paginas/seguimiento/Papeles.tsx`

> Seguimiento de papeles (ventana del Cuadro pagos): los viajes que ya descargaron y aun no
> estan facturados. Muestra donde estan los papeles, quien los tiene, si
> estan completos y a que conductores hay que llamar hoy (sobre todo en
> CORAME / Cartones America).

- **`diasDescargue(f)`** · _función_
  Dias desde el descargue (null si no hay fecha o aun no llega).

- **`alertaDe(f)`** · _función_
  La alerta mas grave del viaje (papeles o facturacion).

- **`motivosDe(f)`** · _función_
  Motivos de las dos alertas juntos.

- **`descargado(f)`** · _función_
  Ya descargo: los papeles salieron de "en ruta" o paso la fecha de descargue.

- **`listos(f)`** · _función_
  Papeles listos para facturar: "listo para facturar" o, en CORAME, ya radicados.

- **`Papeles({...})`** · _componente React_
  Seguimiento de papeles (se abre como ventana desde el Cuadro pagos): clic en
  un viaje abre "Registrar seguimiento" para anotar lo que dijo el conductor.
  `viajeInicial` (id del cuadro) abre directo ese viaje: asi llegan las
  alertas de la campana. `alCambiarCuadro` refresca el cuadro pagos de atras.

- **`RegistrarPapeles({...})`** · _componente React_
  Ventana para registrar lo que se supo de los papeles (normalmente al
  llamar al conductor): donde estan, quien los tiene, si estan completos,
  que falta y una nota. Guardar apaga la alerta de "comunicarse" por hoy.

### `src/paginas/seguimiento/cargaExcel.ts`

> Lectura de los Excel de la carga inicial: "Cartera Total" (facturas
> pendientes con su valor por placa) y la hoja de anticipos de las EDS.
>
> leerHojas convierte el archivo en tablas de valores (con exceljs, cargado
> solo cuando se usa); carteraDesdeFilas y anticiposDesdeFilas no dependen de
> exceljs y se prueban aparte (cargaExcel.test.ts).

- **`leerHojas(archivo)`** · _función_
  Lee todas las hojas del archivo. Las formulas llegan con su resultado.

- **`titulo(v)`** · _función_
  Titulo de columna comparable: mayusculas, sin tildes, espacios simples.

- **`fechaCelda(v)`** · _función_
  Fecha de una celda como "AAAA-MM-DD" (exceljs da Date en UTC); null si no es fecha.

- **`numeroCelda(v)`** · _función_
  Numero de una celda: acepta texto con comas de miles ("3,000,000.00 ").

- **`placaDe(v)`** · _función_
  Placa de un titulo de columna ("SWO-594" o "SWO594") sin guion; null si no es placa.

- **`filaTitulos(filas, requeridos)`** · _función_
  Busca la fila de titulos: la primera que tiene todas las columnas pedidas.

- **`carteraDesdeFilas(filas)`** · _función_
  Facturas pendientes de la hoja "Cartera Total": una por fila con fecha y
  numero de factura. Las columnas de placas (SWO-594, SRO-029...) traen el
  valor de cada placa; "Valor Factura" es lo que debe el cliente (placas
  menos su anticipo). Se ignoran las filas de totales por dueno y por placa.

- **`anticiposDesdeFilas(filas)`** · _función_
  Anticipos de la hoja de las EDS: una fila por anticipo con fecha y placa.
  Columnas por titulo: FECHA ANTICIPO, PLACA, EMPRESA PROV (cliente del
  viaje), EFECTIVO, COMBUST., GALONES, DESC., EDS, N° FACTURA, FECHA FACTURA
  y FECHA DE PAGO (a la bomba).

### `src/paginas/seguimiento/liquidacionTerceros.ts`

> Cuentas del pago a terceros en el navegador, para que el formulario muestre
> el valor a pagar mientras se escribe. Son las mismas del backend
> (src/terceros.ts: liquidar); lo que se guarda lo calcula siempre el backend.

- **`liquidarTercero(d, bomba)`** · _función_
  Valor del tercero, retenciones y valor a pagar (efectivo y combustible salen de la bomba).

- **`numeroONulo(t)`** · _función_
  Texto del formulario a numero; vacio = null.

<!-- REFERENCIA:FIN -->
