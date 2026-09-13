// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createMemoryRouter,
  RouterProvider,
  useNavigate,
} from "react-router-dom";
import { useFormGuard } from "./useFormGuard";

/**
 * El aviso de "tenés cambios sin guardar".
 *
 * Lo que se prueba es el ciclo completo, no una sola salida.
 *
 * `useBlocker` deja el bloqueador en estado `blocked` hasta que se llame a
 * `proceed()` o a `reset()`, y faltaba el `reset` al elegir "quedarme". La
 * tarea A8 decía que por eso el segundo intento de salir no volvía a preguntar;
 * **se midió y ese síntoma no existe**: React Router evalúa el bloqueador otra
 * vez en cada navegación y la vuelve a frenar. El `reset` se agregó igual —es el
 * uso que documenta la API—, pero no arreglaba nada visible.
 *
 * Los casos salen dos veces igual, y ahí está lo que dejaron: el guard no tenía
 * ninguna cobertura, y este ciclo —preguntar, quedarse, volver a intentar,
 * confirmar y salir— es el que nadie estaba ejercitando.
 */

/**
 * El guard le avisa al proceso principal si hay cambios sin guardar, para que
 * cerrar la ventana también pregunte.
 */
const setUnsavedChanges = vi.fn();

beforeEach(() => {
  setUnsavedChanges.mockClear();
  Object.defineProperty(window, "api", {
    configurable: true,
    writable: true,
    value: { global: { setUnsavedChanges } },
  });
});

/** Pantalla con cambios sin guardar y un botón para intentar irse. */
const Formulario = ({
  onConfirm = vi.fn(),
  isDirty = true,
}: {
  onConfirm?: () => void;
  isDirty?: boolean;
}) => {
  const navigate = useNavigate();
  const { isOpen, confirmNavigation, cancelNavigation } = useFormGuard({
    isDirty,
    onConfirm,
  });

  return (
    <div>
      <h1>Formulario</h1>
      <button onClick={() => navigate("/otra")}>Salir</button>
      {isOpen && (
        <div role="dialog">
          <button onClick={confirmNavigation}>Salir igual</button>
          <button onClick={cancelNavigation}>Quedarme</button>
        </div>
      )}
    </div>
  );
};

const montar = (onConfirm = vi.fn(), isDirty = true) => {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: <Formulario onConfirm={onConfirm} isDirty={isDirty} />,
      },
      { path: "/otra", element: <h1>Otra pantalla</h1> },
    ],
    { initialEntries: ["/"] }
  );
  const { unmount } = render(<RouterProvider router={router} />);
  return { user: userEvent.setup(), onConfirm, unmount };
};

describe("useFormGuard", () => {
  it("pregunta antes de salir con cambios sin guardar", async () => {
    const { user } = montar();

    await user.click(screen.getByRole("button", { name: "Salir" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Formulario" })).toBeVisible();
  });

  it("vuelve a preguntar si la primera vez se decidió quedarse", async () => {
    const { user } = montar();

    await user.click(screen.getByRole("button", { name: "Salir" }));
    await user.click(screen.getByRole("button", { name: "Quedarme" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Acá se creía que estaba el bug. No estaba: sin `reset()` el bloqueador
    // vuelve a frenar igual. Lo que este caso cuida es que siga siendo así.
    await user.click(screen.getByRole("button", { name: "Salir" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Formulario" })).toBeVisible();
  });

  it("le avisa al proceso principal que hay cambios sin guardar", () => {
    // Sin esto, cerrar la ventana se lleva el formulario sin preguntar: el
    // bloqueador de React Router sólo ve las navegaciones internas.
    montar();
    expect(setUnsavedChanges).toHaveBeenCalledWith(true);
  });

  it("retira el aviso al desmontarse", () => {
    const { unmount } = montar();
    setUnsavedChanges.mockClear();

    unmount();

    // Una pantalla que ya no está no tiene cambios sin guardar. Sin esto la
    // aplicación quedaría preguntando al cerrar para siempre.
    expect(setUnsavedChanges).toHaveBeenCalledWith(false);
  });

  it("un formulario sin tocar no avisa nada", () => {
    montar(vi.fn(), false);
    expect(setUnsavedChanges).toHaveBeenCalledWith(false);
    expect(setUnsavedChanges).not.toHaveBeenCalledWith(true);
  });

  it("deja salir al confirmar, y avisa hacia arriba", async () => {
    const onConfirm = vi.fn();
    const { user } = montar(onConfirm);

    await user.click(screen.getByRole("button", { name: "Salir" }));
    await user.click(screen.getByRole("button", { name: "Salir igual" }));

    expect(
      await screen.findByRole("heading", { name: "Otra pantalla" })
    ).toBeVisible();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
