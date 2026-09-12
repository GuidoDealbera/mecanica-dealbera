import { createHashRouter, RouteObject } from "react-router-dom";
import Layout from "../Components/Layout";
import LazyPage from "../Components/LazyPage";
// NotFound se importa de forma normal: pesa menos de 1 kB y es la ruta de
// fallback, así que conviene que aparezca al instante y sin loader.
import NotFoundPage from "../Pages/NotFoundPage";
// Las pantallas diferidas viven en su propio módulo: ver el porqué allá.
import {
  AddCarPage,
  AddJobPage,
  BackupPage,
  CarDetailPage,
  CarsPage,
  ClientDetailPage,
  ClientPage,
  HomePage,
  ServiceAlertsPage,
} from "./lazyPages";

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
