import React from "react";
import { ToastProvider } from "@heroui/react";
import { HeroUIProvider } from "@heroui/react";
import { Provider } from "react-redux";
import { store } from "./store";

const Providers: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <Provider store={store}>
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
    </Provider>
  );
};

export default Providers