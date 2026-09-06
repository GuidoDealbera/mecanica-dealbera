import React from "react";
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Textarea,
} from "@heroui/react";
import {
  SERVICE_TYPE_LABELS,
  ServiceType,
  type APIResponse,
  type SaveReminderBody,
  type ServiceReminderView,
} from "../Types/apiTypes";

interface EditReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  licensePlate: string;
  /** Recordatorio a editar. Si no viene, se crea uno nuevo (service general). */
  reminder?: ServiceReminderView | null;
  /** Kilometraje actual del vehículo, para avisar si el objetivo ya pasó. */
  currentKm: number;
  onSaved: () => void | Promise<void>;
  onResult: (response: APIResponse<unknown>) => void;
}

/** `<input type="date">` necesita `YYYY-MM-DD` en hora local, no ISO en UTC. */
const toDateInput = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/**
 * Ajusta a mano el próximo service de un vehículo.
 *
 * El endpoint `service:save` existía desde que se armó el sistema de
 * recordatorios pero no lo usaba ninguna pantalla: no había forma de corregir
 * una fecha o un kilometraje sin entrar a la base. Este modal es esa forma.
 *
 * La validación de verdad la hace el backend (al menos una de las dos, fecha
 * válida, km no negativo, un solo recordatorio vigente por tipo). Acá se valida
 * lo mismo sólo para no hacer ir y volver un error obvio.
 */
const EditReminderModal: React.FC<EditReminderModalProps> = ({
  isOpen,
  onClose,
  licensePlate,
  reminder,
  currentKm,
  onSaved,
  onResult,
}) => {
  const [dueDate, setDueDate] = React.useState("");
  const [dueKm, setDueKm] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  // Los campos se recargan cada vez que se abre: si el modal quedara con los
  // valores de la vez anterior, editar dos recordatorios seguidos mostraría los
  // datos del primero.
  React.useEffect(() => {
    if (!isOpen) return;
    setDueDate(toDateInput(reminder?.dueDate));
    setDueKm(reminder?.dueKm != null ? String(reminder.dueKm) : "");
    setNotes(reminder?.notes ?? "");
  }, [isOpen, reminder]);

  const kmNumber = dueKm.trim() === "" ? null : Number(dueKm);
  const kmInvalido =
    kmNumber !== null && (!Number.isFinite(kmNumber) || kmNumber < 0);
  const sinCriterio = dueDate.trim() === "" && kmNumber === null;
  const kmYaAlcanzado =
    kmNumber !== null && !kmInvalido && kmNumber <= currentKm;

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: SaveReminderBody = {
        id: reminder?.id,
        licensePlate,
        type: reminder?.type ?? ServiceType.GENERAL,
        // La fecha se manda como mediodía local para que el cambio de huso no
        // la corra un día al convertirla a ISO.
        dueDate: dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : null,
        dueKm: kmNumber,
        notes: notes.trim() || undefined,
      };
      const res = await window.api.service.save(body);
      onResult(res);
      if (res.status === "success") {
        await onSaved();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} placement="center" backdrop="blur">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <span className="text-xl font-bold">Editar próximo service</span>
          <span className="text-foreground-400 text-sm font-normal">
            {licensePlate} ·{" "}
            {SERVICE_TYPE_LABELS[reminder?.type ?? ServiceType.GENERAL]}
          </span>
        </ModalHeader>

        <ModalBody className="gap-4">
          <Input
            type="date"
            label="Vence el"
            description="Dejalo vacío para que el recordatorio sea sólo por kilometraje."
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />

          <Input
            type="number"
            label="Vence a los (km)"
            description={`El vehículo tiene ${currentKm.toLocaleString("es-AR")} km.`}
            value={dueKm}
            onChange={(e) => setDueKm(e.target.value)}
            min={0}
            isInvalid={kmInvalido}
            errorMessage={kmInvalido ? "Ingresá un número válido" : undefined}
          />

          {kmYaAlcanzado && (
            <p className="text-warning text-xs">
              El vehículo ya pasó ese kilometraje, así que el recordatorio va a
              aparecer como vencido.
            </p>
          )}

          <Textarea
            label="Notas (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            minRows={2}
          />

          {sinCriterio && (
            <p className="text-danger text-xs">
              Indicá al menos una fecha o un kilometraje.
            </p>
          )}
        </ModalBody>

        <ModalFooter>
          <Button variant="light" onPress={onClose} isDisabled={saving}>
            Cancelar
          </Button>
          <Button
            color="primary"
            onPress={handleSave}
            isLoading={saving}
            isDisabled={saving || sinCriterio || kmInvalido}
          >
            Guardar
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default EditReminderModal;
