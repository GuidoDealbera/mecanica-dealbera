// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PartsEditor from "./PartsEditor";

/**
 * El editor de repuestos.
 *
 * Sólo dejaba agregar y borrar: corregir el precio obligaba a borrar el
 * repuesto y volver a cargarlo con el nombre otra vez. Tampoco avisaba si se
 * cargaba dos veces el mismo, ni tenía techo de precio —y ese número va derecho
 * al total del presupuesto—.
 */

const cargar = async (nombre: string, precio: string) => {
  await userEvent.type(screen.getByLabelText(/nombre del repuesto/i), nombre);
  await userEvent.type(screen.getByLabelText(/precio/i), precio);
};

const montar = (parts: { name: string; price: number }[] = []) => {
  const onChange = vi.fn();
  render(<PartsEditor parts={parts} onChange={onChange} />);
  return { onChange };
};

describe("agregar un repuesto", () => {
  it("lo suma a la lista", async () => {
    const { onChange } = montar();

    await cargar("Filtro de aceite", "12000");
    await userEvent.click(
      screen.getByRole("button", { name: /agregar repuesto/i })
    );

    expect(onChange).toHaveBeenCalledWith([
      { name: "Filtro de aceite", price: 12000 },
    ]);
  });

  it("avisa si ya está cargado, en vez de duplicar el renglón", async () => {
    // Casi siempre es cargar dos veces lo mismo sin darse cuenta, y el
    // documento saldría con el repuesto repetido.
    const { onChange } = montar([{ name: "Filtro de aceite", price: 12000 }]);

    await cargar("filtro de aceite", "12000");
    await userEvent.click(
      screen.getByRole("button", { name: /agregar repuesto/i })
    );

    expect(
      await screen.findByText(/ya agregaste un repuesto con ese nombre/i)
    ).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("rechaza un precio que es un cero de más", async () => {
    // Sin techo, pasa derecho al total del presupuesto.
    const { onChange } = montar();

    await cargar("Motor completo", "999999999");
    await userEvent.click(
      screen.getByRole("button", { name: /agregar repuesto/i })
    );

    expect(
      await screen.findByText(/parece un error de tipeo/i)
    ).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("corregir un repuesto", () => {
  it("cambia el precio sin tener que reescribir el nombre", async () => {
    const { onChange } = montar([{ name: "Filtro de aceite", price: 12000 }]);

    await userEvent.click(
      screen.getByRole("button", { name: /corregir filtro de aceite/i })
    );
    const precio = screen.getByLabelText(/precio/i);
    await userEvent.clear(precio);
    await userEvent.type(precio, "15000");
    await userEvent.click(
      screen.getByRole("button", { name: /guardar el repuesto/i })
    );

    // Reemplaza el que estaba, no agrega otro.
    expect(onChange).toHaveBeenCalledWith([
      { name: "Filtro de aceite", price: 15000 },
    ]);
  });

  it("no se confunde consigo mismo al comprobar repetidos", async () => {
    // Corregir sólo el precio deja el nombre igual: si el control mirara todos
    // los repuestos, el que se está editando chocaría contra sí mismo.
    const { onChange } = montar([{ name: "Filtro de aceite", price: 12000 }]);

    await userEvent.click(
      screen.getByRole("button", { name: /corregir filtro de aceite/i })
    );
    const precio = screen.getByLabelText(/precio/i);
    await userEvent.clear(precio);
    await userEvent.type(precio, "13000");
    await userEvent.click(
      screen.getByRole("button", { name: /guardar el repuesto/i })
    );

    expect(
      screen.queryByText(/ya agregaste un repuesto con ese nombre/i)
    ).toBeNull();
    expect(onChange).toHaveBeenCalledWith([
      { name: "Filtro de aceite", price: 13000 },
    ]);
  });

  it("cancelar deja todo como estaba", async () => {
    const { onChange } = montar([{ name: "Filtro de aceite", price: 12000 }]);

    await userEvent.click(
      screen.getByRole("button", { name: /corregir filtro de aceite/i })
    );
    await userEvent.click(
      screen.getByRole("button", { name: /cancelar la corrección/i })
    );

    expect(onChange).not.toHaveBeenCalled();
    // Y el formulario vuelve a ser el de agregar.
    expect(
      screen.getByRole("button", { name: /agregar repuesto/i })
    ).toBeInTheDocument();
  });
});
