import { createHashRouter, RouteObject } from "react-router-dom";
import Layout from "../Components/Layout";
import HomePage from "../Pages/HomePage";
import { createElement } from "react";
import AddCarPage from "../Pages/AddCarPage";
import CarsPage from "../Pages/CarsPage";
import ClientPage from "../Pages/ClientPage";
import CarDetailPage from "../Pages/CarDetailPage";
import AddJobPage from "../Pages/AddJobPage";
import NotFoundPage from "../Pages/NotFoundPage";
import ClientDetailPage from "../Pages/ClientDetailPage";
import ServiceAlertsPage from "../Pages/ServiceAlertsPage";
import BackupPage from "../Pages/BackupPage";

const routes: RouteObject[] = [
  {
    path: "/",
    element: createElement(HomePage),
  },
  {
    path: "/cars",
    element: createElement(CarsPage),
  },
  {
    path: "/cars/new",
    element: createElement(AddCarPage),
  },
  {
    path: "/cars/:licence",
    element: createElement(CarDetailPage),
  },
  {
    path: "/cars/add-job",
    element: createElement(AddJobPage),
  },
  {
    path: "/clients",
    element: createElement(ClientPage),
  },
  {
    path: "/clients/:fullname",
    element: createElement(ClientDetailPage)
  },
  {
    path: "/alerts",
    element: createElement(ServiceAlertsPage)
  },
  {
    path: "/backup",
    element: createElement(BackupPage)
  }
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
