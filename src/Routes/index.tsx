import React from "react";
import { createHashRouter, RouteObject } from "react-router-dom";
import Layout from "../Components/Layout";
import LazyPage from "../Components/LazyPage";
// NotFound se importa de forma normal: pesa menos de 1 kB y es la ruta de
// fallback, así que conviene que aparezca al instante y sin loader.
import NotFoundPage from "../Pages/NotFoundPage";

// Todas las pantallas se cargan de forma diferida: el arranque sólo baja el
// shell (barra de navegación + layout) y cada pantalla llega en su propio chunk
// la primera vez que se visita. `React.lazy` va acá, a nivel de módulo: si se
// creara durante el render, el componente sería nuevo en cada pasada.
const HomePage = React.lazy(() => import("../Pages/HomePage"));
const CarsPage = React.lazy(() => import("../Pages/CarsPage"));
const AddCarPage = React.lazy(() => import("../Pages/AddCarPage"));
const AddJobPage = React.lazy(() => import("../Pages/AddJobPage"));
const CarDetailPage = React.lazy(() => import("../Pages/CarDetailPage"));
const ClientPage = React.lazy(() => import("../Pages/ClientPage"));
const ClientDetailPage = React.lazy(() => import("../Pages/ClientDetailPage"));
const ServiceAlertsPage = React.lazy(
  () => import("../Pages/ServiceAlertsPage")
);
const BackupPage = React.lazy(() => import("../Pages/BackupPage"));

// Las pantallas no se envuelven una por una en un `ErrorBoundary`: el `Layout`
// ya tiene uno alrededor del `Outlet` (remontado por ruta), así que hacerlo acá
// era un tercer nivel anidado sin ningún beneficio.
const routes: RouteObject[] = [
  {
    path: "/",
    element: (
      <LazyPage>
        <HomePage />
      </LazyPage>
    ),
  },
  {
    path: "/cars",
    element: (
      <LazyPage>
        <CarsPage />
      </LazyPage>
    ),
  },
  {
    path: "/cars/new",
    element: (
      <LazyPage>
        <AddCarPage />
      </LazyPage>
    ),
  },
  {
    path: "/cars/add-job",
    element: (
      <LazyPage>
        <AddJobPage />
      </LazyPage>
    ),
  },
  {
    path: "/cars/:licence",
    element: (
      <LazyPage>
        <CarDetailPage />
      </LazyPage>
    ),
  },
  {
    path: "/clients",
    element: (
      <LazyPage>
        <ClientPage />
      </LazyPage>
    ),
  },
  {
    path: "/clients/:fullname",
    element: (
      <LazyPage>
        <ClientDetailPage />
      </LazyPage>
    ),
  },
  {
    path: "/alerts",
    element: (
      <LazyPage>
        <ServiceAlertsPage />
      </LazyPage>
    ),
  },
  {
    path: "/backup",
    element: (
      <LazyPage>
        <BackupPage />
      </LazyPage>
    ),
  },
];

const router = createHashRouter([
  {
    path: "/",
    element: <Layout />,
    children: routes,
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);

export default router;
