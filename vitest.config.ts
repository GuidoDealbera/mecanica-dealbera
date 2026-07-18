import { defineConfig } from "vitest/config";

// Config aislada para tests unitarios. No usa el plugin de Electron:
// los tests apuntan a lógica pura (utilidades, formateadores, cálculo de
// alertas) que corre en un entorno Node sin DOM ni ventana de Electron.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    globals: true,
  },
});
