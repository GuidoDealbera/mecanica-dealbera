// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRefrescoPorTiempo } from "./useRefrescoPorTiempo";

/**
 * El otro lado de F1: que la interfaz se entere de que pasó el tiempo.
 *
 * La caché del proceso principal ya vence al cambiar el día, pero si nadie
 * vuelve a preguntar, la pantalla sigue mostrando lo mismo. Los contadores de
 * la barra y el dashboard se refrescaban al montar y ante `data-changed`, o sea
 * sólo ante escrituras.
 */

beforeEach(() => {
  vi.useFakeTimers();
  // A media mañana: avanzar el reloj en un test no puede cruzar la medianoche
  // sin querer, que es lo que probaría otra cosa.
  vi.setSystemTime(new Date("2026-12-31T09:00:00"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("refrescar cuando pasa el tiempo", () => {
  it("no refresca porque sí", () => {
    const refrescar = vi.fn();
    renderHook(() => useRefrescoPorTiempo(refrescar));

    // Diez minutos dentro del mismo día: el intervalo corre, pero sondear la
    // base cada minuto para que dé lo mismo no le sirve a nadie.
    vi.advanceTimersByTime(10 * 60_000);

    expect(refrescar).not.toHaveBeenCalled();
  });

  it("refresca al cambiar el día", () => {
    const refrescar = vi.fn();
    renderHook(() => useRefrescoPorTiempo(refrescar));

    // La ventana quedó abierta y a la vista cruzando la medianoche, que es el
    // caso que nadie ve venir: nadie toca nada, así que no hay escritura que
    // dispare la actualización.
    vi.setSystemTime(new Date("2027-01-01T00:01:00"));
    vi.advanceTimersByTime(60_000);

    expect(refrescar).toHaveBeenCalledTimes(1);
  });

  it("no refresca dos veces por el mismo cambio de día", () => {
    const refrescar = vi.fn();
    renderHook(() => useRefrescoPorTiempo(refrescar));

    vi.setSystemTime(new Date("2027-01-01T00:01:00"));
    vi.advanceTimersByTime(5 * 60_000);

    expect(refrescar).toHaveBeenCalledTimes(1);
  });

  it("refresca al volver el foco a la ventana", () => {
    // Es cuando la persona vuelve a mirar, o sea el momento exacto en que un
    // número viejo se nota.
    const refrescar = vi.fn();
    renderHook(() => useRefrescoPorTiempo(refrescar));

    window.dispatchEvent(new Event("focus"));

    expect(refrescar).toHaveBeenCalledTimes(1);
  });

  it("deja de escuchar al desmontarse", () => {
    // Sin la baja se acumula un listener y un intervalo por montaje, y en
    // desarrollo StrictMode monta dos veces. Ya se pagó una vez con los avisos
    // duplicados del updater.
    const refrescar = vi.fn();
    const { unmount } = renderHook(() => useRefrescoPorTiempo(refrescar));

    unmount();
    window.dispatchEvent(new Event("focus"));
    vi.setSystemTime(new Date("2027-01-01T00:01:00"));
    vi.advanceTimersByTime(60_000);

    expect(refrescar).not.toHaveBeenCalled();
  });

  it("usa siempre la última función, sin reiniciar el intervalo", () => {
    // El callback de una pantalla se recrea en cada render. Si el efecto
    // dependiera de él, el intervalo se reiniciaría todo el tiempo y el cambio
    // de día podría no llegar a detectarse nunca.
    const primera = vi.fn();
    const segunda = vi.fn();
    const { rerender } = renderHook(({ fn }) => useRefrescoPorTiempo(fn), {
      initialProps: { fn: primera },
    });

    rerender({ fn: segunda });
    window.dispatchEvent(new Event("focus"));

    expect(primera).not.toHaveBeenCalled();
    expect(segunda).toHaveBeenCalledTimes(1);
  });
});
