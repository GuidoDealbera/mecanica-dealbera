import { defineConfig } from "vite";
import path from "node:path";
import electron from "vite-plugin-electron/simple";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // La fuente del proyecto es `FE-FONT.TTF` (extensión en mayúsculas), que no
  // entra en la lista de assets por defecto de Vite (contempla `.ttf`).
  assetsInclude: ["**/*.TTF"],
  build: {
    // La fuente de patentes (FE-FONT) se embebe como data URI en vez de
    // emitirse como archivo: el PDF la necesita en base64 para registrarla en
    // jsPDF, y en producción (Electron sobre file://) no se puede leer el
    // asset en runtime de forma confiable. Pesa ~17 KB. El resto de los
    // assets mantiene el comportamiento por defecto de Vite.
    assetsInlineLimit: (filePath: string) =>
      filePath.toLowerCase().endsWith(".ttf") ? true : undefined,
  },
  plugins: [
    react(),
    tailwindcss(),
    electron({
      main: {
        entry: "electron/main.ts",
        vite: {
          build: {
            // `rolldownOptions` y no `rollupOptions`: Vite 8 empaqueta con
            // Rolldown y renombró la opción. Con el nombre viejo la
            // configuración se ignora **en silencio**, que fue exactamente lo
            // que pasó al actualizar: typeorm, sqlite3 y electron-log se
            // metieron dentro del bundle (720 kB → 2,2 MB) y la aplicación
            // dejó de arrancar con `__dirname is not defined in ES module
            // scope`, porque uno de esos módulos CJS lo usa.
            //
            // Estos paquetes tienen que quedar afuera sí o sí: `sqlite3` es un
            // módulo nativo y typeorm resuelve drivers con `require` dinámico.
            rolldownOptions: {
              external: (id) => {
                return (
                  id === "typeorm" ||
                  id.startsWith("typeorm/") ||
                  id === "@google-cloud/spanner" ||
                  id.startsWith("@google-cloud/") ||
                  id === "electron-log" ||
                  id.startsWith("electron-log/") ||
                  [
                    "sqlite3",
                    "better-sqlite3",
                    "mysql2",
                    "pg",
                    "mongodb",
                  ].includes(id)
                );
              },
            },
          },
        },
      },
      preload: {
        input: path.join(__dirname, "electron/preload.ts"),
      },
      renderer: process.env.NODE_ENV === "test" ? undefined : {},
    }),
  ],
});
