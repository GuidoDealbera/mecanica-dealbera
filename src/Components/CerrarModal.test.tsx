// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Autocomplete,
  AutocompleteItem,
  Modal,
  ModalBody,
  ModalContent,
} from "@heroui/react";
import Providers from "../Store/Providers";
import CerrarModal from "./CerrarModal";

/**
 * Lo que la interfaz le dice a un lector de pantalla, en castellano.
 *
 * Se monta con los `Providers` de la aplicación y no con un `HeroUIProvider`
 * suelto: lo que se prueba es cómo está configurada esta aplicación, no si
 * HeroUI sabe traducir.
 */
describe("los textos que HeroUI pone por su cuenta", () => {
  it("el autocompletar ofrece sus sugerencias en castellano", () => {
    render(
      <Providers>
        <Autocomplete label="Titular">
          <AutocompleteItem key="ana">Ana Gómez</AutocompleteItem>
        </Autocomplete>
      </Providers>
    );

    // El botón está oculto para el foco —se abre tipeando—, pero un lector de
    // pantalla lo anuncia igual.
    expect(
      screen.getByRole("button", { name: "Mostrar sugerencias", hidden: true })
    ).toBeInTheDocument();
  });

  it("la cruz de un modal se llama 'Cerrar', y cierra", async () => {
    const onClose = vi.fn();
    render(
      <Providers>
        <Modal isOpen onClose={onClose} closeButton={<CerrarModal />}>
          <ModalContent>
            <ModalBody>Contenido</ModalBody>
          </ModalContent>
        </Modal>
      </Providers>
    );

    const cruz = await screen.findByRole("button", { name: "Cerrar" });
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();

    // Que siga cerrando es lo que importa: el componente recibe los
    // manejadores de HeroUI y los tiene que conservar.
    await userEvent.click(cruz);
    expect(onClose).toHaveBeenCalled();
  });
});
