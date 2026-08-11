# Plan de Mejoras — Mecánica Dealbera

Revisión integral del proyecto al **10/08/2026**, hecha después de cerrar el plan
anterior (33 tareas, sprints 0 a 7). Este archivo reemplaza ese plan: lo que
estaba hecho quedó en el historial de git y en los commits; acá queda **sólo lo
que falta**, ordenado por valor y riesgo.

Estados posibles: `pendiente` · `en progreso` · `a testear` · `hecho`

Convención de trabajo: una tarea por vez → implementar → probar → commitear.

---

## Contexto del proyecto

Aplicación de escritorio (Electron + React 18 + Redux Toolkit + TypeORM/SQLite)
para la gestión de un taller mecánico: vehículos, titulares, trabajos,
recordatorios de service, documentos (presupuesto/factura) y resguardo de datos.

- **Renderer**: React + HeroUI + Tailwind v4, HashRouter con rutas diferidas,
  layout de alto fijo (`PageShell`) y tema claro/oscuro (`hero.ts` como fuente de
  verdad de la paleta).
- **Main**: endpoints IPC por dominio (`electron/DataBase/Endpoints/*`) envueltos
  en `handleIpc`, migraciones automáticas al iniciar, logs estructurados
  (`electron-log`), auto-update y respaldo diario.
- **Reglas de dominio compartidas** entre main y renderer en `src/Utils/`
  (`serviceReminders.ts`, `budgetPdf.ts`, `timeline.ts`): son módulos puros y son
  los únicos con tests.
- **Verificación**: `npx tsc --noEmit`, `npm run lint`, `npx vitest run`,
  `npx vite build`, `npm run format:check`.

---

## Sprint A — Bugs confirmados

Todos están verificados leyendo el código (y varios contra una copia de la base
real). Son chicos y de bajo riesgo: conviene empezar por acá.

1. **[pendiente]** El error del auto-updater nunca llega a la interfaz
   - Archivo: `electron/main.ts:120` vs `src/Components/Header.tsx:141`.
   - `autoUpdater.on("error")` emite `{ error: error.message }`, pero el contrato
     (`UpdateError` en `global.d.ts`) y el consumidor leen `data.message`. El
     resultado es `setUpdateError(undefined)`: el menú nunca muestra "Error al
     buscar actualizaciones" y el motivo real se pierde. El otro emisor del mismo
     canal (`check-for-updates`, `main.ts:268`) sí manda `{ message }`.
   - Solución: emitir `{ message: error.message }` en el `on("error")` (una
     línea) y, de paso, mostrar el mensaje en el ítem del menú.
   - Esfuerzo: mínimo · Riesgo: nulo.

2. **[pendiente]** El historial de kilometraje suma un registro aunque el km no cambie
   - Archivo: `electron/DataBase/Endpoints/car.crud.endpoints.ts:178`.
   - Sólo se rechaza `kilometers < car.kilometers`; con el **mismo** valor se
     appendea otro punto al `kmHistory`. Guardar el formulario del vehículo sin
     tocar el kilometraje ensucia el historial (y el gráfico de KM) con puntos
     repetidos.
   - Solución: appendear sólo si `kilometers > car.kilometers`; si es igual,
     actualizar el resto sin tocar el historial.
   - Esfuerzo: mínimo · Riesgo: bajo.

3. **[pendiente]** Borrar un vehículo puede borrar al titular sin avisarlo
   - Archivos: `car.crud.endpoints.ts:214` (borra el `owner` si se quedó sin
     autos) y `src/Components/DeleteCarDialog.tsx` (no lo menciona).
   - El diálogo detalla que se eliminan los trabajos y el historial, pero no que
     el cliente desaparece si era su único vehículo. Es la única operación de la
     app que borra un registro que el usuario no eligió borrar.
   - Solución: decidir la regla y hacerla explícita. Recomendado: **no** borrar
     al titular (dejarlo inactivo o simplemente sin autos, que es un estado
     válido y ya soportado por el listado de clientes) o, si se conserva el
     borrado en cascada, decirlo en el diálogo con el nombre del cliente.
   - Esfuerzo: bajo · Riesgo: medio (cambia una regla de negocio).

4. **[pendiente]** El recordatorio de service se programa fuera de la transacción del trabajo
   - Archivo: `electron/DataBase/Endpoints/car.jobs.endpoints.ts:60` y `:137`.
   - `car:add-job` y `car:update-job` guardan el trabajo y **después** llaman a
     `completeAndScheduleNext` con `AppDataSource.manager`. Si esa segunda parte
     falla, el trabajo queda cerrado y el recordatorio sin cerrar (el vehículo
     sigue apareciendo como que necesita service).
   - Solución: envolver ambos handlers en un `QueryRunner` y pasarle
     `qr.manager` (el módulo de dominio ya recibe el `EntityManager` por
     parámetro justamente para esto).
   - Esfuerzo: bajo · Riesgo: bajo.

5. **[pendiente]** `car:find-jobs` es código muerto y su contrato miente
   - Archivos: `car.jobs.endpoints.ts:87`, `electron/preload.ts:56`,
     `global.d.ts:78`.
   - No lo usa ninguna pantalla. Además devuelve `null` cuando no hay resultados
     pero está tipado como array, y trae **todos** los autos con todos sus
     trabajos a memoria.
   - Solución: eliminar el handler, el método del preload y el tipo.
   - Esfuerzo: mínimo · Riesgo: nulo.

6. **[pendiente]** Los trabajos de la ficha no tienen un orden garantizado
   - Archivo: `car.crud.endpoints.ts:148` (`relations: ["jobs"]` sin `ORDER BY`).
   - El orden lo decide la base. La tabla permite ordenar por estado y precio,
     pero el orden inicial (y el del PDF, y el del timeline) queda al azar.
   - Solución: cargar los trabajos ordenados por `createdAt DESC` (o exponer el
     orden como parámetro) para que la ficha, el documento y el historial
     coincidan.
   - Esfuerzo: bajo · Riesgo: bajo.

7. **[pendiente]** Robustez del arranque de Electron
   - Archivo: `electron/main.ts`.
   - Tres puntos flojos: (a) `uncaughtException` muestra un cuadro de error y
     **sigue** con la app en estado indefinido; (b) no hay handler de
     `unhandledRejection`, así que una promesa rechazada en el main desaparece
     sin log; (c) el splash se cierra en `ready-to-show`, y si la ventana nunca
     llega a ese evento (error de carga) queda una ventana `alwaysOnTop` sin
     salida y sin mensaje.
   - Solución: loguear y cerrar de forma controlada en `uncaughtException`,
     agregar `process.on("unhandledRejection")` con `logError`, y escuchar
     `did-fail-load` con un timeout de seguridad que cierre el splash y muestre
     el error.
   - Esfuerzo: bajo · Riesgo: bajo.

---

## Sprint B — Rendimiento y modelo de datos

8. **[pendiente]** El dashboard recorre toda la base en memoria
   - Archivo: `electron/DataBase/Endpoints/dashboard.endpoints.ts:29`.
   - `carRepository.find({ relations: ["jobs"] })` trae **todos** los vehículos
     con **todos** sus trabajos al proceso main para contar y sumar en un `for`.
     Con la base de prueba actual (101 autos / 313 trabajos) no se nota, pero
     crece de forma lineal y es el único lugar que quedó sin paginar. La caché en
     memoria lo tapa hasta que una mutación la invalida.
   - Solución: reemplazar el recorrido por agregados SQL (`COUNT`/`SUM` con
     `GROUP BY status`, y los ingresos por mes con `strftime`), dejando en
     memoria sólo los "trabajos recientes" (que ya están limitados a 6).
   - Esfuerzo: medio · Riesgo: medio (hay que mantener los mismos números; se
     puede validar comparando la salida vieja y la nueva sobre la misma base).

9. **[pendiente]** El listado de clientes trae todos los vehículos para mostrar un número
   - Archivo: `electron/DataBase/Endpoints/client.endpoints.ts:60-88`.
   - `client:get-all` hace `leftJoinAndSelect("client.cars")` (por eso necesita el
     paginado en dos pasos de TypeORM) sólo para poder mostrar la cantidad de
     vehículos y usarla en el diálogo de borrado.
   - Solución: subconsulta `COUNT` como columna calculada (`loadRelationCountAndMap`
     o `addSelect` con subquery) en vez de traer las filas.
   - Esfuerzo: bajo · Riesgo: bajo.

10. **[pendiente]** Índices que faltan para las consultas que ya existen
    - `job.status`: lo usan el badge de trabajos activos (`car:active-jobs-count`)
      y el dashboard; hoy es un scan completo de `job`.
    - `job.carId` ya existe (`IDX_job_car`), `service_reminder` tiene sus dos
      índices y `document(type, number)` su único compuesto.
    - Solución: migración con `@Index()` sobre `job.status`.
    - Esfuerzo: mínimo · Riesgo: bajo.

11. **[pendiente]** Revisar el paginado en dos pasos de TypeORM en el resto de los listados
    - Contexto: el `TypeError` de la bandeja de recordatorios (ver notas de
      sesión) salió de combinar `skip/take` + joins + un `ORDER BY` con una
      expresión SQL. `car:get-all` y `client:get-all` también usan `skip/take`
      con joins, pero ordenan por columnas reales, así que hoy funcionan.
    - Solución: dejar un comentario/regla en `electron/pagination.ts` — con joins
      `*-a-uno` conviene `offset/limit`; `skip/take` sólo cuando el join
      multiplica filas (uno-a-muchos, como `client.cars`) — para que no vuelva a
      pasar.
    - Esfuerzo: mínimo · Riesgo: nulo.

---

## Sprint C — Empaquetado y resguardo de datos

Es la recomendación que quedó pendiente al descartar el multi-usuario (tarea 33
del plan anterior). El objetivo es que un imprevisto —corte de luz, disco lleno,
una migración a medio aplicar, el usuario moviendo un archivo— no se lleve los
datos del taller.

12. **[pendiente]** Mover la base de `Documentos` a `userData`
    - Archivos: `electron/DataBase/dataSource.ts:38` (`getDBPath`), `main.ts:55`.
    - Hoy la base productiva vive en `Documentos/taller.db`: una carpeta que el
      usuario ve, sincroniza con OneDrive y puede mover o borrar sin saber qué
      es. Peor: OneDrive puede bloquear el archivo mientras SQLite escribe.
    - Solución: usar `app.getPath("userData")` con **migración automática** (si
      existe la base vieja y no la nueva, copiarla y renombrar la vieja a
      `.migrated`), y dejar los backups exportados en Documentos (ahí sí tiene
      sentido que se vean).
    - Esfuerzo: medio · Riesgo: alto si se hace mal → hacerlo con la copia de
      seguridad previa del punto 13 ya implementada.

13. **[pendiente]** Snapshot previo a migraciones + verificación de integridad
    - Hoy `migrationsRun: true` corre las migraciones al iniciar sin respaldo
      previo: una migración que falle a mitad deja la base en un estado
      intermedio y la única red es el backup diario (que puede ser de ayer).
    - Solución: antes de `AppDataSource.initialize()`, si hay migraciones
      pendientes, hacer `VACUUM INTO` a `pre-migration-<version>.db`; después de
      inicializar, `PRAGMA integrity_check`. Si falla, avisar y ofrecer
      restaurar el snapshot.
    - Esfuerzo: medio · Riesgo: bajo (sólo agrega red de seguridad).

14. **[pendiente]** Respaldos: `VACUUM INTO` en vez de `copyFileSync` y retención por niveles
    - Archivo: `electron/main.ts:54` (`performAutoBackup`) y
      `backup.endpoints.ts`.
    - `fs.copyFileSync` de un `.db` puede capturar un archivo inconsistente si
      hay una escritura o un journal/WAL en curso, y hoy se conservan 7 copias
      diarias: un problema que se detecta a los 10 días ya no tiene backup sano.
    - Solución: usar `VACUUM INTO` (produce una copia consistente y compactada),
      correr `integrity_check` sobre el resultado y aplicar retención por niveles
      (7 diarios + 4 semanales + 6 mensuales).
    - Esfuerzo: medio · Riesgo: bajo.

15. **[pendiente]** Restaurar un respaldo desde la propia pantalla de Gestión de datos
    - Hoy "Importar base de datos" abre un explorador de archivos: para volver al
      respaldo de anteayer hay que saber dónde está y cuál es.
    - Solución: listar los respaldos automáticos con fecha y tamaño y permitir
      restaurar uno con un click (con la confirmación que ya existe). El listado
      ya se muestra en la tarjeta "Respaldos automáticos"; falta la acción.
    - Esfuerzo: bajo · Riesgo: medio (es una operación destructiva → confirmación
      explícita + respaldo previo, que el endpoint de importación ya hace).

---

## Sprint D — Producto y UX

16. **[pendiente]** Definir los tipos de service (o eliminarlos)
    - Archivos: `src/Types/apiTypes.ts` (`ServiceType`), `AddJobForm`,
      `Jobs.tsx`, `service.endpoints.ts`.
    - Hay cinco tipos (general, aceite, correa, frenos, otro) y el modelo soporta
      un recordatorio vigente **por tipo**, pero en la práctica sólo se usa
      "general": por eso se quitó el filtro por tipo de la bandeja. Queda una
      abstracción a medio usar.
    - Solución: o se definen los intervalos por tipo (correa cada 60.000 km,
      aceite cada 10.000, etc.) y se aprovecha el modelo, o se reduce el campo a
      un booleano "es service" y se simplifica todo el circuito.
    - Esfuerzo: medio · Riesgo: bajo · **Decisión de negocio pendiente.**

17. **[pendiente]** Editar el próximo service desde la ficha del vehículo
    - El endpoint `service:save` (y `SaveReminderBody`) ya existe, está expuesto
      en el preload y no lo usa ninguna pantalla: hoy no hay forma de corregir a
      mano la fecha o el kilometraje del próximo service, ni de fijar un intervalo
      propio para un vehículo (`car.serviceIntervalMonths/Km` sólo se puede
      cambiar por SQL).
    - Solución: modal "Editar próximo service" en el bloque de la ficha, con
      fecha, km e intervalo del vehículo.
    - Esfuerzo: medio · Riesgo: bajo.

18. **[pendiente]** Historial de documentos emitidos
    - `document:list` está implementado y expuesto, sin UI. Los documentos se
      registran con su número correlativo, patente, titular y total, así que ya
      hay con qué armar el historial; hoy no hay forma de ver qué se emitió.
    - Solución: pestaña o modal con los documentos del vehículo (número, tipo,
      fecha, total) y el mismo listado global en Gestión de datos. Ideal:
      permitir re-descargar el PDF a partir del registro.
    - Esfuerzo: medio (alto si se quiere reimprimir fiel: habría que guardar los
      ítems del documento, no sólo el total) · Riesgo: bajo.

19. **[pendiente]** Filtrar la bandeja por "ya avisado"
    - `contactedAt` se guarda y se muestra, pero no se puede filtrar. Con 72
      recordatorios vencidos, lo primero que se necesita es "a quién todavía no
      le avisé".
    - Solución: filtro de dos estados (avisados / sin avisar) en la bandeja,
      resuelto en la consulta.
    - Esfuerzo: bajo · Riesgo: nulo.

20. **[pendiente]** Las notas internas nunca salen en el documento
    - Decisión original (tarea 20 del plan anterior): las notas son internas y no
      se imprimen. Está bien por defecto, pero a veces hace falta una
      observación para el cliente.
    - Solución: campo aparte "observaciones para el cliente" por trabajo, o un
      check por trabajo en el modal de emisión para incluir su nota.
    - Esfuerzo: bajo · Riesgo: nulo.

21. **[pendiente]** Refresco de contadores por evento en vez de por navegación
    - Los badges de la barra ahora se recalculan en cada cambio de pantalla (ver
      notas de sesión). Alcanza para un solo usuario, pero sigue siendo un
      "polling" atado a navegar.
    - Solución: canal `main → renderer` que emita "datos cambiados" cuando se
      invalida la caché del dashboard, y que el Header y el dashboard escuchen.
    - Esfuerzo: bajo · Riesgo: bajo.

22. **[pendiente]** Emitir un documento consolidado desde la ficha del cliente
    - Hoy el presupuesto/factura es por vehículo. Un cliente con dos autos en el
      taller necesita dos documentos.
    - Solución: reusar el modal de emisión con los trabajos de todos sus
      vehículos, agrupados por patente en la tabla del PDF.
    - Esfuerzo: medio · Riesgo: bajo.

---

## Sprint E — Calidad y automatización

23. **[pendiente]** No hay tests de componentes ni de endpoints
    - Los 97 tests actuales cubren **sólo** módulos puros
      (`serviceReminders`, `budgetPdf`, `timeline`, `utils`). Todo lo que rompió
      en las últimas sesiones (el paginado de la bandeja, el layout que
      comprimía las tarjetas, el filtro de trabajos del PDF) está fuera de esa
      cobertura.
    - Solución: (a) React Testing Library + jsdom para los componentes con
      reglas —`DocumentModal` (elegibilidad y totales), `ReminderActions`
      (botones según estado), tablas paginadas—; (b) tests de endpoints con una
      base SQLite en memoria y las migraciones aplicadas, que es donde vive la
      lógica más delicada.
    - Esfuerzo: alto (setup + primeros casos) · Riesgo: nulo · **Es la mejora con
      mejor relación costo/beneficio a mediano plazo.**

24. **[pendiente]** Verificación automática antes de publicar
    - Hoy `tsc`, `lint`, `vitest` y `build` se corren a mano.
    - Solución: script `npm run verify` que encadene los cuatro, y un workflow de
      GitHub Actions que lo ejecute en cada push a `feat/*` y `main`.
    - Esfuerzo: bajo · Riesgo: nulo.

25. **[pendiente]** Diferir el stack de PDF
    - `jsPDF` + `jspdf-autotable` + la fuente embebida pesan ~516 kB y hoy entran
      en el chunk de la ficha del vehículo, que es la pantalla más usada.
    - Solución: `import()` dinámico dentro de `useBudgetPDF` (el hook ya es el
      único punto de entrada), así el peso se paga sólo al emitir un documento.
    - Esfuerzo: bajo · Riesgo: bajo.

26. **[pendiente]** Documentar las convenciones del proyecto en `CLAUDE.md`/README
    - Hay reglas aprendidas a fuerza de romper cosas que no están escritas en
      ningún lado: HeroUI invierte las escalas numéricas entre temas (usar tokens
      base + transparencia), un contenedor con scroll no debe maquetear (las
      Cards se comprimen), `min-h-0` en los hijos flex, `PageShell` como
      contenedor estándar, y el dominio compartido recibe el `EntityManager` por
      parámetro.
    - Solución: escribirlas en un `CLAUDE.md` (o `docs/CONVENCIONES.md`).
    - Esfuerzo: bajo · Riesgo: nulo.

---

## Notas de sesión

### 2026-08-10 — Correcciones sobre observaciones de uso (esta sesión)

Cinco observaciones del usuario + una mejora pedida sobre la marcha. Todo
verificado con `tsc`, `lint`, Prettier, 97 tests y `vite build`.

1. **La bandeja de recordatorios salía vacía y tiraba un `TypeError`** — mismo
   bug de raíz para las dos cosas. `service:list` combinaba `skip/take` con joins
   y un `ORDER BY` con expresión (`reminder.dueDate IS NULL`): TypeORM resuelve
   ese paginado con una subconsulta de ids distintos y necesita mapear cada
   `ORDER BY` a una columna real, así que fallaba con
   `Cannot read properties of undefined (reading 'databaseName')`. El rechazo no
   estaba atendido en la pantalla, así que se veía "Todo al día" con 72
   recordatorios en la base. Reproducido y corregido contra una copia de la base
   real (`offset/limit`, correcto acá porque los joins son `*-a-uno`): 72
   resultados, 9 páginas, los recordatorios sin fecha al final. Se agregó además
   el `catch` con toast en la pantalla.
2. **Acciones de los recordatorios** — se definieron las reglas y viven en un
   solo lugar (`getReminderActions`, en el módulo puro compartido): un service
   **al día no se puede posponer** (posponer no cambia el vencimiento, sólo lo
   escondía), un **postergado no se vuelve a posponer** sino que primero se
   **reactiva** (acción nueva, con endpoint `service:reactivate` que respeta la
   invariante de un recordatorio vigente por vehículo y tipo), y los estados
   cerrados no admiten acciones. Las reglas las **valida el backend**, no sólo la
   UI. La bandeja y la ficha del vehículo ahora comparten la misma barra de
   acciones (`ReminderActions`) y muestran "Postergado hasta dd/mm/aaaa", que es
   lo que antes no se reflejaba en ningún lado. También se corrigió el chip de
   estado: un service ya hecho se mostraba como "Al día" porque la urgencia no
   evalúa los cerrados (`getReminderBadge`). 10 tests nuevos.
3. **Presupuesto/factura con selección de trabajos** — los **entregados quedan
   siempre afuera** (ya se cobraron: su lugar es el historial). Nuevo
   `DocumentModal`: se elige el tipo y se marcan los trabajos con checkboxes,
   con el total en vivo y un aviso de cuántos entregados se excluyeron. El
   presupuesto admite sin comenzar / en progreso / completados; la factura, sólo
   completados. `filterJobsForDocument(jobs, onlyCompleted)` pasó a ser
   `eligibleJobsForDocument(jobs, type)` y la regla se reaplica en el hook (no
   sólo en la UI). El `Dropdown` de "Descargar" se reemplazó por el modal y se
   eliminó la variante `compact` del botón, que no se usaba.
4. **Banner del dashboard** — decía "N vehículos sin service en los últimos 6
   meses", que era la heurística vieja; ahora dice "N vehículos requieren
   service" con la aclaración de que son vencidos o por vencer, por fecha o por
   kilometraje (que es lo que realmente cuenta `countDueReminders`). Además los
   endpoints de recordatorios **invalidan la caché del dashboard**: posponer o
   completar un service cambiaba el número real pero el banner seguía mostrando
   el viejo.
5. **Gestión de datos** — nuevo componente `DataCard` (ícono + título +
   descripción + aviso + acción, con el botón anclado al pie para que la fila
   quede pareja) y las cinco tarjetas pasaron a usarlo, en una grilla de tres
   columnas para que no quede una suelta. Los colores se rehicieron con **tokens
   base + transparencia** (`text-success`, `bg-warning/10`) en vez de tonos
   numéricos: HeroUI invierte las escalas entre temas, así que los
   `text-success-300` / `border-warning-800` se veían lavados o pesados según el
   tema. La pantalla ahora usa `PageShell` como el resto.
6. **Filtro "Tipo de service"** — quitado de la bandeja (hoy hay un solo circuito
   real). El parámetro sigue en el endpoint para cuando los tipos se usen de
   verdad (ver tarea 16).
7. **Acciones rápidas fijas en el inicio** (pedido sobre la marcha) — "Ingresar
   Vehículo" y "Nuevo Trabajo" se movieron a la cabecera fija del dashboard
   (`PageShell`), así están siempre a la vista sin depender del scroll; antes
   estaban al pie y se duplicaban en el estado sin datos.
8. **Extra encontrado en la revisión** — los badges de la barra de navegación se
   cargaban una única vez al montar, y como el `Header` nunca se desmonta,
   quedaban congelados toda la sesión (cargar un trabajo o cerrar un service no
   se reflejaba hasta reiniciar). Ahora se recalculan en cada cambio de pantalla.

Archivos nuevos: `src/Components/DocumentModal.tsx`,
`src/Components/DataCard.tsx`, `src/Pages/Components/ReminderActions.tsx`.
Modificados: `electron/DataBase/Endpoints/service.endpoints.ts`,
`electron/preload.ts`, `global.d.ts`, `src/Utils/serviceReminders.ts` (+ tests),
`src/Utils/budgetPdf.ts` (+ tests), `src/Utils/pdfPreview.test.ts`,
`src/Hooks/useBudgetPdf.ts`, `src/Components/BudgetButton.tsx`,
`src/Components/Header.tsx`, `src/Pages/{HomePage,BackupPage,ServiceAlertsPage}.tsx`,
`src/Pages/Components/NextServiceCard.tsx`.

### Historial anterior

El plan de 33 tareas (sprints 0 a 7) se completó entre el 18/07/2026 y el
08/08/2026: fixes urgentes, tests de utilidades, índices, logs estructurados,
wrapper de IPC, validación de DTOs, `APIResponse` unificada, separación de
endpoints por dominio, caché del dashboard, normalización de `jobs` como entidad,
paginación server-side, hooks de datos vs UI, features de taller (WhatsApp,
notas, historiales, filtros, atajos de teclado, tema claro/oscuro, PDF con
numeración correlativa, historial cruzado de cliente) y el sistema de
recordatorios de service. Dos tareas quedaron fuera por decisión del usuario:
**fotos del vehículo** (descartada) y **multi-usuario con PIN** (pospuesta, y
reemplazada por las tareas 12 a 15 de este plan).
