# Plan de Mejoras — Mecánica Dealbera

Estado de las 33 tareas del plan de mejoras. Un sprint por sesión de trabajo, un commit por tarea.
Este archivo se actualiza a medida que se avanza para poder retomar en cualquier sesión futura.

Estados posibles: `pendiente` · `en progreso` · `a testear` · `hecho`

---

## Sprint 0 — Fixes urgentes

1. **[hecho]** Try-catch en `JSON.parse` de migración `AddPartsToExistingJobs`
   - Archivo: `electron/DataBase/Migrations/AddPartsToExistingJobs1700000002000.ts`
   - Cambios: try-catch en `up` y `down` alrededor del `JSON.parse(car.jobs)`; si falla, loguea `carId` + error con `electron-log` y hace `continue` (no aborta la migración completa).
2. **[pendiente]** `car:reassign-owner` sin transacción QueryRunner
   - Archivo: `electron/DataBase/Endpoints/car.endpoints.ts:322`
3. **[pendiente]** `client:update` busca por `fullname` en lugar de `id`
   - Archivo: `electron/DataBase/Endpoints/client.endpoints.ts:118`
4. **[pendiente]** Sin debounce en barras de búsqueda
   - Archivos: `src/Components/SearchBars/FilterLicence.tsx`, `FilterName.tsx`, `GlobalSearch.tsx`

## Sprint 1 — Fundaciones de calidad

5. **[pendiente]** Setup Vitest + tests de utilidades (formatDate, formatARS, alertas de service)
6. **[pendiente]** Índices DB (`@Index()` en licensePlate, fullname, phone)
7. **[pendiente]** Logs estructurados (electron-log con objetos)
8. **[pendiente]** Wrapper global de errores para `ipcMain.handle`

## Sprint 2 — Arquitectura de API

9. **[pendiente]** Activar validación de DTOs (class-validator ya decorado, falta ejecutar)
10. **[pendiente]** `APIResponse<T>` consistente
11. **[pendiente]** Separar `car.endpoints.ts` por dominio (CRUD/jobs/search)
12. **[pendiente]** Caché de estadísticas del dashboard

## Sprint 3 — Modelo de datos grande

13. **[pendiente]** Normalizar `jobs` como entidad separada (alta complejidad/riesgo)
14. **[pendiente]** Formateo de fechas fuera del store Redux
15. **[pendiente]** Paginación en `car:get-all` / `client:get-all`

## Sprint 4 — Separación de responsabilidades

16. **[pendiente]** Hooks de datos vs UI (`useCarStore`/`useClientStore` puros)

## Sprint 5 — Features rápidas

17. **[pendiente]** WhatsApp directo desde la ficha del auto
18. **[pendiente]** Confirmación de borrado descriptiva
19. **[pendiente]** Estado vacío con CTA en listados
20. **[pendiente]** Notas internas por trabajo
21. **[pendiente]** Resumen de actividad en la ficha del cliente
22. **[pendiente]** KM history como gráfico de línea
23. **[pendiente]** Acceso directo desde alerta de service a lista filtrada
24. **[pendiente]** Badge de trabajos activos en la barra de navegación

## Sprint 6 — Features de esfuerzo medio

25. **[pendiente]** Quick-actions de estado en listado de trabajos
26. **[pendiente]** Filtros avanzados y ordenamiento en tablas
27. **[pendiente]** Atajos de teclado globales
28. **[pendiente]** Modo claro/oscuro con toggle persistido
29. **[pendiente]** Presupuesto PDF mejorado con número correlativo
30. **[pendiente]** Historial cruzado de cliente

## Sprint 7 — Features grandes (alta complejidad)

31. **[pendiente]** Sistema de recordatorios de service
32. **[pendiente]** Fotos del vehículo (galería)
33. **[pendiente]** Multi-usuario básico con PIN

---

## Notas de sesión

- 2026-07-18: arranque del plan, definido orden de sprints, confirmado trabajar sobre `feat/news`, un commit por tarea.
