import React from "react";
import { Jobs } from "../../Types/types";
import { Controller, useForm } from "react-hook-form";
import { CreateCarJob, JobStatus } from "../../Types/apiTypes";
import FormWrapper from "./FormWrapper";
import {
  Button,
  Chip,
  Input,
  Select,
  SelectItem,
  Textarea,
  Tooltip,
} from "@heroui/react";
import { formatThousands, parseNumber, formatARS } from "../../Utils/utils";
import { MdAdd, MdDelete } from "react-icons/md";

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
    setValue,
    getValues,
  } = form;

  const jobStatus = watch("status");
  const parts = watch("parts") ?? [];

  const [partName, setPartName] = React.useState("");
  const [partPrice, setPartPrice] = React.useState<number | undefined>(
    undefined,
  );
  const [partNameError, setPartNameError] = React.useState("");
  const [partPriceError, setPartPriceError] = React.useState("");

  const shouldEnableSubmit = isEditing ? isDirty && isValid : isValid;

  const handleAddPart = () => {
    let hasError = false;

    if (!partName.trim()) {
      setPartNameError("Ingresá un nombre");
      hasError = true;
    } else {
      setPartNameError("");
    }

    if (!partPrice || partPrice <= 0) {
      setPartPriceError("Ingresá un precio");
      hasError = true;
    } else {
      setPartPriceError("");
    }

    if (hasError) return;

    const currentParts = getValues("parts") ?? [];
    setValue(
      "parts",
      [...currentParts, { name: partName.trim(), price: partPrice! }],
      {
        shouldDirty: true,
      },
    );
    setPartName("");
    setPartPrice(undefined);
  };

  const handleRemovePart = (index: number) => {
    const currentParts = getValues("parts") ?? [];
    setValue(
      "parts",
      currentParts.filter((_, i) => i !== index),
      { shouldDirty: true },
    );
  };

  const totalParts = parts.reduce((acc, p) => acc + p.price, 0);

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

            {/* Inputs para agregar un repuesto */}
            <div className="flex gap-2 items-start">
              <Input
                label="Nombre del repuesto"
                value={partName}
                onChange={(e) => {
                  setPartName(e.target.value);
                  if (e.target.value.trim()) setPartNameError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddPart();
                  }
                }}
                isDisabled={isLoading || !license}
                isInvalid={!!partNameError}
                errorMessage={partNameError}
                className="flex-1"
              />
              <Input
                label="Precio"
                type="text"
                startContent={
                  <span className="text-foreground-900 font-bold">$</span>
                }
                inputMode="numeric"
                value={formatThousands(partPrice)}
                onChange={(e) => {
                  const val = parseNumber(e.target.value);
                  setPartPrice(val || undefined);
                  if (val > 0) setPartPriceError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddPart();
                  }
                }}
                isDisabled={isLoading || !license}
                isInvalid={!!partPriceError}
                errorMessage={partPriceError}
                className="w-36"
              />
              <Button
                isIconOnly
                color="primary"
                className="mt-1 shrink-0"
                onPress={handleAddPart}
                isDisabled={isLoading || !license}
              >
                <MdAdd size={20} />
              </Button>
            </div>

            {/* Lista de repuestos agregados */}
            <div
              className={`flex flex-col gap-2 ${totalParts > 0 ? "h-45" : "h-59"} overflow-auto`}
            >
              {parts.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-foreground-400 text-sm border border-dashed border-foreground-500 rounded-lg py-8">
                  No hay repuestos agregados
                </div>
              ) : (
                <>
                  {parts.map((part, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-3 py-2 rounded-md bg-foreground-600 border border-foreground-500"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Chip
                          size="sm"
                          color="primary"
                          variant="flat"
                          className="text-primary-100"
                        >
                          {i + 1}
                        </Chip>
                        <span className="text-sm truncate">{part.name}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-2">
                        <span className="text-sm font-medium text-primary-100">
                          {formatARS(part.price)}
                        </span>
                        <Tooltip color="danger" content="Eliminar repuesto" showArrow placement="left">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="flat"
                            color="danger"
                            className="text-danger"
                            onPress={() => handleRemovePart(i)}
                            isDisabled={isLoading}
                          >
                            <MdDelete size={16} />
                          </Button>
                        </Tooltip>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
            {totalParts > 0 && (
              <div className="flex justify-between items-center px-3 py-2 rounded-md bg-primary-900 border border-primary-700 mt-1">
                <span className="text-sm text-foreground-300">
                  Total repuestos{" "}
                  <Chip
                    color="primary"
                    size="sm"
                    variant="flat"
                    className="text-primary"
                  >
                    {parts.length}
                  </Chip>
                </span>
                <span className="font-semibold text-primary-300">
                  {formatARS(totalParts)}
                </span>
              </div>
            )}
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
