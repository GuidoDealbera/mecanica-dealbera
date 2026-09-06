import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

/**
 * Configuración de ESLint en formato plano.
 *
 * ESLint 9 dejó de leer `.eslintrc.*` y la 10 lo eliminó del todo, así que la
 * migración era obligatoria para poder actualizar. Las reglas son las mismas de
 * antes; lo que cambia es cómo se declaran.
 *
 * A diferencia de `.eslintrc`, acá el orden importa: cada bloque se aplica a los
 * archivos que declara y los últimos pisan a los primeros.
 */
export default tseslint.config(
  // Lo generado no se revisa. Antes era `ignorePatterns`.
  {
    ignores: [
      "dist",
      "dist-electron",
      "release",
      "coverage",
      "eslint.config.js",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ["src/**/*.{ts,tsx}", "electron/**/*.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      // El renderer corre en Chromium y el proceso principal en Node: se
      // declaran los dos conjuntos de globales porque un solo bloque cubre
      // ambas carpetas.
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],

      // Regla nueva del compilador de React: llamar a `setState` de forma
      // síncrona dentro de un efecto provoca un render en cascada. Tiene razón
      // —hay 17 casos, casi todos correcciones de estado del tipo "la página
      // quedó fuera de rango"— pero **no son bugs**, y reescribir diecisiete
      // efectos de una es la mejor forma de introducir una regresión.
      //
      // Queda como aviso para verlos, no para que traben el build. Está
      // anotado como tarea en PLAN_MEJORAS.md; el camino es ir migrándolos a
      // estado derivado durante el render, de a uno y probando la pantalla.
      "react-hooks/set-state-in-effect": "warn",
    },
  }
);
