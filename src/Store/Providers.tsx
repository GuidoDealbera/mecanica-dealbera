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
        <HeroUIProvider>
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

export default Providers