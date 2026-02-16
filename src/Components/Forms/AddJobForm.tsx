import React from "react";
import { Jobs } from "../../Types/types";
import { Controller, useForm } from "react-hook-form";
import { CreateCarJob, JobStatus } from "../../Types/apiTypes";
import FormWrapper from "./FormWrapper";
import {
  Button,
  Input,
  Select,
  SelectItem,
  Textarea,
} from "@heroui/react";
import { formatThousands, parseNumber } from "../../Utils/utils";

interface AddJobFormProps {
  onSubmit: (data: CreateCarJob) => void;
  isLoading?: boolean;
  isEditing?: boolean;
  license?: string;
}

const AddJobForm: React.FC<AddJobFormProps> = ({
  onSubmit,
  license,
  isEditing = false,
  isLoading,
}) => {
  const INITIAL_VALUES: Partial<Jobs> = {
    price: undefined,
    isThirdParty: false,
    status: JobStatus.IN_PROGRESS,
    description: "",
  };
  const form = useForm<Jobs>({
    mode: "onChange",
    defaultValues: INITIAL_VALUES,
  });

  const {
    control,
    handleSubmit,
    formState: { isValid, isDirty },
    watch,
  } = form;

  const jobStatus = watch("status");

  const shouldEnableSubmit = isEditing ? isDirty && isValid : isValid

  return (
    <FormWrapper form={form}>
      <form noValidate onSubmit={handleSubmit(onSubmit)}>
        <div className="grid w-full grid-cols-12 gap-2">
          <div className="p-3 col-span-full lg:col-span-6 shadow shadow-primary flex flex-col mt-2 gap-3 rounded-md">
            <h5 className="font-semibold w-fit text-2xl py-2 px-4 bg-primary-700 rounded-md shadow shadow-primary-500">
              Información del trabajo
            </h5>
            <Controller
              control={control}
              name="description"
              rules={{
                required: { value: true, message: "Campo obligatorio" },
                validate: (value) => {
                  if (value.length < 10) {
                    return "La descripción es muy corta";
                  }
                  return true;
                },
              }}
              render={({ field, fieldState: { error } }) => (
                <Textarea
                  {...field}
                  isDisabled={isLoading || !license}
                  label="Descripción"
                  isRequired
                  fullWidth
                  isInvalid={!!error}
                  errorMessage={error?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="isThirdParty"
              render={({
                field: { value, onChange },
                fieldState: { error },
              }) => (
                <Select
                  label="¿Es de terceros?"
                  selectedKeys={
                    value === undefined ? [] : [value ? "true" : "false"]
                  }
                  onSelectionChange={(keys) => {
                    const selected = Array.from(keys)[0];
                    onChange(selected === "true");
                  }}
                  isRequired
                  isDisabled={isLoading || !license}
                  isInvalid={!!error}
                  errorMessage={error?.message}
                  fullWidth
                >
                  <SelectItem key="true">Sí</SelectItem>
                  <SelectItem key="false">No</SelectItem>
                </Select>
              )}
            />
            <Controller
              control={control}
              name="status"
              render={({
                field: { value, onChange },
                fieldState: { error },
              }) => (
                <Select
                  label="Estado"
                  selectedKeys={value ? [value] : []}
                  onSelectionChange={(keys) => {
                    const selected = Array.from(keys)[0];
                    onChange(selected);
                  }}
                  fullWidth
                  isRequired
                  isDisabled={isLoading || !license}
                  isInvalid={!!error}
                  errorMessage={error?.message}
                  color={
                    jobStatus === JobStatus.IN_PROGRESS
                      ? "primary"
                      : jobStatus === JobStatus.COMPLETED
                      ? "success"
                      : "secondary"
                  }
                >
                  <SelectItem
                    key={JobStatus.IN_PROGRESS}
                    color="primary"
                    className="text-primary"
                  >
                    En progreso
                  </SelectItem>
                  <SelectItem
                    key={JobStatus.COMPLETED}
                    color="success"
                    className="text-success"
                  >
                    Completado
                  </SelectItem>
                  <SelectItem
                    key={JobStatus.DELIVERED}
                    color="secondary"
                    className="text-secondary"
                  >
                    Entregado
                  </SelectItem>
                </Select>
              )}
            />
            <Controller
              control={control}
              name="price"
              rules={{
                required: { value: true, message: "Campo obligatorio" },
                validate: (value) => {
                  if (!value || value === 0) {
                    return "Elige un precio";
                  }
                  return true;
                },
              }}
              render={({
                field: { value, onChange, ...field },
                fieldState: { error },
              }) => (
                <Input
                  {...field}
                  label="Precio"
                  className="text-black"
                  type="text"
                  startContent="$"
                  inputMode="numeric"
                  value={formatThousands(value)}
                  onChange={(e) => {
                    onChange(parseNumber(e.target.value));
                  }}
                  isDisabled={isLoading || !license}
                  isInvalid={!!error}
                  errorMessage={error?.message}
                  fullWidth
                />
              )}
            />
          </div>
        </div>
        <Button
          type="submit"
          color="primary"
          className="mt-4 w-full lg:w-1/2"
          isLoading={isLoading}
          isDisabled={isLoading || !shouldEnableSubmit}
        >
          {isLoading ? "Guardando..." : "Guardar Trabajo"}
        </Button>
      </form>
    </FormWrapper>
  );
};

export default AddJobForm;
