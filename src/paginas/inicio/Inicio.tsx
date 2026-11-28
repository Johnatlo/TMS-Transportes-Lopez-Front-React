/**
 * Pagina de Inicio personalizable: una rejilla de tarjetas que cada usuario
 * acomoda (arrastrar, cambiar tamano, quitar y agregar) y guarda en su cuenta.
 */
import { useEffect, useRef, useState } from "react";
import { auth } from "../../api/cliente";
import type { TarjetaInicio } from "../../api/cliente";
import { useSesion } from "../../ganchos/useSesion";
import { ErrorCarga } from "../../componentes/Estado";
import { ProveedorInicio, useInicio } from "./DatosInicio";
import RejillaInicio, { type ManejoRejilla } from "./RejillaInicio";
import { TARJETAS } from "./Tarjetas";
import { inicioDelRol, inicioUsable, ordenLectura, tarjetasDelRol } from "./catalogoInicio";
import type { DefinicionTarjeta } from "./catalogoInicio";

/** Si la pantalla es de celular (ahi las tarjetas van en una columna y no se personaliza). */
function useCelular(): boolean {
  const consulta = "(max-width: 820px)";
  const [celular, setCelular] = useState(() => typeof window.matchMedia === "function" && window.matchMedia(consulta).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const m = window.matchMedia(consulta);
    const cambio = () => setCelular(m.matches);
    m.addEventListener("change", cambio);
    return () => m.removeEventListener("change", cambio);
  }, []);
  return celular;
}

/**
 * Inicio de SOFI.
 *
 * Arranca con el inicio guardado del usuario o, si no tiene, con el de su rol
 * (catalogoInicio.ts). "Personalizar inicio" (solo en el computador) deja
 * arrastrar las tarjetas, agrandarlas desde la esquina, quitarlas con la X y
 * agregar otras del catalogo; "Guardar mi inicio" lo guarda en su cuenta (lo
 * ve igual en cualquier computador) y "Volver al inicio de mi rol" borra lo
 * guardado. En el celular las tarjetas salen en una columna, en el orden
 * guardado (de arriba a abajo y de izquierda a derecha).
 */
export default function Inicio() {
  return (
    <ProveedorInicio>
      <PaginaInicio />
    </ProveedorInicio>
  );
}

/** El contenido del Inicio (dentro del proveedor de datos). */
function PaginaInicio() {
  const { usuario } = useSesion();
  const rol = usuario?.rol ?? "ADMINISTRATIVO";
  const datos = useInicio();
  const celular = useCelular();
  const rejilla = useRef<ManejoRejilla>(null);

  const [tarjetas, setTarjetas] = useState<TarjetaInicio[] | null>(null);
  const [editando, setEditando] = useState(false);
  const [respaldo, setRespaldo] = useState<TarjetaInicio[]>([]);
  // Cambia para volver a crear la rejilla (al cancelar o volver al inicio del rol).
  const [version, setVersion] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  useEffect(() => {
    let vivo = true;
    auth
      .inicio()
      .then((r) => vivo && setTarjetas(inicioUsable(r.tarjetas, rol)))
      // Si no se pudo leer, se muestra el del rol (no se pierde nada: no se guarda solo).
      .catch(() => vivo && setTarjetas(inicioDelRol(rol)));
    return () => {
      vivo = false;
    };
  }, [rol]);

  // El aviso se va solo.
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 4000);
    return () => clearTimeout(t);
  }, [aviso]);

  // En el celular no se edita.
  useEffect(() => {
    if (celular && editando) cancelar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celular]);

  if (!tarjetas) return null;

  function personalizar() {
    setRespaldo(tarjetas!);
    setAviso(null);
    setEditando(true);
  }

  function cancelar() {
    setTarjetas(respaldo);
    setEditando(false);
    setVersion((v) => v + 1);
  }

  /** Agrega una tarjeta del catalogo: gridstack le busca el primer lugar libre. */
  function agregar(d: DefinicionTarjeta) {
    setTarjetas((t) => [...(t ?? []), { id: d.id, x: -1, y: 0, w: d.w, h: d.h }]);
  }

  function quitar(id: string) {
    rejilla.current?.quitar(id);
    setTarjetas((t) => (t ?? []).filter((x) => x.id !== id));
  }

  async function guardar() {
    const disposicion = rejilla.current?.disposicion() ?? tarjetas!;
    setGuardando(true);
    try {
      const r = await auth.guardarInicio(disposicion);
      setTarjetas(r.tarjetas);
      setEditando(false);
      setAviso({ tipo: "ok", texto: "Tu inicio quedo guardado." });
    } catch (e) {
      setAviso({ tipo: "error", texto: e instanceof Error ? e.message : "No se pudo guardar tu inicio." });
    } finally {
      setGuardando(false);
    }
  }

  async function volverAlDelRol() {
    if (!window.confirm("¿Volver al inicio de tu rol? Se pierde lo que personalizaste.")) return;
    setGuardando(true);
    try {
      await auth.borrarInicio();
      setTarjetas(inicioDelRol(rol));
      setEditando(false);
      setVersion((v) => v + 1);
      setAviso({ tipo: "ok", texto: "Volviste al inicio de tu rol." });
    } catch (e) {
      setAviso({ tipo: "error", texto: e instanceof Error ? e.message : "No se pudo volver al inicio de tu rol." });
    } finally {
      setGuardando(false);
    }
  }

  /** Una tarjeta en su hueco: entra en cascada y, al editar, lleva la X para quitarla. */
  const pintar = (t: TarjetaInicio, i: number) => {
    const Tarjeta = TARJETAS[t.id];
    return (
      <div className="tarjeta-inicio-hueco" style={{ ["--orden" as string]: Math.min(i, 12) }}>
        {editando && (
          <button className="tarjeta-quitar" onClick={() => quitar(t.id)} aria-label="Quitar del inicio" title="Quitar del inicio">
            ×
          </button>
        )}
        {Tarjeta ? <Tarjeta /> : null}
      </div>
    );
  };

  const enInicio = new Set(tarjetas.map((t) => t.id));
  const catalogo = tarjetasDelRol(rol);

  return (
    <div className="inicio">
      {datos.error && <ErrorCarga mensaje={datos.error} alReintentar={datos.recargar} />}
      {!celular && (
        <div className={`inicio-barra${editando ? " editando" : ""}`}>
          {aviso && <span className={aviso.tipo === "ok" ? "texto-ok" : "texto-vencido"}>{aviso.texto}</span>}
          {editando ? (
            <>
              <span className="dato-sec inicio-ayuda">Arrastra las tarjetas, agrandalas desde la esquina o quitalas con la ×.</span>
              <button className="btn-link" onClick={volverAlDelRol} disabled={guardando}>
                Volver al inicio de mi rol
              </button>
              <button className="btn-secondary" onClick={cancelar} disabled={guardando}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={guardar} disabled={guardando}>
                {guardando ? "Guardando..." : "Guardar mi inicio"}
              </button>
            </>
          ) : (
            <button className="btn-secondary" onClick={personalizar}>
              Personalizar inicio
            </button>
          )}
        </div>
      )}

      <div className={`inicio-cuerpo${editando ? " con-catalogo" : ""}`}>
        {celular ? (
          <div className="lista-inicio">
            {ordenLectura(tarjetas).map((t, i) => (
              <div key={t.id} className={`lista-inicio-item alto-${Math.min(t.h, 6)}`}>
                {pintar(t, i)}
              </div>
            ))}
          </div>
        ) : (
          <RejillaInicio key={version} ref={rejilla} tarjetas={tarjetas} editando={editando} pintar={pintar} />
        )}
        {tarjetas.length === 0 && !editando && (
          <div className="inicio-vacio">
            <p>Tu inicio esta vacio.</p>
            {!celular && (
              <button className="btn-primary" onClick={personalizar}>
                Agregar tarjetas
              </button>
            )}
          </div>
        )}

        {editando && (
          <aside className="catalogo-inicio" aria-label="Agregar al inicio">
            <h2>Agregar al inicio</h2>
            <p className="dato-sec">Solo ves lo que tu rol puede consultar.</p>
            {[...new Set(catalogo.map((d) => d.grupo))].map((grupo) => (
              <div key={grupo} className="catalogo-inicio-grupo">
                <h3>{grupo === "Operacion" ? "Operacion" : grupo}</h3>
                {catalogo
                  .filter((d) => d.grupo === grupo)
                  .map((d) => (
                    <div key={d.id} className="catalogo-inicio-item">
                      <div>
                        <strong>{d.titulo}</strong>
                        <span className="dato-sec">{d.descripcion}</span>
                      </div>
                      {enInicio.has(d.id) ? (
                        <span className="dato-sec catalogo-inicio-esta">En tu inicio</span>
                      ) : (
                        <button className="btn-secondary" onClick={() => agregar(d)}>
                          Agregar
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            ))}
          </aside>
        )}
      </div>
    </div>
  );
}
