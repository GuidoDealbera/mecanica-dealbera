import React from "react";
import { CreateCarBody } from "../../Types/apiTypes";
import { Autocomplete, AutocompleteItem, Button, Input } from "@heroui/react";
import { Controller, useForm } from "react-hook-form";
import { Cars, Clients } from "../../Types/types";
import FormWrapper from "./FormWrapper";
import { BRANDS_OPTIONS, handleCapitalizedChange } from "../../Utils/utils";
import { useSelector } from "react-redux";
import { RootState } from "../../Store/store";
import { useClientQueries } from "../../Hooks/useClientQueries";

interface AddCarFormProps {
  onSubmit: (data: CreateCarBody) => void;
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
  const { getAllClients } = useClientQueries();
  const INITIAL_STATE: Partial<CreateCarBody> = React.useMemo(() => ({
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
    },
    year: undefined,
  }), []);
  const [selectedOwner, setSelectedOwner] = React.useState<Clients | undefined>();

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
  const { allClients } = useSelector((state: RootState) => state.clients);

  const filterClient = React.useCallback(
    (fullname: string | null) => {
      const filtered = allClients.find(
        (client) => client.fullname === fullname
      );
      setSelectedOwner(filtered);
    },
    [allClients]
  );

  const clientsNames = React.useMemo(() => {
    if (!allClients || allClients.length === 0) return null;
    return allClients.map((client) => ({
      key: client.fullname,
      label: client.fullname,
    }));
  }, [allClients]);

  const shouldEnableSubmit = isEditing ? isDirty && isValid : isValid;
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

  React.useEffect(() => {
    getAllClients();
  }, [getAllClients]);

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
    if (!isEditing && initialValues) {
      reset(initialValues);
    }
  }, [initialValues, isEditing, reset]);

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
            <h5 className="font-semibold w-fit text-2xl py-2 px-4 bg-primary-700 rounded-md shadow shadow-primary-500">
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
              disabled={isLoading || readonly}
              render={({ field, fieldState: { error } }) =>
                !initialValues && clientsNames && clientsNames.length >= 1 ? (
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
                      filterClient(value);
                    }}
                    defaultItems={clientsNames}
                    fullWidth
                    isRequired
                    isDisabled={isLoading || readonly}
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
                    isDisabled={isLoading || readonly}
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
            <h5 className="font-semibold w-fit text-2xl py-2 px-4 bg-primary-700 rounded-md shadow shadow-primary-500">
              Datos del vehículo
            </h5>
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
              disabled={isLoading || readonly}
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
              render={({ field, fieldState: { error } }) => (
                <Autocomplete
                  {...field}
                  label="Marca"
                  selectedKey={initialValues ? initialValues.brand : ''}
                  allowsCustomValue={false}
                  onSelectionChange={(key) => field.onChange(key)}
                  defaultItems={BRANDS_OPTIONS}
                  fullWidth
                  isRequired
                  isDisabled={isLoading || readonly || isEditing}
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
                  onChange={handleCapitalizedChange(field.onChange)}
                  isInvalid={!!error}
                  isDisabled={isLoading || readonly || isEditing}
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
                  isDisabled={isLoading || readonly || isEditing}
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
                  value={field.value ? field.value.toString() : ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^[\d]*$/.test(value)) {
                      if (value === "") {
                        field.onChange("");
                      } else {
                        field.onChange(Number(value));
                      }
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
