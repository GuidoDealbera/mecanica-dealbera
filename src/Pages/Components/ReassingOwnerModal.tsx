import React from "react";
import {
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Button, Divider, Input, Autocomplete, AutocompleteItem,
} from "@heroui/react";
import { MdPerson, MdPersonAdd, MdWarning } from "react-icons/md";
import { useSelector } from "react-redux";
import { useForm, Controller } from "react-hook-form";
import { useToasts } from "../../Hooks/useToasts";
import { RootState } from "../../Store/store";
import { handleCapitalizedChange } from "../../Utils/utils";

interface NewOwnerForm {
  fullname: string;
  phone: string;
  address: string;
  city: string;
  email: string;
}

interface ReassignOwnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  licensePlate: string;
  currentOwnerName: string;
  /** Llamado cuando la reasignación fue exitosa — para que el padre recargue el auto */
  onSuccess: () => void;
}

/**
 * Modal para reasignar el titular de un vehículo.
 * Dos modos:
 *   - "existing": seleccionar un cliente ya registrado via Autocomplete
 *   - "new": cargar un nuevo cliente con su formulario
 */
const ReassignOwnerModal: React.FC<ReassignOwnerModalProps> = ({
  isOpen,
  onClose,
  licensePlate,
  currentOwnerName,
  onSuccess,
}) => {
  const { showToast } = useToasts();
  const allClients = useSelector((state: RootState) => state.clients.allClients);

  const [mode, setMode] = React.useState<"existing" | "new">("existing");
  const [selectedFullname, setSelectedFullname] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { isValid },
  } = useForm<NewOwnerForm>({
    mode: "onChange",
    defaultValues: { fullname: "", phone: "", address: "", city: "", email: "" },
  });

  // Limpiar estado al abrir/cerrar
  React.useEffect(() => {
    if (!isOpen) {
      setMode("existing");
      setSelectedFullname("");
      reset();
      setLoading(false);
    }
  }, [isOpen, reset]);

  const clientOptions = React.useMemo(
    () =>
      allClients
        // Excluir al titular actual para evitar confusión
        .filter((c) => c.fullname !== currentOwnerName)
        .map((c) => ({ key: c.fullname, label: c.fullname, phone: c.phone, city: c.city })),
    [allClients, currentOwnerName]
  );

  const selectedClient = React.useMemo(
    () => allClients.find((c) => c.fullname === selectedFullname),
    [allClients, selectedFullname]
  );

  const handleExistingSubmit = async () => {
    if (!selectedFullname) return;
    setLoading(true);
    try {
      const res = await window.api.cars.reassignOwner(licensePlate, {
        mode: "existing",
        existingOwnerFullname: selectedFullname,
      });
      if (res.status === "success") {
        showToast(res.message, "success", "Cambio de titular");
        onSuccess();
        onClose();
      } else {
        showToast(res.message, "danger", "Cambio de titular");
      }
    } catch {
      showToast("Error inesperado al cambiar el titular", "danger", "Cambio de titular");
    } finally {
      setLoading(false);
    }
  };

  const handleNewSubmit = async (data: NewOwnerForm) => {
    setLoading(true);
    try {
      const res = await window.api.cars.reassignOwner(licensePlate, {
        mode: "new",
        newOwner: {
          fullname: data.fullname,
          phone: data.phone,
          address: data.address,
          city: data.city,
          email: data.email || undefined,
        },
      });
      if (res.status === "success") {
        showToast(res.message, "success", "Cambio de titular");
        onSuccess();
        onClose();
      } else {
        showToast(res.message, "danger", "Cambio de titular");
      }
    } catch {
      showToast("Error inesperado al cambiar el titular", "danger", "Cambio de titular");
    } finally {
      setLoading(false);
    }
  };

  const canConfirmExisting = !!selectedFullname && !loading;
  const formId = "reassign-new-owner-form";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      className="bg-foreground-800 text-white"
      placement="center"
      backdrop="blur"
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-2 text-lg font-bold">
          <MdPerson size={18} className="text-primary-400" />
          Cambiar titular — {licensePlate}
        </ModalHeader>
        <Divider />

        <ModalBody className="pt-4 pb-2 flex flex-col gap-4">
          {/* Aviso sobre el titular actual */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-warning-900/30 border border-warning-700/50">
            <MdWarning size={16} className="text-warning-400 flex-shrink-0 mt-0.5" />
            <p className="text-warning-300 text-sm">
              Titular actual:{" "}
              <span className="font-semibold">{currentOwnerName}</span>. Si no tiene
              otros vehículos, seguirá en el sistema sin vehículos asignados.
            </p>
          </div>

          {/* Selector de modo */}
          <div className="flex gap-2">
            <Button
              size="sm"
              fullWidth
              color={mode === "existing" ? "primary" : "default"}
              startContent={<MdPerson size={15} />}
              onPress={() => setMode("existing")}
            >
              Titular existente
            </Button>
            <Button
              size="sm"
              fullWidth
              color={mode === "new" ? "primary" : "default"}
              startContent={<MdPersonAdd size={15} />}
              onPress={() => setMode("new")}
            >
              Nuevo titular
            </Button>
          </div>

          <Divider />

          {/* ── Modo: cliente existente ── */}
          {mode === "existing" && (
            <div className="flex flex-col gap-4">
              <Autocomplete
                label="Buscar cliente por nombre"
                placeholder="Escribí el nombre..."
                allowsCustomValue={false}
                defaultItems={clientOptions}
                onSelectionChange={(key) => setSelectedFullname(key as string ?? "")}
                isDisabled={loading}
              >
                {(item) => (
                  <AutocompleteItem
                    key={item.key}
                    textValue={item.label}
                    description={`${item.phone} · ${item.city}`}
                  >
                    {item.label}
                  </AutocompleteItem>
                )}
              </Autocomplete>

              {/* Preview del cliente seleccionado */}
              {selectedClient && (
                <div className="flex flex-col gap-1 p-3 rounded-lg bg-foreground-700 border border-foreground-600">
                  <p className="text-white font-semibold text-sm">{selectedClient.fullname}</p>
                  <p className="text-foreground-400 text-xs">{selectedClient.phone}</p>
                  <p className="text-foreground-400 text-xs">
                    {selectedClient.address} · {selectedClient.city}
                  </p>
                  {selectedClient.email && (
                    <p className="text-foreground-400 text-xs">{selectedClient.email}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Modo: nuevo cliente ── */}
          {mode === "new" && (
            <form
              id={formId}
              onSubmit={handleSubmit(handleNewSubmit)}
              className="flex flex-col gap-3"
              noValidate
            >
              <Controller
                control={control}
                name="fullname"
                rules={{
                  required: "Campo obligatorio",
                  minLength: { value: 4, message: "El nombre es muy corto" },
                }}
                render={({ field, fieldState: { error } }) => (
                  <Input
                    {...field}
                    label="Nombre completo"
                    isRequired
                    isInvalid={!!error}
                    errorMessage={error?.message}
                    isDisabled={loading}
                    onChange={handleCapitalizedChange(field.onChange)}
                  />
                )}
              />
              <Controller
                control={control}
                name="phone"
                rules={{ required: "Campo obligatorio" }}
                render={({ field, fieldState: { error } }) => (
                  <Input
                    {...field}
                    label="Teléfono"
                    isRequired
                    isInvalid={!!error}
                    errorMessage={error?.message}
                    isDisabled={loading}
                    onChange={(e) =>
                      field.onChange(e.target.value.replace(/[^\d+]/g, ""))
                    }
                  />
                )}
              />
              <Controller
                control={control}
                name="address"
                rules={{ required: "Campo obligatorio" }}
                render={({ field, fieldState: { error } }) => (
                  <Input
                    {...field}
                    label="Dirección"
                    isRequired
                    isInvalid={!!error}
                    errorMessage={error?.message}
                    isDisabled={loading}
                    onChange={handleCapitalizedChange(field.onChange)}
                  />
                )}
              />
              <Controller
                control={control}
                name="city"
                rules={{ required: "Campo obligatorio" }}
                render={({ field, fieldState: { error } }) => (
                  <Input
                    {...field}
                    label="Localidad"
                    isRequired
                    isInvalid={!!error}
                    errorMessage={error?.message}
                    isDisabled={loading}
                    onChange={handleCapitalizedChange(field.onChange)}
                  />
                )}
              />
              <Controller
                control={control}
                name="email"
                rules={{
                  pattern: {
                    value: /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/,
                    message: "Correo inválido",
                  },
                }}
                render={({ field, fieldState: { error } }) => (
                  <Input
                    {...field}
                    type="email"
                    label="Correo electrónico (opcional)"
                    isInvalid={!!error}
                    errorMessage={error?.message}
                    isDisabled={loading}
                  />
                )}
              />
            </form>
          )}
        </ModalBody>

        <ModalFooter>
          <Button color="danger" onPress={onClose} isDisabled={loading}>
            Cancelar
          </Button>

          {mode === "existing" ? (
            <Button
              color="primary"
              isLoading={loading}
              isDisabled={!canConfirmExisting}
              onPress={handleExistingSubmit}
            >
              Confirmar cambio
            </Button>
          ) : (
            <Button
              color="primary"
              type="submit"
              form={formId}
              isLoading={loading}
              isDisabled={!isValid || loading}
            >
              Registrar y asignar
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ReassignOwnerModal;