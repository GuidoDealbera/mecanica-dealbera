import { Suspense } from "react";
import RouteLoadingOverlay from "./RouteLoadingOverlay";

/**
 * Envoltorio de las pantallas diferidas: resuelve el `Suspense` y su fallback
 * en un solo lugar, para no repetirlo en cada ruta ni depender de un `Suspense`
 * en el layout.
 *
 * Se usa junto a `React.lazy` (que debe invocarse a nivel de módulo, nunca
 * durante el render: si no, cada render crearía un componente nuevo y la
 * pantalla se remontaría en loop):
 *
 * ```tsx
 * const HomePage = React.lazy(() => import("../Pages/HomePage"));
 * { path: "/", element: <LazyPage><HomePage /></LazyPage> }
 * ```
 */
const LazyPage = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<RouteLoadingOverlay />}>{children}</Suspense>
);

export default LazyPage;
