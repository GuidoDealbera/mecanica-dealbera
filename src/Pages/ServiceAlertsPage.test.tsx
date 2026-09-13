// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ServiceAlertsPage from "./ServiceAlertsPage";
import { DEFAULT_SERVICE_SETTINGS } from "../Types/apiTypes";

/**
 * Qué ofrece el panel de intervalos cuando no se pudo leer la configuración.
 *
 * El estado de la pantalla arranca con los valores por defecto, así que si la
 * lectura fallaba y el error se tragaba —lo hacía: `catch { /* si falla,
 * quedan los valores por defecto *\/ }`— el panel quedaba mostrando los
 * defaults **como si fueran los guardados**. Abrirlo y apretar Guardar le
 * pisaba al usuario su configuración real sin decirle nada.
 *
 * Un fallo al leer no puede ser silencioso si esa misma pantalla deja escribir.
 */

const setSettings = vi.fn();

/** El envelope de una lectura exitosa, que es lo que devuelven los canales. */
const ok = <T,>(result: T) => ({ status: "success", message: "", result });

const api = (getSettings: () => Promise<unknown>) => ({
  service: {
    getSettings,
    setSettings,
    list: vi.fn(async () => ok({ items: [], total: 0, page: 1, pageSize: 8 })),
    markContacted: vi.fn(),
  },
  global: { openExternal: vi.fn() },
});

const montar = (getSettings: () => Promise<unknown>) => {
  (window as unknown as { api: unknown }).api = api(getSettings);
  return render(
    <MemoryRouter>
      <ServiceAlertsPage />
    </MemoryRouter>
  );
};

const abrirElPanel = async () => {
  await userEvent.click(
    await screen.findByRole("button", { name: /configurar intervalos/i })
  );
};

beforeEach(() => {
  setSettings.mockClear();
});

afterEach(() => {
  delete (window as unknown as { api?: unknown }).api;
});

describe("el panel de intervalos de service", () => {
  it("deja editar y guardar cuando la configuración se leyó", async () => {
    montar(async () => ok({ ...DEFAULT_SERVICE_SETTINGS, intervalMonths: 9 }));
    await abrirElPanel();

    // El caso normal, que es el que no puede romperse al arreglar el otro.
    expect(await screen.findByLabelText(/cada \(meses\)/i)).toHaveValue("9");
    expect(screen.getByRole("button", { name: /^guardar$/i })).toBeTruthy();
  });

  it("no ofrece guardar si la configuración no se pudo leer", async () => {
    montar(async () => {
      throw new Error("la base no responde");
    });
    await abrirElPanel();

    // Sin campos y sin Guardar: lo que había para mostrar eran los valores por
    // defecto, y ofrecerlos es ofrecer pisar la configuración real.
    await screen.findByText(/no se pudieron leer los intervalos guardados/i);
    expect(screen.queryByLabelText(/cada \(meses\)/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /^guardar$/i })).toBeNull();
  });

  it("reintentar recupera el panel cuando la lectura vuelve a andar", async () => {
    // El fallo puede ser momentáneo —la base ocupada—, así que quedarse
    // encerrado hasta reiniciar sería peor que el problema original.
    let falla = true;
    montar(async () => {
      if (falla) throw new Error("la base no responde");
      return ok({ ...DEFAULT_SERVICE_SETTINGS, intervalMonths: 9 });
    });
    await abrirElPanel();
    await screen.findByText(/no se pudieron leer los intervalos guardados/i);

    falla = false;
    await userEvent.click(screen.getByRole("button", { name: /reintentar/i }));

    await waitFor(() =>
      expect(screen.getByLabelText(/cada \(meses\)/i)).toHaveValue("9")
    );
    expect(setSettings).not.toHaveBeenCalled();
  });
});
