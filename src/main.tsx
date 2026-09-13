import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { RouterProvider } from "react-router-dom";
import router from "./Routes";
import Providers from "./Store/Providers";
import ErrorBoundary from "./Pages/Components/ErrorBoundary";
import { reportarError } from "./Utils/reportarError";

// Lo que el `ErrorBoundary` no ve: un error en un manejador de evento, en un
// `setTimeout` o una promesa sin `catch`. React no los atrapa —no ocurren
// durante el renderizado— y antes tampoco dejaban rastro en ningún lado.
window.addEventListener("error", (evento) => {
  reportarError("renderer:error", evento.error ?? evento.message);
});

window.addEventListener("unhandledrejection", (evento) => {
  reportarError("renderer:promesa", evento.reason);
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Providers>
      <ErrorBoundary>
        <RouterProvider router={router} />
      </ErrorBoundary>
    </Providers>
  </React.StrictMode>
);
