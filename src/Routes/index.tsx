import { createHashRouter, RouteObject } from "react-router-dom";
import React from "react";
import Layout from "../Components/Layout";
import HomePage from "../Pages/HomePage";
import AddCarPage from "../Pages/AddCarPage";
import CarsPage from "../Pages/CarsPage";
import ClientPage from "../Pages/ClientPage";
import CarDetailPage from "../Pages/CarDetailPage";
import AddJobPage from "../Pages/AddJobPage";
import NotFoundPage from "../Pages/NotFoundPage";
import ClientDetailPage from "../Pages/ClientDetailPage";
import ServiceAlertsPage from "../Pages/ServiceAlertsPage";
import BackupPage from "../Pages/BackupPage";
import ErrorBoundary from "../Pages/Components/ErrorBoundary";

const withBoundary = (Page: React.ComponentType) => (
  <ErrorBoundary>
    <Page />
  </ErrorBoundary>
);

const routes: RouteObject[] = [
  { path: "/",               element: withBoundary(HomePage) },
  { path: "/cars",           element: withBoundary(CarsPage) },
  { path: "/cars/new",       element: withBoundary(AddCarPage) },
  { path: "/cars/add-job",   element: withBoundary(AddJobPage) },
  { path: "/cars/:licence",  element: withBoundary(CarDetailPage) },
  { path: "/clients",        element: withBoundary(ClientPage) },
  { path: "/clients/:fullname", element: withBoundary(ClientDetailPage) },
  { path: "/alerts",         element: withBoundary(ServiceAlertsPage) },
  { path: "/backup",         element: withBoundary(BackupPage) },
];

const router = createHashRouter([
  {
    path: "/",
    element: <Layout />,
    children: routes,
  },
  {
    path: '*',
    element: <NotFoundPage/>
  }
]);

export default router;
