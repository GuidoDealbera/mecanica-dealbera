// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import AddCarForm from "./AddCarForm";

/**
 * Elegir el titular de un vehículo en el alta.
 *
 * Es la parte de D5 que quedó sin cubrir. Se había intentado manejar el
 * autocompletar contra la aplicación real por CDP y no se pudo —el widget de
 * HeroUI no responde a eventos sintéticos y el teclado por CDP no llegaba a la
 * ventana—, y de ahí salió la conclusión equivocada de que no era testeable: la
 * herramienta para hacerlo ya estaba en el proyecto.
 *
 * Lo que importa acá es una sola cosa, y es la que hace que dos clientes
 * homónimos no sean el mismo: que al elegir de la lista viaje el `ownerId`, y
 * que al escribir un nombre a mano **no** viaje ninguno. El backend decide con
 * eso si asocia el auto a una ficha que ya existe o crea otra.
 */

const ana = {
  id: "cli-1",
  fullname: "Ana Gómez",
  phone: "3515123456",
  address: "San Martín 100",
  city: "Córdoba",
  email: "ana@ejemplo.com",
  isActive: true,
};

/** La otra Ana: mismo nombre, otra persona, otro `id`. */
const otraAna = {
  ...ana,
  id: "cli-2",
  phone: "3515199999",
  address: "Rivadavia 50",
  email: "",
};

const montar = (resultados = [ana]) => {
  const search = vi.fn(async () => ({
    status: "success",
    result: resultados,
  }));
  (window as unknown as { api: unknown }).api = {
    clients: { search },
    // `FormWrapper` avisa al proceso principal si hay cambios sin guardar.
    global: { setUnsavedChanges: vi.fn() },
  };
  const onSubmit = vi.fn(async () => {});
  // Con `RouterProvider` y no con `MemoryRouter`: `FormWrapper` usa
  // `useBlocker` para el guard de cambios sin guardar, y eso pide un router de
  // datos.
  const router = createMemoryRouter(
    [{ path: "/", element: <AddCarForm onSubmit={onSubmit} /> }],
    { initialEntries: ["/"] }
  );
  render(<RouterProvider router={router} />);
  return { onSubmit };
};

/**
 * En jsdom no hay layout, así que react-aria deja el desplegable fuera del
 * árbol accesible y `byRole` lo saltea. Se lo pide explícitamente: lo que se
 * está probando es la lógica de selección, no la accesibilidad del popover.
 */
const OCULTOS = { hidden: true } as const;

const opcion = (nombre: RegExp) =>
  screen.findByRole("option", { name: nombre, ...OCULTOS });

/** Escribe en el campo del titular y espera a que aparezcan las opciones. */
const buscarTitular = async (texto: string) => {
  const campo = screen.getByRole("combobox", { name: /nombre completo/i });
  await userEvent.click(campo);
  await userEvent.type(campo, texto);
  return campo;
};

afterEach(() => {
  // Se deja un doble inerte en vez de borrar `window.api`: el desmontaje del
  // formulario todavía avisa que ya no hay cambios sin guardar, y ese aviso
  // corre después de este hook.
  (window as unknown as { api: unknown }).api = {
    clients: { search: vi.fn(async () => ({ status: "success", result: [] })) },
    global: { setUnsavedChanges: vi.fn() },
  };
});

describe("elegir el titular en el alta de un vehículo", () => {
  it("rellena los datos del cliente elegido", async () => {
    montar();
    await buscarTitular("Ana");

    await userEvent.click(await opcion(/ana gómez/i));

    // Sin esto el alta pierde el sentido: se elige a alguien de la lista para
    // no volver a escribir su teléfono y su dirección.
    await waitFor(() =>
      expect(screen.getByLabelText(/teléfono/i)).toHaveValue("3515123456")
    );
    expect(screen.getByLabelText(/dirección/i)).toHaveValue("San Martín 100");
    expect(screen.getByLabelText(/localidad/i)).toHaveValue("Córdoba");
  });

  it("muestra el nombre en el campo, no el id", async () => {
    // La clave de las opciones pasó a ser el `id`, y `textValue` seguía
    // apuntando a la clave: elegir un titular habría escrito un uuid en el
    // campo del nombre.
    montar();
    await buscarTitular("Ana");
    await userEvent.click(await opcion(/ana gómez/i));

    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: /nombre completo/i })
      ).toHaveValue("Ana Gómez")
    );
  });

  it("distingue a dos clientes que se llaman igual", async () => {
    // El caso que la unicidad de `fullname` volvía imposible. Con el nombre
    // como clave, las dos opciones eran la misma y elegir cualquiera devolvía
    // siempre la primera.
    montar([ana, otraAna]);
    await buscarTitular("Ana");

    const opciones = await screen.findAllByRole("option", OCULTOS);
    expect(opciones).toHaveLength(2);

    await userEvent.click(opciones[1]);

    await waitFor(() =>
      expect(screen.getByLabelText(/teléfono/i)).toHaveValue("3515199999")
    );
    expect(screen.getByLabelText(/dirección/i)).toHaveValue("Rivadavia 50");
  });

  it("editar el nombre después de elegir vuelve a dejar el titular en blanco", async () => {
    // Elegir a Ana y agregarle un apellido es cargar a otra persona, no editar
    // a Ana. Si la selección se conservara, el auto le quedaría asociado a ella.
    montar();
    const campo = await buscarTitular("Ana");
    await userEvent.click(await opcion(/ana gómez/i));
    await waitFor(() =>
      expect(screen.getByLabelText(/teléfono/i)).toHaveValue("3515123456")
    );

    await userEvent.type(campo, " Pérez");

    await waitFor(() =>
      expect(screen.getByLabelText(/teléfono/i)).toHaveValue("")
    );
  });
});
