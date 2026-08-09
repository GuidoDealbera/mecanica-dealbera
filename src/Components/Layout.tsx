import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Header from "./Header";
import ErrorBoundary from "../Pages/Components/ErrorBoundary";

/**
 * Shell de la aplicación: alto fijo de ventana, sin scroll propio.
 *
 * La barra de navegación queda siempre visible y el `main` le da a la página el
 * alto disponible exacto. El `min-h-0` es imprescindible: sin él, el `main` se
 * estira con el contenido y el scroll interno de las páginas nunca se activa.
 *
 * Éste es el único `ErrorBoundary` de las páginas: cubre todo lo que se
 * renderiza en el `Outlet` y, al estar dentro del Router, puede volver atrás de
 * verdad. El `key` por ruta lo remonta al navegar, así un error en una pantalla
 * no deja la siguiente bloqueada. (El de `main.tsx` queda como última red, para
 * lo que falle fuera del ruteo.)
 *
 * El `Suspense` de las pantallas diferidas lo pone cada ruta (ver `lazyPage` en
 * `src/Routes`); acá sólo hace falta el `relative` para que ese overlay se
 * posicione sobre el área de contenido y la barra siga visible.
 */
const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <div className="h-screen overflow-hidden flex flex-col">
      <div className="shrink-0">
        <Header />
      </div>
      <main className="relative flex-1 min-h-0 p-4">
        <ErrorBoundary key={location.pathname} onBack={() => navigate(-1)}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
};

export default Layout;
