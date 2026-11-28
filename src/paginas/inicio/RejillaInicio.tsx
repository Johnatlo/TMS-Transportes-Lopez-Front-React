/**
 * Rejilla de 12 columnas del Inicio (gridstack.js): React pinta las tarjetas
 * y gridstack las acomoda, las arrastra y les cambia el tamano.
 */
import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
import { GridStack } from "gridstack";
import "gridstack/dist/gridstack.min.css";
import type { TarjetaInicio } from "../../api/cliente";
import { COLUMNAS, definicion } from "./catalogoInicio";

/** Alto de una fila de la rejilla y separacion entre tarjetas (la mitad a cada lado). */
const ALTO_FILA = 84;
const MARGEN = 8;

/** Lo que el Inicio le pide a la rejilla. */
export interface ManejoRejilla {
  /** Las tarjetas como estan ahora (despues de arrastrar o cambiar tamanos). */
  disposicion: () => TarjetaInicio[];
  /** Quita una tarjeta de la rejilla (antes de quitarla de la lista de React). */
  quitar: (id: string) => void;
}

/**
 * Rejilla del Inicio.
 *
 * gridstack se crea una vez sobre las tarjetas que React ya pinto (cada una con
 * su gs-id, gs-x, gs-y, gs-w y gs-h). Si React agrega una tarjeta, se le
 * entrega a gridstack con makeWidget y gridstack le busca lugar; para quitar
 * una, primero se suelta de gridstack (quitar) y luego React la borra.
 * Las posiciones no viven en el estado de React mientras se edita: al guardar
 * se leen de gridstack (disposicion).
 *
 * Fuera de `editando` la rejilla queda fija (no se arrastra ni cambia de
 * tamano) y el contenido de las tarjetas se puede usar.
 */
const RejillaInicio = forwardRef<ManejoRejilla, { tarjetas: TarjetaInicio[]; editando: boolean; pintar: (t: TarjetaInicio, i: number) => ReactNode }>(
  function RejillaInicio({ tarjetas, editando, pintar }, ref) {
    const caja = useRef<HTMLDivElement>(null);
    const rejilla = useRef<GridStack | null>(null);

    useLayoutEffect(() => {
      if (!caja.current) return;
      const g = GridStack.init(
        {
          column: COLUMNAS,
          cellHeight: ALTO_FILA,
          margin: MARGEN,
          // Las tarjetas suben a llenar los huecos de arriba.
          mode: "top",
          animate: true,
          staticGrid: !editando,
          // En el celular el Inicio no usa la rejilla (ver Inicio.tsx); esto es por si la ventana se angosta.
          columnOpts: { breakpoints: [{ w: 820, c: 1 }] },
          resizable: { handles: "se" },
        },
        caja.current,
      );
      if (!g) return;
      rejilla.current = g;
      return () => {
        g.destroy(false);
        rejilla.current = null;
      };
      // Se crea una sola vez; editando se cambia abajo con setStatic.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useLayoutEffect(() => {
      rejilla.current?.setStatic(!editando);
    }, [editando]);

    // Tarjetas nuevas que React acaba de pintar: se las entrega a gridstack.
    useLayoutEffect(() => {
      const g = rejilla.current;
      if (!g || !caja.current) return;
      const nuevas = Array.from(caja.current.querySelectorAll<HTMLElement>(":scope > .grid-stack-item")).filter(
        (el) => !(el as { gridstackNode?: unknown }).gridstackNode,
      );
      for (const el of nuevas) {
        g.makeWidget(el);
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }, [tarjetas]);

    useImperativeHandle(ref, () => ({
      disposicion: () => {
        const g = rejilla.current;
        if (!g) return tarjetas;
        return g.getGridItems().flatMap((el) => {
          const n = el.gridstackNode;
          if (!n?.id) return [];
          return [{ id: String(n.id), x: n.x ?? 0, y: n.y ?? 0, w: n.w ?? 1, h: n.h ?? 1 }];
        });
      },
      quitar: (id) => {
        const g = rejilla.current;
        const el = caja.current?.querySelector<HTMLElement>(`:scope > .grid-stack-item[gs-id="${CSS.escape(id)}"]`);
        if (g && el) g.removeWidget(el, false, false);
      },
    }));

    return (
      <div ref={caja} className={`grid-stack rejilla-inicio${editando ? " inicio-editando" : ""}`}>
        {tarjetas.map((t, i) => {
          const d = definicion(t.id);
          const nueva = t.x < 0;
          return (
            <div
              key={t.id}
              className="grid-stack-item"
              gs-id={t.id}
              gs-x={nueva ? undefined : t.x}
              gs-y={nueva ? undefined : t.y}
              gs-w={t.w}
              gs-h={t.h}
              gs-min-w={d?.minW}
              gs-min-h={d?.minH}
              gs-auto-position={nueva ? "true" : undefined}
            >
              <div className="grid-stack-item-content">{pintar(t, i)}</div>
            </div>
          );
        })}
      </div>
    );
  },
);

export default RejillaInicio;
