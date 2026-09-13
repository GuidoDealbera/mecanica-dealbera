import { FieldValues, UseFormReturn } from "react-hook-form";
import CustomDialog from "../CustomDialog";
import { useFormGuard } from "../../Hooks/useFormGuard";

/**
 * Envuelve un formulario con el aviso de cambios sin guardar.
 *
 * El componente es genérico en la forma del formulario y por eso lleva un
 * parámetro de tipo. Antes decía `UseFormReturn<any>` con un
 * `eslint-disable @typescript-eslint/no-explicit-any` **para el archivo
 * entero**: apagar la regla en todo el archivo para un caso es lo que hace que
 * el segundo `any` entre sin que nadie lo note.
 */
type FormWrapperProps<T extends FieldValues> = {
  children: React.ReactNode;
  form: UseFormReturn<T>;
};

const FormWrapper = <T extends FieldValues>({
  children,
  form,
}: FormWrapperProps<T>) => {
  const { isOpen, confirmNavigation, cancelNavigation } = useFormGuard({
    isDirty: form.formState.isDirty,
    onConfirm: () => {
      form.reset();
    },
  });

  return (
    <>
      {children}

      <CustomDialog
        isOpen={isOpen}
        onClose={cancelNavigation}
        onConfirm={confirmNavigation}
        title="Descartar cambios"
        content="¿Está seguro que desea descartar los cambios realizados?"
      />
    </>
  );
};

export default FormWrapper;
