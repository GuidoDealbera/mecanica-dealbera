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
import PartsEditor from "../Parts/PartsEditor";

const INITIAL_VALUES: Partial<Jobs> = {
  price: undefined,
  isThirdParty: false,
  status: JobStatus.PENDING,
  description: "",
  parts: [],
};

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
  const shouldEnableSubmit = isEditing ? isDirty && isValid : isValid;

  return (
    <FormWrapper form={form}>
      <form noValidate onSubmit={handleSubmit(onSubmit)}>
        <div className="grid w-full grid-cols-12 gap-4">
          {/* ── Columna izquierda: info del trabajo ── */}
          <div className="col-span-full lg:col-span-6 flex flex-col gap-3 p-4 rounded-lg shadow shadow-primary bg-foreground-700">
            <h5 className="font-semibold text-xl py-2 px-4 bg-primary-700 rounded-md shadow shadow-primary-500 w-fit">
              Información del trabajo
            </h5>

            <Controller
              control={control}
              name="description"
              rules={{
                required: { value: true, message: "Campo obligatorio" },
                validate: (value) =>
                  value.length >= 10 || "La descripción es muy corta",
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
                  onSelectionChange={(keys) => onChange(Array.from(keys)[0])}
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
                        : jobStatus === JobStatus.DELIVERED
                          ? "secondary"
                          : "default"
                  }
                >
                  <SelectItem
                    key={JobStatus.PENDING}
                    color="default"
                    className="text-foreground"
                  >
                    Sin comenzar
                  </SelectItem>
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
                validate: (value) => (value && value > 0) || "Elige un precio",
              }}
              render={({
                field: { value, onChange, ...field },
                fieldState: { error },
              }) => (
                <Input
                  {...field}
                  label="Precio del trabajo"
                  type="text"
                  startContent={
                    <span className="text-foreground-900 font-bold">$</span>
                  }
                  inputMode="numeric"
                  value={formatThousands(value)}
                  onChange={(e) => onChange(parseNumber(e.target.value))}
                  isDisabled={isLoading || !license}
                  isInvalid={!!error}
                  errorMessage={error?.message}
                  fullWidth
                />
              )}
            />
          </div>

          {/* ── Columna derecha: repuestos ── */}
          <div className="col-span-full lg:col-span-6 flex flex-col gap-3 p-4 rounded-lg shadow shadow-primary bg-foreground-700">
            <h5 className="font-semibold text-xl py-2 px-4 bg-primary-700 rounded-md shadow shadow-primary-500 w-fit">
              Repuestos
            </h5>

            <Controller
              control={control}
              name="parts"
              render={({ field }) => (
                <PartsEditor
                  parts={field.value ?? []}
                  onChange={field.onChange}
                  isDisabled={isLoading || !license}
                />
              )}
            />
          </div>
        </div>

        <Button
          type="submit"
          color="primary"
          className="mt-4 w-full"
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
