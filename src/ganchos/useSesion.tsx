/**
 * Sesion del usuario: proveedor de contexto y gancho para leerla. Vuelve al
 * login cuando el backend avisa que la sesion vencio.
 */
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { auth, EVENTO_SESION_VENCIDA } from "../api/cliente";
import type { Usuario } from "../api/tipos";
import { aplicarPreferencia, pintarAutomatico, preferenciaValida } from "../modoPantalla";

type EstadoSesion = "cargando" | "anonimo" | "conectado";

interface ContextoSesion {
  estado: EstadoSesion;
  usuario: Usuario | null;
  entrar: (email: string, clave: string) => Promise<void>;
  salir: () => Promise<void>;
  /** Reemplaza el usuario en memoria (por ejemplo tras cambiar la clave). */
  actualizarUsuario: (u: Usuario) => void;
}

const Contexto = createContext<ContextoSesion | null>(null);

/**
 * Guarda quien esta conectado y lo comparte con toda la aplicacion.
 *
 * Es un Context de React: un valor que cualquier componente de adentro puede
 * leer con useSesion(), sin pasarlo de mano en mano por props. Al montarse
 * pregunta al backend "quien soy" (la cookie la manda el navegador solo); y
 * escucha el evento de sesion vencida que dispara el cliente de la API ante
 * un 401, para volver al login sin importar en que pantalla se estaba.
 */
export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoSesion>("cargando");
  const [usuario, setUsuarioBase] = useState<Usuario | null>(null);
  // Al saber quien entro, se pinta con el modo que eligio (o automatico por la hora).
  // Sin sesion (login) siempre es automatico.
  const setUsuario = useCallback((u: Usuario | null) => {
    if (u) aplicarPreferencia(preferenciaValida(u.tema));
    else pintarAutomatico();
    setUsuarioBase(u);
  }, []);

  useEffect(() => {
    auth
      .sesion()
      .then((u) => {
        setUsuario(u);
        setEstado("conectado");
      })
      .catch(() => setEstado("anonimo"));

    const alVencer = () => {
      setUsuario(null);
      setEstado("anonimo");
    };
    window.addEventListener(EVENTO_SESION_VENCIDA, alVencer);
    return () => window.removeEventListener(EVENTO_SESION_VENCIDA, alVencer);
  }, [setUsuario]);

  const entrar = useCallback(
    async (email: string, clave: string) => {
      const u = await auth.login(email, clave);
      setUsuario(u);
      setEstado("conectado");
    },
    [setUsuario],
  );

  const salir = useCallback(async () => {
    try {
      await auth.logout();
    } finally {
      setUsuario(null);
      setEstado("anonimo");
    }
  }, [setUsuario]);

  return <Contexto.Provider value={{ estado, usuario, entrar, salir, actualizarUsuario: setUsuario }}>{children}</Contexto.Provider>;
}

/** Sesion actual (estado, usuario, entrar, salir). Debe usarse dentro de <ProveedorSesion>. */
export function useSesion(): ContextoSesion {
  const c = useContext(Contexto);
  if (!c) throw new Error("useSesion debe usarse dentro de <ProveedorSesion>");
  return c;
}
