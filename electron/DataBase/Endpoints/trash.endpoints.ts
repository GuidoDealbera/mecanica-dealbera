import { handleIpc, handleIpcQuery } from "../../ipc";
import { logError } from "../../logger";
import { esIdentificador } from "../../validation";
import { AppDataSource } from "../dataSource";
import { invalidateDashboardStatsCache } from "../dashboardCache";
import { invalidateServiceSettingsCache } from "../serviceReminders.service";
import {
  listTrash,
  purgeFromTrash,
  restoreFromTrash,
  type TrashItem,
} from "../trash.service";
import type { APIResponse } from "../../../src/Types/apiTypes";

/** Lo que hay en la papelera, de lo más reciente a lo más viejo. */
handleIpcQuery(
  "trash:list",
  "No se pudo leer la papelera",
  async (): Promise<TrashItem[]> => await listTrash(AppDataSource.manager)
);

/**
 * Devuelve a la base lo que se había borrado.
 *
 * Va en una transacción porque restaurar son varios `INSERT` —el titular, el
 * vehículo, sus trabajos, su recordatorio— y media restauración es peor que
 * ninguna: dejaría un vehículo sin sus trabajos y sin forma de saberlo.
 */
handleIpc(
  "trash:restore",
  async (_event, id: unknown): Promise<APIResponse> => {
    if (!esIdentificador(id)) {
      return { status: "failed", message: "No se encontró lo borrado" };
    }

    const qr = AppDataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const res = await restoreFromTrash(qr.manager, id);
      if (!res.ok) {
        await qr.rollbackTransaction();
        return { status: "failed", message: res.message };
      }
      await qr.commitTransaction();
      invalidateDashboardStatsCache();
      // Lo restaurado puede traer sus propios intervalos de service.
      invalidateServiceSettingsCache();
      return {
        status: "success",
        message: `Se recuperó ${res.label}`,
        result: undefined,
      };
    } catch (error) {
      await qr.rollbackTransaction();
      logError("trash:restore", error, { id });
      return { status: "failed", message: "No se pudo recuperar" };
    } finally {
      await qr.release();
    }
  }
);

/** Tira definitivamente un elemento de la papelera. */
handleIpc("trash:purge", async (_event, id: unknown): Promise<APIResponse> => {
  if (!esIdentificador(id)) {
    return { status: "failed", message: "No se encontró lo borrado" };
  }
  const borrado = await purgeFromTrash(AppDataSource.manager, id);
  return borrado
    ? {
        status: "success",
        message: "Eliminado definitivamente",
        result: undefined,
      }
    : { status: "failed", message: "No se encontró lo borrado" };
});
