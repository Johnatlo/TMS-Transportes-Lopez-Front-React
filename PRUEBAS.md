# Pruebas unitarias — Frontend

Pruebas automáticas de las funciones de presentación del TMS: formatos de
moneda y fecha, y estados y colores del Cuadro pagos.

Se hacen con **[Vitest](https://vitest.dev)**, el mismo motor de Vite. Corren
sin navegador y sin backend.

Las reglas de negocio del RNDC (pisos de SICETAC, retenciones, cumplidos) se
prueban en el backend: ver `backend/PRUEBAS.md`.

---

## 1. Cómo correrlas

```bash
cd frontend-react
npm test             # corre todas las pruebas una vez
npm run test:watch   # las vuelve a correr cada vez que guardas un archivo
```

Resultado esperado:

```
 ✓ src/paginas/cuadro/estadosCuadro.test.ts  (16 tests)
 ✓ src/api/formatos.test.ts                  (6 tests)
 Test Files  2 passed (2)
      Tests  22 passed (22)
```

`npm run build` revisa también los tipos de las pruebas (`tsc -b`). Los archivos
`.test.ts` no entran al paquete final: Vite solo empaqueta lo que importa la
aplicación.

---

## 2. Qué cubren

### 2.1 `src/api/formatos.test.ts` — Formatos de pantalla

| Regla | Caso |
|---|---|
| Moneda con punto de miles. | 4019761 → "4.019.761" |
| Fecha y hora siempre en hora de Colombia, sin importar la zona del equipo. | 03:00 UTC del 01/10 → "30/09/2026, 22:00" |
| Una fecha sin hora no se corre de día. | "2026-09-30T00:00:00Z" → "30/09/2026" |
| Sin valor se muestra un guion. | `null` → "-" |

### 2.2 `src/paginas/cuadro/estadosCuadro.test.ts` — Cuadro pagos

**Colores**, iguales a los del Excel "CUADRO CENTRAL":

| Estado | Pastilla |
|---|---|
| En proceso | Gris |
| Sin radicar | Morado |
| Radicado | Verde |
| Facturado sin datos | Azul |
| Facturado | Azul claro |
| Factura pagada | Verde (ok) |
| Todo pagado | Amarillo |

**Papeles:**

| Cliente | Pasos |
|---|---|
| CORAME / Cartones América | En ruta → con el conductor → parqueadero → Don Alexander → radicados |
| Los demás | En ruta → con el conductor → radicados |

**Fechas y saldos:**

| Regla | Caso |
|---|---|
| `fechaCorta` no se corre de día. | "2026-09-30" → "30/09/2026" |
| "Hoy" es el de Colombia. | 22:00 del 07/10 en Colombia (03:00 del 08/10 en UTC) → "2026-10-07" |
| El saldo del tercero vence el día indicado, no antes. | Vence 21/10: el 20/10 no está vencido, el 21/10 sí. |
| No hay vencimiento si ya se pagó, si es flota propia, si está anulado o si no hay fecha de descargue. | — |

Las pruebas de fechas fijan el reloj (`vi.setSystemTime`) para que den el mismo
resultado cualquier día que se corran.

---

## 3. Qué NO cubren

Los componentes de React (pantallas, ventanas, formularios) no tienen pruebas
unitarias. Se verifican abriendo la aplicación: `npm run dev` y revisar la
pantalla, también a 390 px de ancho (celular), como indica `GUIA-UI.md`.

---

## 4. Cómo agregar una prueba

1. Crea `algo.test.ts` junto al archivo que pruebas.
2. Prueba **funciones**, no componentes: si una pantalla tiene lógica (un cálculo,
   un estado), sácala a una función en un `.ts` aparte, como `estadosCuadro.ts`.
3. Nombra cada prueba con la regla que protege, en español.
4. Si depende de la fecha de hoy, fija el reloj con `vi.useFakeTimers()` y
   `vi.setSystemTime(...)`, y restáuralo con `vi.useRealTimers()`.
5. Corre `npm test` y `npm run build`.
