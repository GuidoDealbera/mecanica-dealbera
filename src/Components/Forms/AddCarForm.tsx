import React from "react";
import { CreateCarBody } from "../../Types/apiTypes";
import { Autocomplete, AutocompleteItem, Button, Input } from "@heroui/react";
import { Controller, useForm } from "react-hook-form";
import { Cars, Clients } from "../../Types/types";
import FormWrapper from "./FormWrapper";
import {
  BRANDS_OPTIONS,
  formatNumbers,
  handleCapitalizedChange,
} from "../../Utils/utils";
import { useDebounce } from "../../Hooks/useDebounce";

interface AddCarFormProps {
  onSubmit: (data: CreateCarBody) => Promise<void>;
  isLoading?: boolean;
  initialValues?: Partial<Cars>;
  isEditing?: boolean;
  readonly?: boolean;
}

const AddCarForm: React.FC<AddCarFormProps> = ({
  onSubmit,
  isLoading,
  initialValues,
  isEditing,
  readonly,
}) => {
  const INITIAL_STATE: Partial<CreateCarBody> = React.useMemo(
    () => ({
      brand: undefined,
      kilometers: undefined,
      licensePlate: "",
      model: "",
      owner: {
        address: "",
        city: "",
        email: "",
        fullname: "",
        phone: "",
        isActive: true,
      },
      year: undefined,
    }),
    []
  );
  const [selectedOwner, setSelectedOwner] = React.useState<
    Clients | undefined
  >();

  const form = useForm<CreateCarBody>({
    mode: "onChange",
    defaultValues: INITIAL_STATE,
  });

  const {
    control,
    handleSubmit,
    formState: { isDirty, isValid },
    setValue,
    watch,
    reset,
  } = form;
  // Búsqueda de titulares existentes (server-side, as-you-type) en lugar de
  // tener toda la lista de clientes en memoria.
  const [ownerQuery, setOwnerQuery] = React.useState("");
  const [clientResults, setClientResults] = React.useState<Clients[]>([]);
  const debouncedOwnerQuery = useDebounce(ownerQuery, 250);

  const filterClient = React.useCallback(
    (fullname: string | null) => {
      const filtered = clientResults.find(
        (client) => client.fullname === fullname
      );
      setSelectedOwner(filtered);
    },
    [clientResults]
  );

  const clientsNames = React.useMemo(
    () =>
      clientResults.map((client) => ({
        key: client.fullname,
        label: client.fullname,
      })),
    [clientResults]
  );

  const shouldEnableSubmit = isEditing ? isDirty && isValid : isValid;
  // El compilador de React avisa que no puede memoizar este componente porque
  // `watch()` de react-hook-form devuelve funciones que no se pueden memoizar
  // sin arriesgar interfaz vieja. No hay nada que corregir: el compilador ya
  // hace lo correcto —saltea la memoización de este componente— y la
  // alternativa sería dejar react-hook-form.
  //
  // Se silencia en el lugar y no apagando la regla, para que si mañana otro
  // componente usa una librería incompatible el aviso aparezca.
  // eslint-disable-next-line react-hooks/incompatible-library -- `watch()` de react-hook-form; el compilador ya saltea la memoización
  const watchedValues = watch();
  const areValuesInitial = (values: CreateCarBody) => {
    return (
      !values.brand &&
      !values.kilometers &&
      values.licensePlate === "" &&
      values.model === "" &&
      values.owner.address === "" &&
      values.owner.city === "" &&
      values.owner.email === "" &&
      values.owner.fullname === "" &&
      values.owner.phone === "" &&
      !values.year
    );
  };
  React.useEffect(() => {
    if (isDirty && areValuesInitial(watchedValues)) {
      reset(INITIAL_STATE);
    }
  }, [watchedValues, isDirty, reset, INITIAL_STATE]);

  // Busca titulares por nombre a medida que se escribe (mínimo 2 caracteres).
  React.useEffect(() => {
    const q = debouncedOwnerQuery.trim();
    if (q.length < 2) {
      setClientResults([]);
      return;
    }
    let cancelled = false;
    window.api.clients
      .search(q)
      .then((res) => {
        if (!cancelled && res.status === "success") {
          setClientResults(res.result ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) setClientResults([]);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedOwnerQuery]);

  React.useEffect(() => {
    if (selectedOwner) {
      setValue("owner.address" as const, selectedOwner.address);
      setValue("owner.city" as const, selectedOwner.city);
      setValue("owner.email" as const, selectedOwner.email);
      setValue("owner.fullname" as const, selectedOwner.fullname);
      setValue("owner.phone" as const, selectedOwner.phone);
    } else {
      setValue("owner.address" as const, "");
      setValue("owner.city" as const, "");
      setValue("owner.email" as const, "");
      setValue("owner.fullname" as const, "");
      setValue("owner.phone" as const, "");
    }
  }, [selectedOwner, setValue]);

  React.useEffect(() => {
    if (initialValues) {
      reset(initialValues);
    }
  }, [initialValues, reset]);
  return (
    <FormWrapper form={form}>
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="p-3">
        <div className="grid w-full grid-cols-12 gap-2">
          <div className="p-3 col-span-full sm:col-span-6 shadow shadow-primary flex flex-col mt-2 gap-3 rounded-md">
            <h5 className="font-semibold w-fit text-2xl py-2 px-4 bg-primary-700 text-white rounded-md shadow shadow-primary-500">
              Datos del titular
            </h5>
            <Controller
              control={control}
              name="owner.fullname"
              rules={{
                required: { value: true, message: "Campo obligatorio" },
                validate: (value) => {
                  if (value.length < 4) {
                    return "El nombre es muy corto";
                  }
                  return true;
                },
              }}
              disabled={isLoading || readonly || isEditing}
              render={({ field, fieldState: { error } }) =>
                !initialValues && !isEditing ? (
                  <Autocomplete
                    {...field}
                    label="Nombre completo"
                    allowsCustomValue
                    onSelectionChange={(key) => {
                      filterClient(key as string);
                      field.onChange(key);
                    }}
                    onInputChange={(value) => {
                      field.onChange(value);
                      setOwnerQuery(value);
                      filterClient(value);
                    }}
                    items={clientsNames}
                    fullWidth
                    isRequired
                    isDisabled={isLoading || readonly || isEditing}
                    isInvalid={!!error}
                    errorMessage={error?.message}
                  >
                    {(client) => (
                      <AutocompleteItem key={client.key} textValue={client.key}>
                        {client.label}
                      </AutocompleteItem>
                    )}
                  </Autocomplete>
                ) : (
                  <Input
                    {...field}
                    isDisabled={isLoading || readonly || isEditing}
                    label="Nombre completo"
                    onChange={handleCapitalizedChange(field.onChange)}
                    isRequired
                    fullWidth
                    isInvalid={!!error}
                    errorMessage={error?.message}
                  />
                )
              }
            />
            <Controller
              control={control}
              name="owner.phone"
              rules={{
                required: { value: true, message: "Campo obligatorio" },
              }}
              disabled={isLoading || readonly}
              render={({ field, fieldState: { error } }) => (
                <Input
                  {...field}
                  isDisabled={isLoading || readonly}
                  label="Teléfono"
                  value={field.value}
                  onChange={(e) => {
                    const cleanedValue = e.target.value.replace(/[^\d+]/g, "");
                    field.onChange(cleanedValue);
                  }}
                  isRequired
                  fullWidth
                  isInvalid={!!error}
                  errorMessage={error?.message}
                />
              )}
            />
            <Controller
              name="owner.address"
              control={control}
              rules={{
                required: { value: true, message: "Campo obligatorio" },
              }}
              disabled={isLoading || readonly}
              render={({ field, fieldState: { error } }) => (
                <Input
                  {...field}
                  label="Dirección"
                  isInvalid={!!error}
                  onChange={handleCapitalizedChange(field.onChange)}
                  isRequired
                  isDisabled={isLoading || readonly}
                  errorMessage={error?.message}
                  fullWidth
                />
              )}
            />
            <Controller
              name="owner.city"
              control={control}
              rules={{
                required: { value: true, message: "Campo obligatorio" },
              }}
              disabled={isLoading || readonly}
              render={({ field, fieldState: { error } }) => (
                <Input
                  {...field}
                  label="Localidad"
                  isInvalid={!!error}
                  onChange={handleCapitalizedChange(field.onChange)}
                  isRequired
                  isDisabled={isLoading || readonly}
                  errorMessage={error?.message}
                  fullWidth
                />
              )}
            />
            <Controller
              name="owner.email"
              control={control}
              rules={{
                pattern: {
                  value: /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/,
                  message: "Correo electrónico inválido",
                },
              }}
              disabled={isLoading || readonly}
              render={({ field, fieldState: { error } }) => (
                <Input
                  {...field}
                  type="email"
                  label="Correo electrónico"
                  isDisabled={isLoading || readonly}
                  isInvalid={!!error}
                  errorMessage={error?.message}
                  fullWidth
                />
              )}
            />
          </div>
          <div className="p-3 col-span-full sm:col-span-6 shadow shadow-primary flex flex-col mt-2 gap-3 rounded-md">
            <h5 className="font-semibold w-fit text-2xl py-2 px-4 bg-primary-700 text-white rounded-md shadow shadow-primary-500">
              Datos del vehículo
            </h5>
            {/* La patente es lo único del vehículo que no se puede editar: es
                su identidad, y la usan las rutas de la aplicación, los
                recordatorios y el registro de documentos ya emitidos. Marca,
                modelo y año sí, que antes obligaban a borrar el vehículo entero
                para corregir un tipeo. */}
            <Controller
              name="licensePlate"
              control={control}
              rules={{
                required: { value: true, message: "Campo obligatorio" },
                pattern: {
                  value: /^([A-Z]{2}\d{3}[A-Z]{2}|[A-Z]{3}\d{3})$/,
                  message: "Formato inválido",
                },
              }}
              disabled={isLoading || readonly || isEditing}
              render={({ field, fieldState: { error } }) => (
                <Input
                  {...field}
                  label="Patente"
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  isRequired
                  isDisabled={isLoading || readonly || isEditing}
                  isInvalid={!!error}
                  errorMessage={error?.message}
                  fullWidth
                />
              )}
            />
            <Controller
              name="brand"
              control={control}
              rules={{
                required: { value: true, message: "Campo obligatorio" },
              }}
              disabled={isLoading || readonly}
              render={({
                field: { value, onChange, ref },
                fieldState: { error },
              }) => (
                <Autocomplete
                  label="Marca"
                  ref={ref}
                  selectedKey={value ?? null}
                  allowsCustomValue={false}
                  onSelectionChange={(key) => onChange(key)}
                  defaultItems={BRANDS_OPTIONS}
                  fullWidth
                  isRequired
                  isDisabled={isLoading || readonly}
                  isInvalid={!!error}
                  errorMessage={error?.message}
                >
                  {(brand) => (
                    <AutocompleteItem key={brand.key} textValue={brand.key}>
                      {brand.label}
                    </AutocompleteItem>
                  )}
                </Autocomplete>
              )}
            />
            <Controller
              name="model"
              control={control}
              rules={{
                required: { value: true, message: "Campo obligatorio" },
              }}
              disabled={isLoading || readonly}
              render={({ field, fieldState: { error } }) => (
                <Input
                  {...field}
                  label="Modelo"
                  isRequired
                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  isInvalid={!!error}
                  isDisabled={isLoading || readonly}
                  errorMessage={error?.message}
                  fullWidth
                />
              )}
            />
            <Controller
              control={control}
              name="year"
              rules={{
                required: { value: true, message: "Campo obligatorio" },
                validate: (value) => {
                  const currentYear = new Date().getFullYear();
                  if (value > currentYear)
                    return "El año no puede ser posterior al año en curso";
                  return true;
                },
              }}
              disabled={isLoading || readonly}
              render={({
                field: { value, onChange, ...field },
                fieldState: { error },
              }) => (
                <Input
                  {...field}
                  label="Año"
                  value={value ? value.toString() : ""}
                  onChange={(e) => {
                    const cleanValue = e.target.value.replace(/[^\d]/g, "");
                    onChange(Number(cleanValue));
                  }}
                  isDisabled={isLoading || readonly}
                  fullWidth
                  isRequired
                  isInvalid={!!error}
                  errorMessage={error?.message}
                />
              )}
            />
            <Controller
              name="kilometers"
              control={control}
              rules={{
                required: { value: true, message: "Campo obligatorio" },
              }}
              disabled={isLoading || readonly}
              render={({ field, fieldState: { error } }) => (
                <Input
                  {...field}
                  label="Kilometraje"
                  // display: formatea el número guardado en el form
                  value={field.value ? formatNumbers(field.value) : ""}
                  onChange={(e) => {
                    // 1. Quitar todo lo que no sea dígito (incluyendo los puntos del formato)
                    const onlyDigits = e.target.value.replace(/\D/g, "");
                    if (onlyDigits === "") {
                      field.onChange("");
                    } else {
                      // 2. Guardar el número puro, NO el string formateado
                      field.onChange(Number(onlyDigits));
                    }
                  }}
                  isRequired={isEditing}
                  isInvalid={!!error}
                  isDisabled={isLoading || readonly}
                  errorMessage={error?.message}
                  fullWidth
                />
              )}
            />
          </div>
        </div>
        {!readonly && (
          <Button
            type="submit"
            fullWidth
            color="primary"
            className="mt-4"
            isLoading={isLoading}
            isDisabled={isLoading || !shouldEnableSubmit}
          >
            {isLoading
              ? isEditing
                ? "Actualizando..."
                : "Guardando..."
              : isEditing
                ? "Actualizar Vehículo"
                : "Guardar Vehículo"}
          </Button>
        )}
      </form>
    </FormWrapper>
  );
};

export default AddCarForm;
