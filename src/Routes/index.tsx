import { createBrowserRouter, RouteObject } from "react-router-dom";
import Layout from "../Components/Layout";
import HomePage from "../Pages/HomePage";
import { createElement } from "react";
import AddCarPage from "../Pages/AddCarPage";
import CarsPage from "../Pages/CarsPage";
import ClientPage from "../Pages/ClientPage";
import CarDetailPage from "../Pages/CarDetailPage";

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
    path: "/clients",
    element: createElement(ClientPage),
  },
];

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: routes,
  },
]);

export default router;
