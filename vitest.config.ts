import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Config aislada para tests. No usa el plugin de Electron: los tests corren en
// Node, sin ventana ni proceso principal.
//
// Hay dos clases de test y conviven en el mismo comando:
//
// - **Node** (por defecto): módulos puros y lógica de base de datos, que corre
//   contra copias de SQLite en un directorio temporal.
// - **jsdom**: componentes con reglas de negocio. Se activa por archivo con
//   `// @vitest-environment jsdom` en vez de globalmente, para no pagar el
//   arranque del DOM en los tests que no lo necesitan.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}", "electron/**/*.{test,spec}.ts"],
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
});
