import { handleIpc } from "../../ipc";
import { AppDataSource } from "../dataSource";
import type { DashboardStats } from "../../../src/Types/types";
import {
  getDashboardStatsCache,
  setDashboardStatsCache,
} from "../dashboardCache";
import { computeDashboardStats } from "../dashboardStats.service";
import type { APIResponse } from "../../../src/Types/apiTypes";

/**
 * Estadísticas del dashboard. El cálculo vive en `dashboardStats.service.ts`
 * (agregados SQL); acá sólo queda la caché en memoria, que se invalida ante
 * cualquier mutación.
 */
handleIpc(
  "dashboard:get-stats",
  async (): Promise<APIResponse<DashboardStats>> => {
    const cached = getDashboardStatsCache();
    if (cached) {
      return {
        status: "success",
        message: "Estadísticas obtenidas",
        result: cached,
      };
    }

    const result = await computeDashboardStats(AppDataSource.manager);
    setDashboardStatsCache(result);

    return {
      status: "success",
      message: "Estadísticas obtenidas",
      result,
    };
  }
);
