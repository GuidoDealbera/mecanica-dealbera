import React from "react";

/**
 * Las pantallas, cargadas de forma diferida.
 *
 * Viven en su propio módulo y no junto al router por Fast Refresh: un archivo
 * que **define** componentes pero exporta otra cosa —el router es un objeto—
 * obliga a recargar la página entera en cada cambio, y `react-refresh` lo avisa
 * con una advertencia por cada uno. Separándolos, este archivo exporta sólo
 * componentes y el del router sólo el router.
 *
 * `React.lazy` va a nivel de módulo: si se creara durante el render, el
 * componente sería nuevo en cada pasada y la pantalla se remontaría sola.
 *
 * El arranque baja únicamente el shell —barra de navegación y layout— y cada
 * pantalla llega en su propio chunk la primera vez que se visita.
 */
export const HomePage = React.lazy(() => import("../Pages/HomePage"));
export const CarsPage = React.lazy(() => import("../Pages/CarsPage"));
export const AddCarPage = React.lazy(() => import("../Pages/AddCarPage"));
export const AddJobPage = React.lazy(() => import("../Pages/AddJobPage"));
export const CarDetailPage = React.lazy(() => import("../Pages/CarDetailPage"));
export const ClientPage = React.lazy(() => import("../Pages/ClientPage"));
export const ClientDetailPage = React.lazy(
  () => import("../Pages/ClientDetailPage")
);
export const ServiceAlertsPage = React.lazy(
  () => import("../Pages/ServiceAlertsPage")
);
export const BackupPage = React.lazy(() => import("../Pages/BackupPage"));
