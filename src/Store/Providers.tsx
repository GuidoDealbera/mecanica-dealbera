import React from "react";
import { ToastProvider } from "@heroui/react";
import { HeroUIProvider } from "@heroui/react";
import { Provider } from "react-redux";
import { store } from "./store";
import { ThemeProvider } from "../Theme/ThemeProvider";

const Providers: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <Provider store={store}>
      <ThemeProvider>
        {/* HeroUI fija `en-US` por defecto y le gana al idioma del sistema:
            por eso el autocompletar se anunciaba como "Show suggestions" en
            una Windows en castellano. Con esto, todo lo que traduce
            react-aria —botones, listas, avisos para lectores de pantalla—
            sale en castellano. Lo que HeroUI escribe a mano no pasa por acá:
            ver `CerrarModal`. */}
        <HeroUIProvider locale="es-AR">
          <ToastProvider
            placement="bottom-right"
            maxVisibleToasts={3}
            toastProps={{
              radius: "sm",
              variant: "flat",
              timeout: 5000,
              shadow: "md",
            }}
          />
          {children}
        </HeroUIProvider>
      </ThemeProvider>
    </Provider>
  );
};

export default Providers;
