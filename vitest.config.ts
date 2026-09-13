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
  resolve: {
    alias: {
      // `electron-log` hace su propio `require("electron")` para resolver
      // rutas, y eso no lo intercepta el `vi.mock("electron")` de cada test:
      // el mock vale para el módulo bajo prueba, no para lo que pida una
      // dependencia por su cuenta. Sin este alias se carga el paquete real,
      // que busca el binario de Electron y falla con "Electron failed to
      // install correctly" en cualquier máquina que no lo tenga descargado.
      //
      // En local no se notaba y en el CI reventaban trece tests.
      "electron-log/main": new URL(
        "./src/test/electronLogStub.ts",
        import.meta.url
      ).pathname,
    },
  },
  test: {
    // Los 5 segundos por defecto no alcanzan para los tests de base de datos:
    // cada archivo levanta un `DataSource` y corre las once migraciones, y en
    // frío —como corre siempre en CI— la primera pasada se lleva más de diez.
    //
    // `hookTimeout` va aparte y es el que faltaba: el plazo del `beforeEach`
    // **no** es el del test, así que ponerlo por caso no servía de nada. Se
    // cayó un test por esto justo después de escribirlo.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    environment: "node",
    coverage: {
      provider: "v8",
      // `text` para leerlo acá mismo y `html` para poder navegarlo cuando hay
      // que buscar qué rama quedó afuera.
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}", "electron/**/*.ts"],
      exclude: [
        // Lo que no tiene sentido medir: tipos sin código, la maquetación de
        // las pantallas y el propio andamiaje de los tests.
        "**/*.d.ts",
        "**/*.test.{ts,tsx}",
        "src/test/**",
        "src/main.tsx",
        "src/Types/**",
        "electron/DataBase/Types/**",
        "electron/DataBase/Entities/**",
      ],
      /**
       * Umbrales como **trinquete**, no como meta.
       *
       * Están puestos apenas por debajo de lo medido hoy: no dicen "esto es
       * suficiente" —no lo es—, dicen "de acá no se baja". Un número aspiracional
       * que falla todos los días se termina bajando o apagando; uno que sólo
       * falla cuando la cobertura **retrocede** avisa de algo real.
       *
       * Al agregar tests conviene subirlos.
       */
      thresholds: {
        statements: 47,
        branches: 39,
        functions: 35,
        lines: 48,
      },
    },
    include: ["src/**/*.{test,spec}.{ts,tsx}", "electron/**/*.{test,spec}.ts"],
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
});
