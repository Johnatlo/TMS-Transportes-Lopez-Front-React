# Frontend en React (migracion en curso)

Reemplazo progresivo del frontend en Angular. Los dos conviven: el de Angular
sigue en `frontend/` y es el que se usa en produccion hasta que este termine.

El backend no cambia. Es una API REST sin acoplamiento a ningun framework.

## Correr

```bash
npm install
npm run dev     # http://localhost:4200
```

El backend debe estar corriendo en el puerto 3000. Vite hace proxy de `/api`
hacia alli, asi que en desarrollo no hay CORS de por medio.

## Estructura

```
src/
  api/
    tipos.ts      Interfaces del dominio. Espejo de backend/src/repo.ts
    cliente.ts    Llamadas HTTP y ayudas de formato
  ganchos/
    useDatos.ts   Carga de datos con estados de cargando y error
  componentes/
    Shell.tsx     Barra lateral, barra superior y contenido
    Estado.tsx    Cargando, error, vacio, avisos
  paginas/
    Dashboard.tsx  MIGRADA -- usar como referencia
    Historial.tsx  MIGRADA -- el ejemplo mas simple
    Despacho.tsx   pendiente
    Plantillas.tsx pendiente
    Catalogo.tsx   pendiente
  estilos.css     Copiado tal cual del proyecto en Angular
```

## Estado de la migracion

| Pantalla    | Estado    | Angular equivalente            | Lineas aprox. |
|-------------|-----------|--------------------------------|---------------|
| Dashboard   | Migrada   | dashboard.component             | 118 + 187     |
| Historial   | Migrada   | historial.component             | 46 + 41       |
| Catalogo    | Pendiente | catalogo.component              | 326 + 174     |
| Plantillas  | Pendiente | plantillas + plantilla-form     | 337 + 369     |
| Despacho    | Pendiente | despacho.component              | 498 + 242     |

Cada pagina pendiente tiene, en su archivo, la lista de lo que hay que
reproducir y los detalles que no se pueden perder.

## Orden sugerido

De menor a mayor dificultad, para ir ganando soltura:

1. `Catalogo` — formularios sueltos, sin dependencias entre campos.
2. `Plantillas` — formulario por pasos y la actualizacion masiva de tarifas.
3. `Despacho` — dejarla de ultima. Es la unica con cadena de dependencias
   (vehiculo -> vias -> piso -> FOPAT) y la que mas ensena sobre useEffect.

## Diferencias con Angular que conviene tener presentes

**Promesas en vez de Observables.** `api.getVehiculos()` devuelve una Promise:
se consume con `await`, no con `.subscribe()`.

**No mutar el estado.** En Angular se podia hacer `this.remesas[0].peso = 100`.
En React eso no redibuja nada: hay que crear un arreglo nuevo con
`setRemesas(remesas.map(...))`.

**Los getters pasan a ser calculos en el cuerpo del componente.** Un
`get pesoTotal()` de Angular aqui es simplemente
`const pesoTotal = remesas.reduce(...)` antes del return: se recalcula en cada
render, que es lo que se quiere.

**Los metodos alCambiarX() pasan a useEffect.** Con una advertencia: el efecto
que escribe un valor no puede depender de ese mismo valor, o entra en bucle.
