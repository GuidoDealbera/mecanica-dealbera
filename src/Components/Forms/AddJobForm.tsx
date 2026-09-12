import React from "react";
import { Jobs } from "../../Types/types";
import { Controller, useForm } from "react-hook-form";
import { CreateCarJob, JobStatus } from "../../Types/apiTypes";
import FormWrapper from "./FormWrapper";
import { Button, Input, Select, SelectItem, Textarea } from "@heroui/react";
import { formatThousands, parseNumber } from "../../Utils/utils";
import PartsEditor from "../Parts/PartsEditor";

const INITIAL_VALUES: Partial<Jobs> = {
  price: undefined,
  isThirdParty: false,
  status: JobStatus.PENDING,
  description: "",
  parts: [],
  notes: "",
  clientNote: "",
  isService: false,
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

  // El compilador de React avisa que no puede memoizar este componente porque
  // `watch()` de react-hook-form devuelve funciones que no se pueden memoizar
  // sin arriesgar interfaz vieja. No hay nada que corregir: el compilador ya
  // hace lo correcto —saltea la memoización de este componente— y la
  // alternativa sería dejar react-hook-form.
  //
  // Se silencia en el lugar y no apagando la regla, para que si mañana otro
  // componente usa una librería incompatible el aviso aparezca.
  // eslint-disable-next-line react-hooks/incompatible-library -- `watch()` de react-hook-form; el compilador ya saltea la memoización
  const jobStatus = watch("status");
  const shouldEnableSubmit = isEditing ? isDirty && isValid : isValid;

  return (
    <FormWrapper form={form}>
      {/* `parts` puede venir en `null` de un trabajo viejo, pero lo que sale del
          formulario siempre es un arreglo: "sin repuestos" se manda como lista
          vacía y no como ausencia, así el backend recibe una sola forma. */}
      <form
        noValidate
        onSubmit={handleSubmit((data) =>
          onSubmit({ ...data, parts: data.parts ?? [] })
        )}
      >
        <div className="grid w-full grid-cols-12 gap-4">
          {/* ── Columna izquierda: info del trabajo ── */}
          <div className="col-span-full lg:col-span-6 flex flex-col gap-3 p-4 rounded-lg shadow shadow-primary">
            <h5 className="font-semibold text-xl py-2 px-4 bg-primary-700 text-white rounded-md shadow shadow-primary-500 w-fit">
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

            {/* Marcar el trabajo como service: al completarlo se programa el
                próximo recordatorio automáticamente. Era un desplegable con
                cinco tipos, pero el taller usa uno solo: ahora es un sí/no. */}
            <Controller
              control={control}
              name="isService"
              render={({ field: { value, onChange } }) => (
                <Select
                  label="¿Es un service?"
                  description="Si lo es, al completarlo se programa el próximo"
                  selectedKeys={[value ? "true" : "false"]}
                  onSelectionChange={(keys) => {
                    onChange(Array.from(keys)[0] === "true");
                  }}
                  isDisabled={isLoading || !license}
                  fullWidth
                >
                  <SelectItem key="false">No, es un trabajo común</SelectItem>
                  <SelectItem key="true">Sí, es un service</SelectItem>
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
          <div className="col-span-full lg:col-span-6 flex flex-col gap-3 p-4 rounded-lg shadow shadow-primary">
            <h5 className="font-semibold text-xl py-2 px-4 bg-primary-700 text-white rounded-md shadow shadow-primary-500 w-fit">
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

        {/* ── Notas internas (opcional) ── */}
        <div className="mt-4 p-4 rounded-lg shadow shadow-primary">
          <Controller
            control={control}
            name="notes"
            render={({ field }) => (
              <Textarea
                {...field}
                value={field.value ?? ""}
                isDisabled={isLoading || !license}
                label="Notas internas (opcional)"
                description="Solo para uso del taller. No se incluyen en el presupuesto ni se muestran al cliente."
                fullWidth
                minRows={2}
              />
            )}
          />
        </div>

        {/* ── Observación para el cliente (opcional) ──
            Campo aparte de las notas internas y no un check sobre ellas: si
            fuera lo mismo, un descuido imprimiría algo escrito justamente para
            no mostrarlo. */}
        <div className="mt-4 p-4 rounded-lg shadow shadow-success">
          <Controller
            control={control}
            name="clientNote"
            render={({ field }) => (
              <Textarea
                {...field}
                value={field.value ?? ""}
                isDisabled={isLoading || !license}
                label="Observación para el cliente (opcional)"
                description="Sale impresa en el presupuesto y en la factura, debajo del trabajo."
                fullWidth
                minRows={2}
              />
            )}
          />
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
