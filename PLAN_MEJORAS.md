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

1. **[hecho]** El error del auto-updater nunca llega a la interfaz
   - Archivos: `electron/main.ts`, `electron/preload.ts`, `global.d.ts`,
     `src/Components/Header.tsx`.
   - Diagnóstico afinado al implementar: `autoUpdater.on("error")` emitía
     `{ error: error.message }` mientras el contrato (`UpdateError`) y el `Header`
     leen `data.message`, así que llegaba `undefined`. Y `checkForUpdates()`, ante
     un fallo, **emite el evento `error` y además rechaza la promesa**: el
     handler de `check-for-updates` reenviaba el mensaje por su cuenta, con lo
     cual una búsqueda manual fallida mostraba **dos** avisos y el estado final
     dependía del orden de llegada. El caso realmente roto era el de
     los fallos **automáticos** (chequeo periódico y descarga), donde sólo se
     emite el evento: ahí la interfaz no mostraba nada útil. Encima el error **no
     se logueaba en ningún lado**, así que no quedaba rastro para diagnosticar.
   - Cambios: un único emisor del canal (el listener de `error`), con la clave
     `message` y `logError`; el handler `check-for-updates` sólo absorbe el
     rechazo (con el motivo documentado) para que el `await` del renderer no quede
     como promesa rechazada sin atender; `downloadUpdate()` también atiende su
     rechazo; el renderer muestra el motivo real en el toast **y** en el ítem del
     menú; y se agregó `updater.removeAllListeners()` con limpieza en el efecto,
     porque los `ipcRenderer.on` del preload acumulaban un handler por montaje
     (en desarrollo `StrictMode` los duplica siempre).

2. **[hecho]** El historial de kilometraje suma un registro aunque el km no cambie
   - Archivos: `electron/DataBase/Endpoints/car.crud.endpoints.ts`,
     `src/Utils/apiResponse.ts` (nuevo, + tests), `src/Hooks/useCarQueries.ts`,
     `src/Hooks/useClientQueries.ts`, `src/Pages/CarDetailPage.tsx`,
     `src/Pages/ClientDetailPage.tsx`.
   - El historial ya no crece si el kilometraje no cambió (el formulario de
     edición lo manda siempre, incluso cuando sólo se editó el titular): con km
     igual no se escribe nada, así que tampoco se toca `updatedAt` ni se
     invalida la caché del dashboard por una edición que no ocurrió. Se midió el
     daño antes de decidir: 2 registros repetidos en la base de desarrollo y
     **0** en la que tiene forma de producción, así que no hace falta una
     migración de limpieza.
   - Se agregó validación del kilometraje en el endpoint (entero finito y no
     negativo): la validación con class-validator sólo cubre el alta, y `NaN` no
     es menor que nada, así que un valor no numérico pasaba el control de "no
     bajar los km" y se guardaba.
   - **Bug más grave encontrado en el mismo camino**: un rechazo del backend se
     reportaba como éxito. Los thunks **resuelven** con `status: "failed"` (sólo
     rechazan si falla la llamada IPC), así que al bajar los kilómetros el
     formulario del vehículo mostraba "Vehículo y titular actualizados
     correctamente" sin haber guardado nada. Se resolvió con un helper puro
     `ensureSuccess` en la capa de presentación (`useCarQueries.updateCar` y
     `useClientQueries.updateOwner`), y las pantallas ahora muestran el motivo
     que devuelve el backend en vez de un "Error al actualizar datos" genérico.
     5 tests nuevos.

3. **[hecho]** Borrar un vehículo puede borrar al titular sin avisarlo
   - Archivos: `electron/DataBase/Endpoints/car.crud.endpoints.ts`,
     `src/Components/DeleteCarDialog.tsx`.
   - **Decisión del usuario (10/08/2026): el titular se conserva.** `car:delete`
     ya no elimina al cliente cuando se borra su último vehículo. Era la única
     operación de la app que destruía un registro que el usuario no había elegido
     borrar, y se llevaba teléfono, dirección y correo de forma irreversible en
     una acción que era "borrar un auto". Se midió antes de decidir: en la base
     de desarrollo **18 de 42 clientes (43%) tienen un solo vehículo**, así que
     pasaba seguido; y la base con forma de producción **ya tenía un cliente sin
     vehículos**, o sea que el estado era válido y soportado.
   - Un cliente sin autos no necesitó trabajo extra de interfaz: `ClientsTable`
     ya muestra "Sin vehículos" y la ficha del cliente tiene su estado vacío.
     Para darlo de baja de verdad sigue estando `client:delete` (que avisa su
     cascada) y el flag activo/inactivo.
   - El diálogo de borrado ahora dice qué se elimina (trabajos, historial de
     kilometraje **y el recordatorio de service**) y, en un bloque aparte, qué se
     conserva: el titular, con su nombre.
   - Verificado contra una copia de la base: el vehículo se borra, el titular
     sobrevive, los trabajos y el recordatorio caen por la cascada de la FK
     (`PRAGMA foreign_keys = 1`), no quedan huérfanos y `foreign_key_check` e
     `integrity_check` salen limpios.

4. **[hecho]** El recordatorio de service se programa fuera de la transacción del trabajo
   - Archivos: `electron/DataBase/Endpoints/car.jobs.endpoints.ts`,
     `src/Hooks/useCarQueries.ts`.
   - `car:add-job` y `car:update-job` ahora corren dentro de un `QueryRunner` y
     le pasan `qr.manager` a `completeAndScheduleNext` (el módulo de dominio
     recibe el `EntityManager` por parámetro justamente para esto). Cerrar un
     service es **un solo hecho**: el trabajo y el recordatorio se guardan juntos
     o no se guarda ninguno. La invalidación de la caché del dashboard pasó a
     ejecutarse **después** del commit.
   - De paso, en `useCarQueries.updateJob` el color del toast estaba fijo en
     `"success"`: con los handlers ahora devolviendo `{status:"failed"}` en vez
     de propagar la excepción, un fallo se habría mostrado como un toast **verde**
     con un mensaje de error. Ahora el color sale del estado de la respuesta.
   - Verificado contra una copia de la base, replicando el cuerpo transaccional:
     con un fallo simulado después de guardar el trabajo, **el trabajo vuelve a
     su estado anterior** y los recordatorios quedan intactos; en el camino feliz
     el trabajo queda completado, el recordatorio anterior pasa a `done` y se
     programa el siguiente.

5. **[hecho]** `car:find-jobs` es código muerto y su contrato miente
   - Archivos: `electron/DataBase/Endpoints/car.jobs.endpoints.ts`,
     `electron/preload.ts`, `global.d.ts`, `src/Types/apiTypes.ts`.
   - Eliminado el handler, el método del preload, el tipo y la mención en el
     comentario de `APIResponse`. No lo usaba ninguna pantalla, devolvía `null`
     cuando no había resultados aunque estaba tipado como array, y traía **todos**
     los autos con todos sus trabajos a memoria.
   - Se verificó el contrato IPC completo con un chequeo cruzado preload ↔ main:
     **43 handlers registrados, ninguno huérfano y ninguno invocado sin
     registrar**.

6. **[hecho]** Los trabajos de la ficha no tienen un orden garantizado
   - Archivos: `electron/DataBase/Endpoints/car.crud.endpoints.ts`,
     `src/Store/carSlice.ts`.
   - `car:get-by-license` ahora pide `order: { jobs: { createdAt: "DESC" } }`. Se
     eligió `createdAt` sobre `updatedAt` para que las filas no salten de lugar
     al cambiarle el estado a un trabajo. Se verificó contra una copia de la base
     que el orden anidado de `find` funciona y que **el orden por defecto no
     coincidía** con el pedido, así que el problema era real y visible (la tabla
     pagina de 5 en 5).
   - También se corrigió el reducer de `addJob`: insertaba el trabajo nuevo **al
     final** del array, así que hasta el próximo refresco el trabajo recién
     cargado aparecía en la última página en lugar de arriba.
   - Se revisaron los otros lectores de `car.jobs`: el CSV calcula el último
     trabajo con un `reduce` por fecha máxima (no depende del orden) y el
     historial ordena sus eventos por su cuenta. El dashboard sí arma sus listas
     de "trabajos recientes" tomando los primeros que encuentra, pero eso se
     resuelve con su reescritura a agregados SQL (tarea 8).

7. **[hecho]** Robustez del arranque de Electron
   - Archivos: `electron/main.ts`, `electron/splash.html`.
   - `uncaughtException` ya no sigue con la app viva: nuevo `fatalError()` que
     registra, cierra el splash, avisa al usuario y sale con `app.exit(1)`. Es lo
     correcto para algo que escribe en una base de datos, y el riesgo de cortar
     de más es bajo porque los errores de los endpoints los captura `handleIpc`
     (llegan al renderer como promesa rechazada, no como excepción del proceso
     principal).
   - Nuevo `process.on("unhandledRejection")` con `logError`: antes una promesa
     rechazada en el proceso principal no dejaba ningún rastro. **No** cierra la
     app (suele ser una operación puntual).
   - **El caso más grave era otro y apareció al implementar**: si
     `initializeDB()` fallaba —base corrupta o migración a medias, justo el
     escenario de la actualización— `createWindow` rechazaba, nadie lo atendía y
     la app quedaba **con el splash abierto para siempre y sin ninguna ventana**.
     Ahora ese camino cierra el splash y sale (sin duplicar el cuadro de error,
     porque `initializeDB` ya muestra el suyo con la ruta de la base).
   - El splash dejó de poder quedar colgado: se creó `closeSplash()` idempotente,
     un plazo máximo de 20 s que lo cierra y muestra la ventana igual, y un
     handler de `did-fail-load` (ignorando `ERR_ABORTED`, que es normal con el
     recargado en caliente). Además su creación es best-effort: si
     `splash.html` no está empaquetado, se registra y la app arranca igual.
   - **Pantalla de carga** (pedido del usuario, opcional): era blanca con un azul
     de Tailwind (`#3b82f6`) que no correspondía a ningún color del sistema, así
     que se veía un fogonazo blanco antes de la app en oscuro. Ahora usa la
     paleta de `hero.ts` (`#006FEE`, fondo oscuro con un halo tenue del color de
     marca) y la ventana se crea con `backgroundColor` oscuro para que no haya
     flash antes de cargar el HTML. También se corrigió el tamaño del título
     (había medidas fijas y media queries que nunca se aplicaban, porque la
     ventana mide 600×600 y el título desbordaba) y el escudo va en una tarjeta
     redondeada, porque es un JPG sin transparencia y sobre el fondo oscuro se
     veía como un rectángulo suelto.

---

## Sprint B — Rendimiento y modelo de datos

8. **[hecho]** El dashboard recorre toda la base en memoria
   - Archivos: `electron/DataBase/dashboardStats.service.ts` (nuevo),
     `electron/DataBase/Endpoints/dashboard.endpoints.ts`.
   - El cálculo se movió a un módulo de dominio que recibe el `EntityManager` por
     parámetro (mismo patrón que `serviceReminders.service.ts`, así no depende de
     Electron y se puede probar). El endpoint quedó sólo con la caché.
   - Cada número sale de un `COUNT`/`SUM` en la base (9 consultas chicas en
     paralelo) en vez de traer todos los autos con todos sus trabajos al proceso
     principal. Medido sobre copias de la base, haciéndola crecer:

     | trabajos  | nuevo (SQL) | anterior (memoria) |
     | --------- | ----------- | ------------------ |
     | 312 (hoy) | 3,7 ms      | 7,6 ms             |
     | 5.000     | 12,4 ms     | 114 ms             |
     | 20.000    | 59 ms       | 421 ms             |
     | 80.000    | 232 ms      | 1.817 ms           |

   - Las listas de "trabajos recientes" ahora **sí** son las más recientes
     (`ORDER BY updatedAt DESC LIMIT 6` en la base); antes eran los primeros seis
     que aparecían al recorrer los autos, sin ningún orden.
   - **Se conservaron todos los números exactamente igual**, validado con un
     script que corre las dos implementaciones sobre la misma base y compara
     campo por campo: sin diferencias en los 13 escalares ni en `monthlyRevenue`,
     tanto en la base de desarrollo como en la de producción ya migrada.
   - Detalle de implementación: los filtros por mes usan
     `strftime('%Y-%m', columna)` en vez de un `>=` contra un datetime, porque
     `job.createdAt/updatedAt` **no tiene un único formato** guardado (ver la
     tarea 30). Comparar la clave del mes es equivalente a lo que hacía el código
     anterior y además es inmune al formato.
   - **Resuelto después (decisión del usuario, 10/08/2026): el ingreso es lo
     entregado.** Completado significa que el trabajo terminó y está listo para
     entregar; el que se cobró de verdad es el entregado. Se cambió
     `revenueThisMonth` (antes sumaba los completados) **y** el gráfico de seis
     meses (antes sumaba completados + entregados), que medían cosas distintas.
     Ahora la tarjeta coincide con su propio subtítulo ("N trabajos entregados
     este mes") y con la barra del mes actual del gráfico —verificado como
     invariante—. En la base de desarrollo el número del mes pasa de $1.131.920 a
     $617.585.

9. **[hecho]** El listado de clientes trae todos los vehículos para mostrar un número
   - Archivos: `electron/DataBase/Endpoints/client.endpoints.ts`,
     `src/Types/types.ts` (documentación del tipo).
   - **La solución planificada no servía**: se había anotado resolverlo con un
     `COUNT` como columna calculada, pero la tabla no muestra sólo la cantidad —
     cuando el cliente tiene **un** vehículo muestra su patente. Así que se
     conserva la relación y lo que se recorta es **qué columnas viajan**:
     `leftJoin` + `addSelect(["cars.id", "cars.licensePlate"])` en lugar de
     `leftJoinAndSelect`, que traía todas las columnas de cada auto por IPC,
     incluido el historial de kilometraje completo.
   - Medido sobre una copia, una página de 8 clientes: **16.824 → 4.023 bytes
     (76% menos)** y 9,5 ms → 2,1 ms. Verificado que no cambia nada de lo que se
     muestra: mismo total, mismos clientes y orden, misma cantidad de vehículos
     por cliente y misma patente en el caso de un solo auto.
   - Se documentó en `Client.cars` que el listado devuelve los vehículos
     **parciales** (sólo `id` y patente) y la ficha los devuelve completos, para
     que nadie lea de ahí un campo que no viajó. (La ficha del cliente usa
     `client:find-by-name`, que no se tocó.)

10. **[hecho]** Índices que faltan para las consultas que ya existen
    - Archivos: `electron/DataBase/Migrations/AddJobStatusIndex1700000008000.ts`
      (nueva), `electron/DataBase/Entities/job.entity.ts`,
      `electron/DataBase/dataSource.ts`,
      `electron/DataBase/dashboardStats.service.ts`.
    - **El índice quedó compuesto `(status, updatedAt)`, no sólo `(status)`**:
      los listados de "trabajos recientes" son
      `WHERE status = ? ORDER BY updatedAt DESC LIMIT 6`, y con la segunda
      columna el índice ya entrega las filas ordenadas —SQLite corta a las seis
      en vez de ordenar todo el subconjunto del estado—. Medido sobre una copia
      inflada a 20.000 trabajos: 38,9 → 0,2 ms. Un índice de tres columnas
      `(status, updatedAt, id)` no mejoraba nada y ocupaba el doble (1.556 vs
      824 KB), así que se descartó.
    - **Hallazgo del camino: `COUNT(job.id)` era contraproducente.** El PK es un
      uuid, no el rowid de SQLite, así que nombrar la columna obliga a leer la
      fila: con el índice puesto, el conteo por estado empeoraba de 6,9 a 88 ms
      (20.000 lookups). Con `COUNT(*)` el índice alcanza solo y baja a 1,1 ms.
      Se cambiaron los cuatro conteos del dashboard (son equivalentes: el PK
      nunca es NULL).
    - **Segundo hallazgo: el orden de los "recientes" no era determinista.**
      `updatedAt` no es único y no había desempate, así que el orden lo decidía
      el plan de ejecución —y cambió al agregar el índice—. Se agregó
      `addOrderBy("job.id", "DESC")`: SQLite ordena sólo dentro de cada empate
      ("LAST TERM OF ORDER BY"), 0,21 → 0,26 ms.
    - Resumen de las mediciones (20.000 trabajos):

      | consulta                          | antes   | después |
      | --------------------------------- | ------- | ------- |
      | badge de trabajos activos         | 3,9 ms  | 0,5 ms  |
      | dashboard: conteo por estado      | 6,9 ms  | 1,1 ms  |
      | dashboard: cerrados del mes       | 6,6 ms  | 3,2 ms  |
      | dashboard: 6 recientes por estado | 38,9 ms | 0,2 ms  |

    - Verificado sobre copias de la base de desarrollo y de la de producción: la
      migración se registra y es idempotente, los planes de ejecución usan el
      índice, `integrity_check`/`foreign_key_check` siguen sanos y el dashboard
      devuelve exactamente los mismos datos (los listados de recientes, el mismo
      conjunto, ahora en orden determinista).
    - `job.carId` ya tenía su índice (`IDX_job_car`), `service_reminder` sus dos
      y `document(type, number)` el compuesto: no faltaba ninguno más.

11. **[hecho]** Revisar el paginado en dos pasos de TypeORM en el resto de los listados
    - Archivos: `electron/pagination.ts` (la regla),
      `electron/DataBase/Endpoints/car.crud.endpoints.ts`,
      `electron/DataBase/Endpoints/client.endpoints.ts`,
      `electron/DataBase/Endpoints/service.endpoints.ts`.
    - La regla quedó documentada arriba de `resolvePage()`, que es la función que
      llaman todos los listados: **joins `*-a-uno` → `offset/limit`; algún join
      `a-muchos` → `skip/take`**, con las dos trampas que ya se pagaron y su
      evidencia medida.
    - Se comprobaron las dos direcciones sobre una copia:
      - `offset/limit` en un listado con join a-muchos (`client.cars`) pidiendo 8
        clientes devuelve **4**, y al último de la página le faltan vehículos —el
        `total` sí sale bien, así que la interfaz mostraría "37 clientes"
        paginando de a 4—. Por eso `client:get-all` **conserva** `skip/take`.
      - `offset/limit` en un listado con joins `*-a-uno` (`car.owner`) devuelve
        exactamente lo mismo que `skip/take` en todas las páginas, con y sin
        filtros, y en una consulta menos. Por eso `car:get-all` **pasa** a
        `offset/limit`: de tres consultas por página a dos, y de paso deja de
        estar expuesto al `TypeError` si algún día se ordena por una expresión.
    - **Hallazgo del camino: ningún listado desempataba el orden.** `car:get-all`
      ordena por año, kilómetros o titular, y `service:list` por `dueDate`:
      columnas con repetidos. Se verificó recorriendo todas las páginas que hoy
      **no** hay repetidos ni faltantes, así que no era un bug activo, pero el
      orden entre iguales lo decidía el plan de ejecución —y en la tarea 10 ya se
      vio que un índice nuevo lo reacomoda—. Ahora los tres desempatan por una
      columna única y con sentido para quien mira la pantalla: patente en los
      vehículos, patente del vehículo en los recordatorios, nombre en los
      clientes.
    - Verificado: los cuatro órdenes de `car:get-all` en las dos direcciones y
      con filtros devuelven el mismo conjunto que antes, sin repetidos ni
      faltantes, y el mismo orden al repetir la lectura; el listado de clientes
      sigue trayendo las páginas completas con todos sus vehículos; los 113
      recordatorios se recorren enteros y los que vencen el mismo día quedan
      ordenados por patente.

Queda una tarea de este sprint sin hacer. Lleva el número **30** —fuera de la
numeración corrida— porque su lugar en el tiempo no es acá: reescribe datos de
producción, así que va **después de la tarea 13** (el snapshot previo a
migraciones), que es la red que le falta.

30. **[a testear]** Normalizar el formato de fecha guardado en `job.createdAt/updatedAt`
    - Archivos:
      `electron/DataBase/Migrations/NormalizeJobDates1700000009000.ts` (nueva),
      `electron/DataBase/dataSource.ts`.
    - La columna tenía **dos formatos conviviendo**: lo que escribe TypeORM
      (`2026-08-03 20:51:15.174`, hora local) y lo que dejó la migración
      `NormalizeJobs` al pasar los trabajos del JSON de `car.jobs`
      (`2026-03-26T20:45:17.611Z`, ISO en UTC).
    - La migración reescribe **sólo** las filas en el formato viejo, convirtiendo
      el instante de UTC a hora local. No cambia a qué momento apunta cada fecha,
      sólo cómo está escrita.
    - Detalle que evita un desastre: la condición incluye
      `strftime(...) IS NOT NULL`. Si el texto no se puede interpretar `strftime`
      devuelve NULL, y sin ese filtro la migración **vaciaría una columna
      `NOT NULL`**. Ante una fila rara es mejor dejarla como está.
    - También contempla ISO **sin** zona horaria: a esas sólo se les saca la `T`,
      porque convertirlas con `localtime` les restaría tres horas de más. No se
      vio ninguna, pero el caso existe.
    - `down()` es un no-op documentado: una vez unificado el formato no queda
      registro de qué filas venían en ISO, y para volver atrás está la copia
      previa que se saca antes de migrar.
    - Verificado sobre copias: en la base de **producción** la única fila en ISO
      pasa de `2026-03-26T20:45:17.611Z` a `2026-03-26 17:45:17.611` —**el mismo
      instante**, comprobado comparando `getTime()` antes y después— y el mes que
      ve SQL pasa a coincidir con el mes real, que era el error concreto. En la
      base de **desarrollo** (312 trabajos ya canónicos) no se toca ni una fila.
      Reabrir no vuelve a cambiar nada. Y en las filas raras inyectadas a
      propósito: una fecha ilegible se deja intacta en vez de vaciarse, y una ISO
      sin zona sólo pierde la `T`.
    - El `strftime` de la tarea 8 puede quedarse como está: sigue siendo la forma
      natural de agrupar por mes, y ahora además ya no es un parche.

---

## Sprint C — Empaquetado y resguardo de datos

Es la recomendación que quedó pendiente al descartar el multi-usuario (tarea 33
del plan anterior). El objetivo es que un imprevisto —corte de luz, disco lleno,
una migración a medio aplicar, el usuario moviendo un archivo— no se lleve los
datos del taller.

12. **[a testear]** Mover la base de `Documentos` a `userData`
    - Archivos: `electron/DataBase/dataLocation.ts` (nuevo),
      `electron/DataBase/dataSource.ts`.
    - **La base y los respaldos van ahora a carpetas distintas, a propósito.** La
      base viva a `userData` (`%APPDATA%/mecanica-dealbera`), que el usuario no ve
      ni sincroniza; los respaldos **siguen en `Documentos/backups`**, que es
      donde tienen que estar: son lo que hay que encontrar, copiar a un pendrive
      o mandar por correo. Para un archivo que se escribe una vez y se cierra, la
      sincronización de OneDrive deja de ser un riesgo y pasa a ser una ventaja.
    - El traslado usa **`VACUUM INTO`** y no `copyFileSync`, por el mismo motivo
      que la copia previa a las migraciones: el motor escribe una base nueva y
      consistente aunque hubiera un journal pendiente.
    - Orden pensado para no perder nada: primero se escribe la base nueva
      completa (a `.parcial`, después se renombra) y **sólo cuando está lista** se
      aparta la vieja como `taller.db.migrated`. Si el proceso muere en el medio,
      la vieja sigue en su lugar y el próximo arranque reintenta.
    - **Un fallo detiene el arranque.** Si no se pudo trasladar, arrancar igual
      crearía una base nueva y vacía en la ubicación nueva y el usuario vería su
      taller sin un solo vehículo. Mejor no abrir y decir dónde están los datos
      (el mensaje sugiere cerrar OneDrive, que es la causa más probable).
    - Verificado sobre copias, los siete escenarios: traslado de una base 1.0.3
      real (datos completos, vieja apartada y legible, sin `.parcial`);
      idempotencia; reaparición de una base con el nombre viejo (**no** pisa la
      que está en uso); instalación limpia; archivos auxiliares de SQLite;
      segunda vuelta con una apartada ya existente (usa marca de tiempo, no
      pisa); y base vieja ilegible (falla sin dejar una base nueva a medias).
    - Verificado además **sobre el paquete real**, dos arranques seguidos: el
      primero traslada, saca la copia previa, migra y verifica integridad; el
      segundo no hace nada. Documentos queda con `taller.db.migrated` y userData
      con `taller.db` más `backups/`. Los tres archivos —original, trasladada y
      apartada— tienen los mismos datos.
    - Se comprobó también que `userData` y `documents` resuelven a carpetas
      distintas (`%APPDATA%/mecanica-dealbera` y `C:/Users/<usuario>/Documents`).
    - Nota de implementación: `overrideDir()` e `isDev()` son declaraciones
      `function` y no constantes. `AppDataSource` se construye al cargar el
      módulo llamando a `getDBPath()`, que las usa: como `const` quedarían en la
      zona muerta temporal y el módulo reventaría al importarse, algo que
      TypeScript no marca.
    - Se agregó `MECANICA_LEGACY_DB`, hermana de `MECANICA_DATA_DIR`, para poder
      ejercitar el traslado completo dentro de la aplicación real sin tocar los
      Documentos de nadie. Es la operación más delicada del arranque; conviene
      poder probarla de verdad.

13. **[hecho]** Snapshot previo a migraciones + verificación de integridad
    - Archivos: `electron/DataBase/migrationSafety.ts` (nuevo),
      `electron/DataBase/dataSource.ts`, `electron/main.ts`,
      `electron/DataBase/Endpoints/backup.endpoints.ts`.
    - `migrationsRun: true` pasa a **`false`**: las migraciones ya no corren al
      conectar sino que las lanza `initializeDB` en tres pasos —copia previa con
      `VACUUM INTO`, migración, `integrity_check`—. La lógica vive en un módulo
      que recibe el `DataSource` y las rutas por parámetro (mismo patrón que
      `serviceReminders.service.ts`), así se puede ejercitar contra copias.
    - Decisiones que conviene tener presentes:
      - **Sin copia no se migra.** Si no se puede escribir la copia (disco lleno,
        permisos), la aplicación no arranca y avisa qué hacer. Dejar la base
        intacta es recuperable; una migración a medias sobre la única copia de
        los datos del taller, no.
      - **`integrity_check` sólo cuando hubo migraciones**: recorre el archivo
        entero, no tiene sentido pagarlo en cada arranque.
      - **`foreign_key_check` avisa pero no bloquea**: una referencia huérfana
        puede venir de datos viejos anteriores a la restricción, no es
        corrupción.
      - **Restaurar no reintenta**: la aplicación se cierra, porque volver a
        abrirla correría la misma migración fallida sobre los mismos datos. El
        cuadro lo dice explícitamente.
      - `VACUUM INTO` y no `copyFileSync`: el motor escribe una base nueva y
        consistente, no una foto de un archivo que puede estar a mitad de una
        escritura. Se escribe a `.parcial` y se renombra al final, así un corte
        no deja un archivo con nombre de copia buena y contenido incompleto.
    - Verificado sobre copias reales, incluido el camino de fallo:
      - Base de **producción** (1.0.3): se detectan las 8 pendientes, se saca la
        copia (40 KB), migran las 8, `integrity_check` correcto y sin huérfanos.
        La copia resulta ser del estado previo (sin tabla `job`, sin ninguna
        migración aplicada) y es una base SQLite válida y sana.
      - Base ya migrada: no hay pendientes y **no se saca copia**.
      - Migración que revienta a mitad (inyectada): se restaura y la base queda
        byte a byte igual a la copia, sin rastro de lo que la migración había
        alcanzado a hacer, sana y con sus 100 vehículos. La base rota se conserva
        al lado con sufijo `.rota-<marca>`.
      - Rotación: se conservan las 3 copias más recientes.
    - Detalle que apareció verificando: consultar si hay migraciones pendientes
      **crea la tabla `migrations`** vacía. Es inocuo (al restaurar, cero
      aplicadas = corren todas igual) y quedó documentado en el código.
    - También: TypeORM envuelve cada migración en una transacción, así que un
      fallo limpio ya revierte solo. La copia cubre lo que la transacción no:
      corte de luz, archivo corrupto, o una migración que "termina bien" pero
      deja los datos mal.
    - De paso se unificaron las **tres copias** de `getBackupDir()` (estaba
      duplicada en `main.ts` y en `backup.endpoints.ts`) en una sola en
      `dataSource.ts`, derivada de la ruta de la base. En producción resuelve a
      lo mismo de siempre (`Documentos/backups`); en desarrollo pasa a
      `data/backups`, así deja de escribir en los Documentos del usuario.
    - **Verificado también sobre el paquete real** (23/08/2026): se empaquetó con
      `electron-builder --dir` y se ejecutó en modo producción contra carpetas de
      datos descartables. Con base nueva loguea `Copia previa a las migraciones
creada`, `Migraciones aplicadas (8)` y `Verificación de integridad
correcta`; con base ya migrada no saca copia. Es la primera vez que este
      camino corre fuera de un script.
    - **Lo único no verificado**: el cuadro de diálogo que ofrece restaurar. Se
      puede provocar su lógica, pero verlo requiere abrirlo a mano.

14. **[a testear]** Respaldos: `VACUUM INTO` en vez de `copyFileSync` y retención por niveles
    - Archivos: `electron/DataBase/backups.ts` (nuevo), `electron/main.ts`,
      `electron/DataBase/Endpoints/backup.endpoints.ts`.
    - **La copia se hace con `VACUUM INTO` y se verifica antes de darla por
      buena.** Se escribe a un temporal, se abre, se le corre `integrity_check` y
      recién entonces se renombra. Un respaldo que no se puede verificar no es un
      respaldo: si falla, se descarta, en vez de dejar un archivo con nombre de
      copia buena que nadie va a mirar hasta que sea tarde.
    - El respaldo diario pasó a correr **después** de `initializeDB` (necesita la
      conexión abierta). Sigue siendo best-effort: si falla, se registra y la
      aplicación arranca igual.
    - **Retención por niveles**: se conserva el más reciente de cada uno de los
      últimos 7 días, 4 semanas ISO y 6 meses. Un mismo archivo cubre varios
      niveles a la vez, así que el total es menor que 7+4+6. Medido sobre un año
      de respaldos diarios: **14 archivos que cubren 129 días hacia atrás**,
      contra 7 archivos y 7 días del criterio anterior. Ése era el problema real:
      un dato borrado por accidente o una corrupción silenciosa se descubren
      tarde, y con 7 diarias los 7 que quedaban eran todos posteriores al daño.
    - La exportación manual (`backup:export`) también usa `VACUUM INTO`: es la
      copia que el usuario se lleva en un pendrive creyendo que tiene sus datos a
      salvo.
    - Verificado: retención sobre un año de diarios y sobre un calendario con
      huecos (la aplicación no se abre todos los días, y ahí no hay que quedarse
      sin copias viejas); copia real de la base de desarrollo con los 100
      vehículos completos e `integrity_check` correcto; el segundo respaldo del
      mismo día no rehace nada y al día siguiente sí; aplicar la retención dos
      veces no borra de más.

15. **[a testear]** Restaurar un respaldo desde la propia pantalla de Gestión de datos
    - Archivos: `electron/DataBase/Endpoints/backup.endpoints.ts`,
      `electron/preload.ts`, `global.d.ts`, `src/Types/apiTypes.ts`,
      `src/Pages/BackupPage.tsx`, `src/Components/CustomDialog.tsx`.
    - `backup:list` ya no devuelve nombres de archivo sino **fecha y tamaño**
      (tipo `BackupEntry`), y la tarjeta los muestra como "Sábado 6 de
      septiembre · 340 KB" con un botón **Restaurar** al lado. Nadie tiene que
      interpretar `taller_2026-09-06.db`.
    - Nuevo endpoint `backup:restore`. Recibe **sólo el nombre** y lo resuelve
      contra la carpeta de respaldos: si aceptara una ruta, el renderer podría
      pedir que se copie cualquier archivo del disco encima de la base.
    - La restauración y la importación comparten ahora `replaceDatabaseWith`,
      que además **verifica la integridad del archivo nuevo** y vuelve solo a la
      base anterior si no la pasa. Antes la importación aceptaba cualquier
      archivo `.db` sin comprobar nada.
    - Confirmación explícita antes de restaurar, diciendo de qué día es el
      respaldo y que lo cargado después se pierde. Se aclara que la base actual
      se guarda al lado, así que la operación se puede deshacer.
    - De paso, `CustomDialog` respeta los saltos de línea del texto
      (`whitespace-pre-line`): varios diálogos separan la acción de su
      advertencia en dos párrafos y quedaban pegados en un bloque.
    - **Falta probarlo a mano**: la lógica de listado está verificada, pero el
      circuito completo (click → confirmación → reemplazo → recarga) sólo se
      puede ver usando la aplicación.

Y una tarea que apareció verificando la 12, con el número **31** fuera de la
numeración corrida para no renumerar el resto.

31. **[a testear]** ⚠️ Si falla la pantalla de carga, la aplicación se cierra sola al arrancar
    - Archivo: `electron/main.ts`.
    - **Resuelto** con una bandera `isStartingUp` que arranca en `true` y se baja
      justo antes de crear la ventana principal. Mientras está levantada,
      `window-all-closed` no cierra la aplicación: durante el arranque "no quedan
      ventanas" significa "el splash se fue", no "el usuario terminó".
    - Verificado reproduciendo el escenario exacto: aplicación sin empaquetar en
      modo producción (donde `splash.html` no existe). Antes se cerraba sola en
      medio del arranque; ahora el splash falla, queda registrado, y la
      aplicación completa el traslado, la copia previa, las migraciones y la
      verificación de integridad, y sigue viva.
    - Secuencia: `showSplash()` abre el splash, y si `loadFile` falla se registra
      el aviso y se llama a `closeSplash()`. Pero eso puede pasar **mientras
      `initializeDB()` todavía está corriendo**, y en ese momento el splash es la
      **única ventana abierta**: al cerrarse dispara `window-all-closed`, que
      llama a `app.quit()`. La aplicación se cierra sin ventana y sin explicar
      nada, en medio del arranque.
    - Observado de verdad al ejecutar la aplicación sin empaquetar en modo
      producción (ahí `process.resourcesPath` apunta dentro de
      `node_modules/electron`, así que `splash.html` no existe). Empaquetada el
      archivo sí está, con lo cual hoy no se dispara — pero basta un
      `splash.html` que no se copie, un antivirus que lo bloquee o un arranque
      lento para que sí.
    - El splash es deliberadamente _best-effort_ (tarea 7): un fallo suyo no
      debería poder tumbar la aplicación, y hoy puede.
    - Solución: que `window-all-closed` no cierre la aplicación mientras el
      arranque está en curso —basta una bandera que se levante al terminar
      `createWindow`—, o no cerrar el splash ante un fallo de carga hasta que la
      ventana principal exista.
    - Esfuerzo: mínimo · Riesgo: bajo.

---

## Sprint D — Producto y UX

16. **[a testear]** Los tipos de service se reducen a un booleano
    - **Decisión del usuario (06/09/2026)**: de las dos salidas planteadas
      —definir intervalos por tipo, o reducir a un booleano— se eligió el
      booleano.
    - Archivos:
      `electron/DataBase/Migrations/SimplifyServiceType1700000011000.ts` (nueva),
      las entidades `job` y `service_reminder`, `car.dto.ts`,
      `serviceReminders.service.ts`, `car.jobs.endpoints.ts`,
      `service.endpoints.ts`, `src/Types/{apiTypes,types}.ts`, `AddJobForm`,
      `Jobs.tsx`, `JobsTable`, `NextServiceCard`, `EditReminderModal`,
      `ServiceAlertsPage`, `CreateServiceReminders1700000007000.ts`.
    - `job.serviceType` (enum de cinco) → **`job.isService`** (booleano).
      `service_reminder.type` **desaparece**: la invariante pasa de "un
      recordatorio vigente por vehículo **y tipo**" a "uno por vehículo".
    - El caso delicado de la migración: un vehículo podía tener **varios**
      vigentes, uno por tipo, y sin tipo serían duplicados. Se conserva el más
      urgente —el que vence antes; los que no tienen fecha van al final— y los
      demás se marcan como descartados **con el motivo en las notas**. Se
      descartan y no se borran: son historial, y borrar registros del usuario en
      una migración es justo lo que no hay que hacer.
    - La migración `CreateServiceReminders` dejó de importar el enum y usa el
      literal `"general"`: una migración describe el esquema **de su momento**,
      aunque el código de hoy ya no conozca esos valores. Si importara el enum,
      borrarlo rompería la historia.
    - En la interfaz, los tres desplegables de cinco opciones pasaron a un sí/no.
      El chip del tipo salió de la bandeja y el mensaje de WhatsApp dice "ya está
      para el service" en vez de interpolar el nombre del tipo.
    - Verificado sobre una copia con datos sembrados a propósito (64 trabajos con
      tipos variados y un vehículo con **dos** recordatorios vigentes): los 64
      quedan como service y el resto como trabajo común, el vehículo queda con
      **uno solo** vigente, **no se borra ningún registro** (132 antes y
      después), el descartado explica por qué, ningún vehículo queda con dos
      vigentes, integridad y claves foráneas limpias, y reabrir no cambia nada.

17. **[a testear]** Editar el próximo service desde la ficha del vehículo
    - Archivos: `src/Components/EditReminderModal.tsx` (nuevo),
      `src/Pages/Components/NextServiceCard.tsx`, `src/Pages/CarDetailPage.tsx`.
    - El endpoint `service:save` estaba implementado y expuesto desde que se armó
      el sistema de recordatorios, y **no lo usaba ninguna pantalla**: corregir
      una fecha o un kilometraje exigía entrar a la base. Ahora hay un modal.
    - Cada recordatorio del bloque "Próximo service" tiene un botón de editar; y
      cuando no hay ninguno vigente, el estado vacío ofrece **programar uno**
      (mismo modal, sin `id`, que es como el endpoint distingue crear de
      actualizar).
    - Detalles que evitan errores conocidos:
      - La fecha se manda como **mediodía local**: con medianoche, pasar a ISO
        corre el día para atrás en husos negativos como el nuestro.
      - Los campos se recargan en cada apertura; si no, editar dos
        recordatorios seguidos mostraba los datos del primero.
      - "Abierto" y "cuál se edita" son **dos** estados: `null` significa "crear
        uno nuevo", así que no puede significar además "cerrado".
      - Avisa si el kilometraje objetivo ya quedó atrás (el recordatorio va a
        aparecer vencido) en vez de dejar que el usuario lo descubra después.
    - La validación de verdad sigue en el backend —al menos fecha o km, fecha
      válida, km no negativo, un solo recordatorio vigente por tipo—; la del
      modal sólo evita el ida y vuelta de un error obvio.
    - **Falta probarlo a mano**: el circuito completo sólo se ve usando la
      aplicación.

18. **[a testear]** Historial de documentos emitidos
    - Archivos: `src/Components/DocumentHistory.tsx` (nuevo),
      `electron/DataBase/Endpoints/document.endpoints.ts`,
      `electron/preload.ts`, `global.d.ts`, `src/Types/apiTypes.ts`,
      `src/Pages/CarDetailPage.tsx`, `src/Pages/BackupPage.tsx`,
      `src/Components/DataCard.tsx`.
    - `document:list` estaba implementado desde que se agregó la numeración
      correlativa y **no lo consumía ninguna pantalla**: no había forma de ver
      qué se emitió ni de ubicar un número cuando el cliente lo menciona.
    - El endpoint pasó a recibir un objeto de filtros (`type`, `licensePlate`,
      `limit`) en vez de sólo el tipo, que era obligatorio: el historial de un
      vehículo necesita mezclar presupuestos y facturas.
    - Dos detalles del endpoint que importan:
      - Un `type` inválido devuelve **vacío**, no el historial completo: filtrar
        por algo que no existe no puede traer todo.
      - Se ordena por **fecha** y no por número. El correlativo es por tipo, así
        que al mezclar series ordenar por número intercalaría presupuestos y
        facturas sin sentido; se desempata por número, único dentro del tipo.
    - Dos vistas con el mismo componente: en la ficha del vehículo (sin la
      patente, que ya se sabe) y en Gestión de datos (con patente, todo el
      taller). Se refresca solo con el aviso de `data-changed`, porque emitir un
      documento invalida la caché del dashboard.
    - Se dice explícitamente en la interfaz que **el PDF no se puede volver a
      generar**: lo que se guarda es el registro (número, patente, titular,
      total), no los ítems. Reimprimir fiel exigiría guardarlos, y volver a
      emitir daría otro número, que es lo correcto.
    - `DataCard.action` pasó a ser opcional: esta tarjeta sólo informa, y un
      botón inventado sería peor que ninguno.

19. **[a testear]** Filtrar la bandeja por "ya avisado"
    - Archivos: `src/Types/apiTypes.ts`,
      `electron/DataBase/Endpoints/service.endpoints.ts`,
      `src/Pages/ServiceAlertsPage.tsx`.
    - Nuevo filtro "Aviso al cliente" con tres opciones: Todos / Sin avisar / Ya
      avisados. Se resuelve en la consulta, no en memoria.
    - No hizo falta ninguna columna nueva: "ya avisado" es exactamente "tiene
      `contactedAt`". El parámetro del endpoint es un booleano opcional y se
      compara contra `undefined`, porque `false` es un filtro válido —justamente
      el más útil: a quién falta avisarle—.
    - En la pantalla el filtro es una clave de texto y no un booleano, porque son
      **tres** estados contando "no filtrar" y `undefined` no sirve como
      `selectedKeys` de un Select.
    - Verificado sobre una copia marcando la mitad de los recordatorios como
      avisados: los dos subconjuntos suman el total (39 + 74 = 113), todos los
      "avisados" tienen fecha de contacto y ninguno de los "sin avisar" la tiene,
      y el paginado y el join con el vehículo siguen funcionando.

20. **[a testear]** Las notas internas nunca salen en el documento
    - Archivos:
      `electron/DataBase/Migrations/AddClientNoteToJob1700000010000.ts` (nueva),
      `electron/DataBase/Entities/job.entity.ts`,
      `electron/DataBase/Types/car.dto.ts`,
      `electron/DataBase/Endpoints/car.jobs.endpoints.ts`,
      `src/Types/{types,apiTypes}.ts`, `src/Components/Forms/AddJobForm.tsx`,
      `src/Utils/budgetPdf.ts`, `electron/DataBase/dataSource.ts`.
    - De las dos opciones planteadas se eligió el **campo aparte** y no un check
      sobre las notas internas. Reutilizar `notes` significaría que un descuido
      imprime algo escrito justamente para no mostrarlo ("el cliente regatea",
      "cobrar aparte"), y la decisión original de que las notas son internas
      sigue en pie.
    - Nueva columna `job.clientNote`, nullable: los trabajos que ya existen
      quedan sin observación, no hay backfill que inventar.
    - En el formulario es un `Textarea` propio, con acento visual distinto
      (`shadow-success`) y una descripción que dice explícitamente que **sí** se
      imprime, al lado del de notas internas que dice que no.
    - En el PDF va **dentro de la misma celda** que la descripción, en una línea
      nueva: como fila aparte rompería la grilla de la tabla y el cálculo de
      totales por columna.
    - Verificado sobre una copia: la columna se crea, las notas internas siguen
      intactas, los 312 trabajos existentes quedan con la observación en NULL,
      los dos campos conviven sin pisarse y la celda del documento incluye la
      observación **y no** la nota interna.

21. **[a testear]** Refresco de contadores por evento en vez de por navegación
    - Archivos: `electron/DataBase/dashboardCache.ts`, `electron/main.ts`,
      `electron/preload.ts`, `global.d.ts`, `src/Components/Header.tsx`,
      `src/Pages/HomePage.tsx`.
    - **La señal ya existía**: invalidar la caché del dashboard es exactamente
      "algo cambió en los datos", y esa llamada ya está puesta en cada mutación.
      En vez de agregar un aviso nuevo en cada endpoint —que alguien se iba a
      olvidar de poner— se enganchó ahí: `invalidateDashboardStatsCache()` avisa
      a sus listeners.
    - `dashboardCache.ts` sigue **sin importar Electron**: expone
      `onDashboardStatsInvalidated`, y quien conoce la ventana (`main.ts`) es
      quien manda el `data-changed` al renderer.
    - El Header y el dashboard escuchan ese canal. Los badges dejan de depender
      de `location.pathname`: cargar un trabajo o cerrar un service se ve al
      instante, sin moverse de la pantalla.
    - El preload devuelve la función para desuscribirse y los efectos la usan al
      desmontar. Sin eso cada montaje dejaba un listener colgado, y en desarrollo
      `StrictMode` monta dos veces — es el mismo error que ya se había pagado con
      los listeners del auto-updater.
    - Avisar es best-effort: si un listener falla, no puede hacer fallar la
      mutación que se acaba de guardar.

22. **[a testear]** Emitir un documento consolidado desde la ficha del cliente
    - Archivos: `src/Components/ClientDocumentButton.tsx` (nuevo),
      `src/Utils/budgetPdf.ts`, `src/Hooks/useBudgetPdf.ts`,
      `src/Components/DocumentModal.tsx`, `src/Pages/ClientDetailPage.tsx`,
      `src/Utils/budgetPdfConsolidated.test.ts` (nuevo).
    - Un cliente con dos autos en el taller recibía **dos** documentos, con dos
      números, y tenía que sumar a mano. Ahora la ficha del cliente tiene un
      botón que emite uno solo con los trabajos de todos sus vehículos.
    - Lo que hace que el consolidado tenga sentido es que **el bloque del titular
      no cambia**: es el mismo cliente. Lo que cambia es el resto: el recuadro
      de la patente lista todas (achicando la tipografía hasta que entren), la
      ficha del vehículo se reemplaza por el listado de autos, y la tabla de
      trabajos gana una **columna de patente** —sin eso, el cliente recibe una
      lista de trabajos indistinguibles—.
    - Se activa sólo con **más de un** vehículo: con uno solo el documento de
      cliente y el de vehículo son lo mismo, y conviene el formato conocido.
    - En el modal cada trabajo muestra su patente al lado, y sólo entran al
      documento los vehículos que aportan algún trabajo elegido: listar un auto
      sin trabajos sería ruido.
    - En el registro del documento la patente pasa a ser la lista de patentes.
      La columna es de texto, así que el historial sigue diciendo a qué autos
      corresponde sin inventar una tabla de relación para un caso de borde.
    - La emisión (numeración, descarga, descarte del número ante un fallo) quedó
      factorizada en un solo lugar: el consolidado y el de siempre comparten
      todo salvo qué se imprime.
    - **4 tests nuevos** sobre la tabla que realmente dibuja `jspdf-autotable`
      (`lastAutoTable`): que el consolidado tiene 6 columnas y que cada fila
      lleva la patente que le corresponde, que con un solo vehículo siguen
      siendo 5, que sin `vehicles` nada cambia, y que el total suma los trabajos
      de todos los autos.
    - **Falta la revisión visual**: se puede generar un PDF de muestra con
      `PDF_PREVIEW_DIR=<carpeta> npx vitest run src/Utils/pdfPreview.test.ts`.

---

## Sprint E — Calidad y automatización

23. **[a testear]** Tests de componentes y de base de datos
    - Archivos: `vitest.config.ts`, `src/test/setup.ts` (nuevo),
      `src/Pages/Components/ReminderActions.test.tsx` (nuevo),
      `src/Components/DocumentModal.test.tsx` (nuevo),
      `electron/DataBase/dashboardStats.test.ts` (nuevo).
    - Los tests pasaron de **102 a 122**, y ahora cubren las dos cosas que antes
      quedaban afuera: componentes con reglas de negocio y consultas contra la
      base.
    - **Dos entornos conviviendo en el mismo comando**: Node por defecto, y jsdom
      por archivo con `// @vitest-environment jsdom`. Global sería pagar el
      arranque del DOM en todos los tests que no lo necesitan. El `setup.ts`
      carga los matchers del DOM **de forma condicional**: con un import
      estático, `@testing-library/react` explota en los tests de Node al no
      encontrar `document`.
    - `ReminderActions` (5 tests): que la barra respete las reglas de
      `getReminderActions`. Es donde se rompió antes —la interfaz ofrecía
      posponer un service al día, y posponer no mueve el vencimiento, sólo lo
      escondía—. Al escribirlos se comprobó que el componente **deshabilita** las
      acciones en vez de ocultarlas, y el test fija ese invariante: ninguna se
      puede ejecutar sobre un recordatorio cerrado.
    - `DocumentModal` (5 tests): que un trabajo **entregado nunca aparezca**, que
      el presupuesto admita los tres estados abiertos y la factura sólo
      completados, que el aviso de excluidos se muestre y que el total sea el de
      lo seleccionado.
    - `computeDashboardStats` (6 tests) contra una base **SQLite real con las 10
      migraciones aplicadas** —en un archivo temporal y no en `:memory:`, así el
      esquema lo crean las migraciones y se prueban de paso—. Fija el criterio
      que se decidió y es fácil de revertir sin querer: **el ingreso es lo
      entregado, no lo completado**, y la tarjeta coincide con la barra del mes
      en el gráfico (la invariante que ya se rompió una vez).
    - Dependencias nuevas de desarrollo: `@testing-library/react`, `/dom`,
      `/user-event`, `/jest-dom` y `jsdom`.

24. **[a testear]** Verificación automática antes de publicar
    - Archivos: `package.json`, `.github/workflows/verify.yml` (nuevo).
    - Nuevo `npm run verify`, que encadena **tipos → lint → formato → tests →
      build del renderer** y corta en el primero que falle. Es exactamente lo que
      se venía corriendo a mano comando por comando.
    - Se agregaron `npm run typecheck` y `npm run build:renderer` como pasos
      nombrados: `npm run build` sigue siendo el que arma el instalador con
      electron-builder, que no tiene sentido correr en cada push.
    - Nuevo flujo de GitHub Actions que corre `verify` en cada push a `main`,
      `feat/**` y `fix/**`, y en los pull requests contra `main`. Corre en
      `windows-latest`, igual que el de release, porque `sqlite3` es un módulo
      nativo y conviene verificarlo en el sistema donde se usa.
    - El build del instalador **no** entra acá: es lento y ya lo hace
      `release.yml` en `main`.

25. **[a testear]** Diferir el stack de PDF
    - Archivos: `src/Utils/documentRules.ts` (nuevo), `src/Utils/budgetPdf.ts`,
      `src/Hooks/useBudgetPdf.ts`, `src/Components/DocumentModal.tsx`.
    - El `import()` dinámico solo no alcanzaba: `budgetPdf.ts` mezclaba el
      **dibujo** (jsPDF + autotable + la fuente embebida) con las **reglas
      puras** (`computeTotals`, `eligibleJobsForDocument`), y el modal necesita
      las reglas para armar la lista de trabajos elegibles. Cualquier import de
      ese módulo se llevaba el stack entero puesto.
    - Se separaron: `documentRules.ts` no importa jsPDF y es lo que usan las
      pantallas; `budgetPdf.ts` quedó sólo con el renderizado y reexporta las
      reglas para no romper el contrato de dominio (ni los tests).
    - El hook carga el renderizador y la fuente con `import()` **en el momento de
      emitir**, los dos en paralelo.
    - Resultado medido en el build: el stack de PDF quedó en su propio trozo de
      **437 kB** más **23 kB** de la fuente de patentes, que se descargan sólo al
      emitir un documento. El trozo de la ficha del vehículo —la pantalla más
      usada— queda en **76 kB**.

26. **[a testear]** Documentar las convenciones del proyecto en `CLAUDE.md`
    - Archivo: `CLAUDE.md` (nuevo).
    - Quedaron escritas las reglas que se aprendieron rompiendo cosas, que es el
      criterio para que algo entre: si no costó una sesión de depuración, no va.
    - Cubre: el dominio compartido que recibe el `EntityManager` por parámetro;
      que los thunks **resuelven** con `failed` y por eso existe `ensureSuccess`;
      la regla de paginado; `COUNT(*)` contra `COUNT(columna)`; `VACUUM INTO`
      contra `copyFileSync`; el filtro `IS NOT NULL` en las migraciones que
      reescriben datos; dónde vive cada cosa (base en `userData`, respaldos en
      Documentos); las escalas invertidas de HeroUI; que un contenedor que
      scrollea no puede maquetear; `PageShell`; la limpieza de suscripciones
      IPC; y las dos trampas del entorno (`ELECTRON_RUN_AS_NODE` y el `.npmrc`).
    - También el estilo acordado: comentarios y commits en español, explicando
      el problema antes que la solución, sin `Co-Authored-By`.

---

## Sprint F — Interfaz: observaciones de uso

Detectadas usando la aplicación (10/08/2026). La 27 es un **bug de flujo** y
conviene que entre antes del despliegue; las otras dos son de presentación.

27. **[a testear]** El vehículo preseleccionado no se ve si no está en la primera página
    - Archivos: `src/Pages/AddJobPage.tsx`, `src/Pages/Components/CarsList.tsx`.
    - Se hicieron las dos partes que se habían planificado, y se complementan:
      1. Al llegar con `state.license` desde la ficha del vehículo, **el buscador
         arranca precargado con esa patente**. La búsqueda ya es server-side, así
         que el vehículo queda en la primera página sin endpoints nuevos.
      2. **Resumen fijo del vehículo elegido** arriba del listado: patente,
         marca/modelo/año, titular y un botón para quitarlo. Se ve siempre, sin
         importar la página ni el filtro, así que también arregla el caso
         general de elegir un auto, paginar y perder de vista cuál era.
    - Para eso la página guarda el vehículo **entero** y no sólo la patente. Como
      desde la ficha sólo viaja la patente, los datos se completan en cuanto el
      auto aparece en el listado —que es justo lo que garantiza el buscador
      precargado—; hasta entonces el resumen muestra la patente sola en vez de
      no mostrar nada.

28. **[a testear]** Las tarjetas de vehículos no tienen el mismo tamaño
    - Archivos: `src/Pages/Components/CarCard.tsx`,
      `src/Pages/Components/CarsList.tsx`.
    - `max-w-fit` le ganaba a `w-full`, así que el ancho lo definía el contenido
      (el nombre del titular, los dígitos del kilometraje) en vez de la celda de
      la grilla. Ahora la tarjeta es `w-full h-full`, y la grilla pasó a `gap-2`
      con `items-stretch` para que además igualen la altura dentro de cada fila.

29. **[a testear]** Las tarjetas del dashboard quedan pegadas a la cabecera
    - Archivo: `src/Components/PageShell.tsx`.
    - El cuerpo pasa de `pt-0` a `pt-1` cuando hay cabecera. El contenedor
      recorta con `overflow-y-auto`, así que un hijo pegado al borde superior
      pierde su sombra: en el dashboard las `StatCard` arrancaban contra la
      cabecera y su `shadow shadow-primary` quedaba cortada. Beneficia a todas
      las pantallas con cabecera, no sólo al dashboard.

## Sprint G — Modernización

Arrancó el 06/09/2026, después de constatar que el proyecto tenía **31
vulnerabilidades (1 crítica, 22 altas)** y dependencias de hasta catorce majors
de atraso. Se hace por tandas, con su commit y su verificación sobre el paquete
real: un upgrade sin forma de verificarlo es una apuesta.

32. **[a testear]** Electron 30 → 44, con builder y updater al día
    - Electron 30 estaba **sin soporte** (mantienen tres majors), o sea sin
      parches de seguridad, en una aplicación que guarda los datos del taller.
      Ahí estaban la crítica y casi todas las altas: _ASAR Integrity Bypass_ en
      Electron, fuga de credenciales de `electron-updater` en redirecciones
      —justo la pieza del auto-update— y _symlink traversal_ en la cadena de
      empaquetado.
    - **El riesgo que se temía no apareció**: `sqlite3` usa N-API, estable entre
      versiones de Node y de Electron, así que el cambio de ABI no lo afecta y
      electron-builder lo recompiló sin intervención.
    - El target de TypeScript subió de ES2020 a ES2022. Compilaba de casualidad:
      los tipos de Node suplían métodos como `Array.at()` que la librería
      declarada no incluía, y al actualizar dejaron de suplirlos.
    - Verificado sobre el paquete real: traslada la base, copia previa, migra,
      verifica integridad, respaldo diario y la ventana carga sin errores.

33. **[a testear]** Dependencias dentro de los rangos declarados
    - De 16 vulnerabilidades a 2. Entre lo actualizado, `react-router`, que tenía
      una alta y es dependencia de la aplicación, no de las herramientas.
    - Los tests de componentes necesitaron un doble de `ResizeObserver`: jsdom no
      lo implementa y las Tabs de HeroUI lo usan para medirse, así que el
      componente reventaba al montarse y el test fallaba por una carencia del
      entorno.

34. **[a testear]** Vite 5 → 8 y los plugins de Electron
    - **Cero vulnerabilidades.** Y resuelve una incoherencia previa: vitest 4
      pedía vite ≥6 y había la 5. El build del renderer baja de 12 a 4,5 s.
    - **La trampa**: Vite 8 empaqueta con Rolldown y renombró
      `build.rollupOptions` a `build.rolldownOptions`. Con el nombre viejo la
      configuración se ignora **en silencio**: typeorm, sqlite3 y electron-log
      terminaron dentro del bundle (720 kB → 2,2 MB) y la aplicación dejó de
      arrancar con `__dirname is not defined in ES module scope`. Esos tres
      tienen que quedar afuera: sqlite3 es nativo y typeorm resuelve drivers con
      `require` dinámico.

35. **[a testear]** ESLint 8 → 10 y configuración plana
    - ESLint 9 dejó de leer `.eslintrc.*` y la 10 lo eliminó, así que migrar era
      obligatorio. Las reglas son las mismas; cambia cómo se declaran.
    - El plugin de hooks v7 trae las reglas del compilador de React y encontró
      **21 errores**. Se separaron por lo que son:
      - **Reales, arreglados**: mutar un ref durante el render en
        `useGlobalShortcuts` (React puede descartar y repetir un render, y el
        valor queda desincronizado con lo que se pintó), y tres errores
        relanzados sin `cause`, que perdían el motivo técnico.
      - **Informativos**: `watch()` de react-hook-form no se puede memoizar.
      - **17 × `set-state-in-effect`**: renders en cascada. Ver la tarea 36.

36. **[a testear]** Los 17 `setState` dentro de efectos: 9 migrados, 8 documentados
    - De los 17 que marcaba el compilador de React, **nueve eran correcciones
      de estado disfrazadas de efecto** y se migraron a estado derivado. Los
      **ocho restantes son efectos legítimos** —traen datos del proceso
      principal o se suscriben a sus avisos— y quedan silenciados en el lugar,
      cada uno con el motivo escrito. Con eso la regla **pasó a error**: ya no
      hay ruido que ignorar, así que una cascada nueva traba el lint.
    - **La página fuera de rango se acota al leer** (`clampPage`, con tests) en
      vehículos, clientes, recordatorios y la tabla de trabajos. El efecto viejo
      retrocedía **de a una página por vuelta**: estando en la 6 y filtrando a
      algo que deja 3 resultados encadenaba cinco consultas, repintando la tabla
      vacía en cada una. Ahora la respuesta que trae el total nuevo ya alcanza
      para ir a la última página buena.
    - **`useResetOn`** reemplaza al patrón "recargar los campos al abrir el
      modal": actualiza el estado durante el render —lo que documenta React—, y
      así el modal no pinta una vez con los datos del registro anterior antes de
      corregirse. Se usa en editar próximo service, emitir documento y el
      buscador global. Arranca con el token en `null` para que un componente
      montado ya abierto también prepare sus campos; sin ese detalle los tests
      de los dos modales fallaban.
    - En "registrar nuevo trabajo" se sacaron dos efectos: la patente que llega
      desde la ficha de un vehículo ahora es el valor inicial del estado, y los
      datos del vehículo elegido se resuelven del listado en curso con el que se
      guardó al elegirlo como respaldo.
    - El enfoque del campo en el buscador global **se queda en un efecto**, que
      es donde va: tocar el DOM es para lo que están. De paso se cancela el
      temporizador al desmontar.
    - Avisos de lint: de 28 a 11, sin errores.

37. **[a testear]** TypeORM 0.3 → 1.x, con cambio de driver
    - Se hizo en **dos tandas separadas a propósito** —driver primero, ORM
      después— para que fueran dos variables independientes: si algo se rompía,
      se sabía cuál de las dos.
    - **El driver no era opcional**: TypeORM 1.x eliminó `sqlite3`, sus peers
      sólo listan `better-sqlite3`.
    - **La versión del driver importa, y no es la que pide typeorm.** La 12
      descarga un binario atado al ABI de Node: dentro de Electron falla con
      `NODE_MODULE_VERSION 137` y habría que recompilarla en cada instalación
      para poder correr `npm run dev`. Se probó: la aplicación no abre la base.
      La 13 trae binarios **N-API** dentro del paquete, estables entre Node y
      Electron. Por eso el `legacy-peer-deps` **se queda**, ahora con un motivo
      mejor: typeorm declara hasta `^12` y usamos la 13 a conciencia.
    - Por lo mismo se desactivó `npmRebuild` en electron-builder: intentaba
      recompilar con node-gyp y hacía fallar el empaquetado en cualquier máquina
      sin toolchain de C++, para reconstruir algo que ya viene listo.
    - Antes de migrar se verificaron las tres operaciones de las que depende
      todo el resguardo: `VACUUM INTO ?` con parámetro, `VACUUM INTO` literal y
      `PRAGMA integrity_check`. Las tres andan igual.
    - Rupturas de TypeORM 1.x, las dos mecánicas: `relations` dejó de aceptar
      arrays de strings (18 sitios, pasados a la forma de objeto) y el paquete
      `uuid` dejó de venir como dependencia transitiva —se reemplazó por
      `randomUUID` de `node:crypto`, que hace lo mismo sin sumar nada—.
    - Verificado más allá de los tipos: un script contra una copia de la base
      real comprueba que las relaciones en forma de objeto carguen **lo mismo**
      que los arrays —titular, trabajos, vehículos del cliente con sus trabajos
      anidados, y el titular anidado del recordatorio— y que el listado paginado
      con join siga andando. Y sobre el paquete real: traslada, copia previa,
      once migraciones, integridad `ok` y respaldo diario.

38. **[a testear]** Cobertura de los componentes nuevos
    - Archivos: `src/Components/EditReminderModal.test.tsx` (nuevo),
      `src/Components/DocumentHistory.test.tsx` (nuevo).
    - De **122 a 137 tests**. Los dos componentes más nuevos con reglas propias
      no tenían ninguna cobertura, y son de los que están "a testear" sin que
      nadie los haya usado.
    - `EditReminderModal` (8): que no se pueda guardar sin fecha ni kilometraje,
      que **la fecha llegue al endpoint apuntando al día elegido** —es la trampa
      del mediodía local: con medianoche, pasar a ISO en un huso negativo corre
      el día para atrás—, que se pueda programar sólo por kilometraje, que avise
      si el objetivo ya quedó atrás, que rechace negativos, que conserve el `id`
      al editar y no lo mande al crear, y que **no cierre ni avise hacia arriba
      si el backend rechazó**.
    - `DocumentHistory` (7): que pase los filtros tal cual, que muestre número,
      titular y tipo, que la patente aparezca sólo cuando se pide, que **se
      vuelva a pedir con el aviso de datos cambiados**, que **se dé de baja al
      desmontarse** —eso ya se pagó una vez con los avisos duplicados del
      auto-updater— y que un fallo del IPC no rompa la pantalla.
    - Detalle del entorno: se afirma `toBeInTheDocument` y no `toBeVisible`. El
      modal de HeroUI se pinta en un portal con estilos de superposición que
      jsdom no resuelve, así que la visibilidad da falsos negativos.

39. **[hecho]** TypeScript 7: evaluado y descartado por ahora
    - Se probó de verdad. **Typechea el proyecto entero y limpio en 2,2
      segundos**, un salto grande frente al compilador actual.
    - Pero **`typescript-eslint` no soporta TS 7.0** y falla al arrancar:
      adoptarlo hoy es quedarse sin lint, o hacer malabares corriendo la API de
      TS 6 en paralelo. Y TS 6 sólo existe como `6.0.0-beta`, así que tampoco es
      salida.
    - Se volvió a 5.9. **Revisar cuando typescript-eslint soporte TS ≥ 7.1**
      (typescript-eslint#10940): es de las actualizaciones más rentables que
      quedan y no depende de nosotros.

40. **[a testear]** El instalador se arma, y publicar espera a la verificación
    - **Primera vez que el paquete NSIS se construye con este código.** Salió:
      163 MB, firmado, con su `blockmap` y su `latest.yml`, y `app-update.yml`
      dentro del paquete —el error que aparecía en los builds `--dir` era sólo
      de ese modo, que no genera ese archivo—.
    - **`release.yml` y `verify.yml` corrían en paralelo** ante un push a `main`,
      así que el instalador no esperaba el resultado de la verificación: un build
      roto se publicaba igual. Ahora la verificación es un job **dentro** de
      `release.yml` y el publicado declara `needs: verify`. `verify.yml` dejó de
      dispararse en `main` para no pagar dos veces lo mismo; sigue corriendo en
      `feat/**`, `fix/**` y en los pull requests.
    - **El nombre del artefacto: confirmado, no era un problema.** El archivo
      local se llama `Mecánica Dealbera-Windows-2.0.0-Setup.exe` y `latest.yml`
      apunta a `mecanica-dealbera-setup-2.0.0.exe` —el nombre "seguro" que
      electron-builder usa porque la URL no tolera acentos ni espacios—. En el
      release real los dos coinciden: electron-builder sube con ese mismo nombre
      seguro. Verificado además bajando el `.exe` publicado y comparando su
      sha512 contra el de `latest.yml`: idénticos.
    - **La versión ya subió a `2.0.0`.** El instalador se había armado como
      `1.0.3`, la misma que está instalada: publicado así ninguna aplicación
      habría visto la actualización. Va una mayor y no una menor porque entre
      1.0.3 y esto hay una migración de datos que no se deshace sola —la base se
      muda a `userData`, cambia el driver, cambia el esquema—: volver atrás no
      es reinstalar la anterior, es restaurar un respaldo.

41. **[a testear]** React 19, y las tres mayores de afuera de la interfaz
    - **React 18 → 19: sin cambios de código.** El proyecto ya usaba
      `createRoot` y no quedaba nada de lo que React 19 eliminó. Verificado
      arrancando la aplicación empaquetada contra una copia de la base real: el
      dashboard pinta completo —tarjetas, gráficos de recharts, el aviso de
      services— y el traslado de la base, las once migraciones, la verificación
      de integridad y el respaldo diario siguen andando.
    - **Vitest 4 → 5, framer-motion 12 → 13, class-validator 0.14 → 0.15.**
      Ninguna pidió cambios. `framer-motion` no se importa en ningún lado: viene
      sólo como peer de HeroUI. `class-validator` no tiene tests, así que se
      ejercitó a mano contra los DTO reales —mensajes propios, validación
      anidada del titular y el `@Transform` que pasa la patente a mayúsculas
      antes de comparar el formato—.
    - Con esto **no queda nada más actualizable** salvo los dos descartados con
      motivo: TypeScript 7 (tarea 39) y HeroUI 3 (abajo).

42. **[pendiente]** HeroUI 3: es otra librería, no una versión nueva
    - Se probó de verdad, instalándola con sus peers. **315 errores de tipos en
      los 47 archivos que la usan** —todos los que la usan—.
    - No son renombres mecánicos. Los componentes pasaron a importarse **por
      subruta** (`@heroui/react/button`), cambiaron de nombre (`Divider` →
      `separator`, `Progress` → `progress-bar`) y cambiaron las props más
      básicas: 39 usos de `label`, 39 de `color`, 27 de `content`, 10 de
      `onClose`, 9 de `isLoading` y 6 de `startContent` ya no existen. `Modal`
      perdió `ModalContent`, `Tooltip` perdió `content`, `Button` perdió `color`
      e `isLoading`.
    - Y hay componentes que **directamente no existen** en la 3: `Navbar`,
      `User` y `HeroUIProvider`. La cabecera habría que rehacerla a mano.
    - **No hay urgencia que lo justifique**: la 2.8 está mantenida, no tiene
      vulnerabilidades y ya funciona con React 19. Migrar es rehacer la interfaz
      entera contra una API nueva, sin poder mirar una sola pantalla mientras se
      hace, y con 30 tareas todavía marcadas "a testear". Si algo se rompiera no
      habría forma de saber si fue esto o cualquiera de las otras treinta.
    - **Cuándo hacerlo**: después de que alguien use la aplicación y baje el
      backlog de "a testear", y en una sesión con las pantallas a la vista.

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

### 2026-08-10 — Evaluación previa al despliegue

Se relevó el estado del entregable: **48 commits** en la rama (29/03 → 10/08) y
la versión sigue en `1.0.3`, igual que la instalada.

El riesgo principal era la actualización de la base: la versión publicada usa
**`synchronize: true` con `migrations: []`** y sólo las entidades `Car` y
`Client`, así que la base del taller no tiene tabla de migraciones y en el primer
arranque de la versión nueva corren **las 7 migraciones de una**. Se simuló ese
escenario sobre una **copia de la base de producción de este equipo**
(`Documents/taller.db`): las 7 migraciones se aplicaron en orden, los datos se
conservaron, el trabajo que vivía en el JSON de `car.jobs` quedó como fila de
`job`, el backfill generó los recordatorios, `integrity_check` devolvió `ok`,
`foreign_key_check` salió limpio y las entidades nuevas leen los datos. El camino
de actualización **está verificado** (`InitialSchema` usa
`CREATE TABLE IF NOT EXISTS`, así que sobre el esquema existente es un no-op).

Dos hallazgos de esa evaluación:

- **Divergencia dev/producción en `car.brand`**: en producción la columna tiene un
  `CHECK` con la lista de marcas (lo generó `synchronize` desde el `simple-enum`)
  que en desarrollo **no existe**, porque `InitialSchema` la crea como `varchar`
  simple. Hoy no hay riesgo (se compararon las dos listas: 104 marcas, idénticas),
  pero **agregar una marca nueva va a requerir una migración que reconstruya la
  tabla**, y en desarrollo el problema no se va a notar.
- **Volver atrás no es sólo reinstalar**: con `synchronize: true`, la 1.0.3 sobre
  una base ya migrada reconstruye la tabla `car` para que coincida con la entidad
  vieja (le devuelve `jobs` vacía y le saca `serviceIntervalMonths/Km`). Las
  tablas nuevas sobreviven huérfanas, así que los trabajos no se pierden, pero la
  app los muestra en cero. El rollback exige **reinstalar la 1.0.3 y restaurar el
  respaldo pre-migración**.

Lo que **no** está verificado: todas las rutas detrás de
`NODE_ENV !== "development"` (base en `Documentos`, respaldo automático,
notificación de arranque, splash desde `resourcesPath` y el auto-updater
completo) nunca se ejecutaron en estos cuatro meses y medio, y el paquete NSIS no
se armó ni una vez con este código.

Pasos acordados antes de publicar: copiar a mano `Documents/taller.db`, arreglar
la tarea 1 (el error del updater no llega a la interfaz, relevante justamente
para un release), subir la versión a `1.1.0`, armar el instalador y probarlo en
este equipo —que ya tiene una base con forma de producción— y recién después
publicar y probar el auto-update desde una 1.0.3 instalada. Pendiente, y es el
paso con mejor relación esfuerzo/certeza: correr la misma simulación sobre una
copia de la base **real del taller**, que es la única que tiene datos de meses.

Se agregaron además las tareas 27 a 29 (Sprint F) a partir de observaciones de
uso: el vehículo preseleccionado que no se ve al cargar un trabajo, el tamaño
desigual de las tarjetas de vehículos y las tarjetas del dashboard pegadas a la
cabecera.

### 2026-08-15 — Migración huérfana en la base de desarrollo

Al verificar la tarea 10 apareció que la tabla `migrations` de
`data/taller.db` tiene una fila **`AddSparePartsToCar1775272596631`** que no
existe en el repositorio (ni la migración ni ninguna columna `spareParts`):
sobra de una prueba abandonada. No rompe nada —TypeORM sólo mira qué migraciones
del código faltan en la tabla, y esa base es descartable— y **la de producción no
la tiene**. Queda anotado por si aparece una inconsistencia rara de esquema en
desarrollo: la solución es borrar la fila o regenerar la base.

Además, dato para dimensionar: la copia de producción de este equipo, ya migrada,
tiene **un solo trabajo** (72 vehículos, pero los trabajos recién empiezan a
cargarse con la versión nueva). Las optimizaciones del Sprint B no se van a notar
hoy en el taller; valen para cuando la tabla `job` crezca.

### 2026-08-16 — Pruebas de extremo a extremo: evaluadas y descartadas por ahora

Se evaluó agregar Playwright para probar el arranque y los cuadros de diálogo del
proceso principal (los que no puede tocar ningún test unitario). Se llegó a tener
el arnés armado y funcionando en lo suyo, pero **no se incorporó al repositorio**.

Lo que se aprendió, que vale más que la suite:

- **Los cuadros nativos no se pueden clickear desde Playwright.** `showMessageBox`
  abre una ventana del sistema operativo, fuera de Chromium. La técnica válida es
  sustituir `dialog` en el proceso principal desde un punto de entrada de prueba:
  permite verificar qué hace la aplicación con cada respuesta y qué texto muestra,
  pero **nunca** el aspecto visual. Eso siempre va a requerir abrirlo a mano una
  vez.
- **Por qué se descartó**: 545 líneas y una dependencia, para una suite que sólo
  rinde si algo la ejecuta sola. Si más adelante hace falta un chequeo automático
  antes de publicar, lo natural es un paso chico en `release.yml` que arranque el
  instalador y verifique que abre, no una suite.
- Quedó en el proyecto una sola cosa de todo eso: **`MECANICA_DATA_DIR`** en
  `getDBPath()`, que permite arrancar la aplicación contra una carpeta
  descartable. Sin eso, cualquier prueba de arranque escribe sobre la base real
  del usuario.
- También se agregó **`.npmrc`** con `legacy-peer-deps=true`: hoy cualquier
  `npm install` local falla con ERESOLVE porque `typeorm` declara `sqlite3@^5` y
  el proyecto usa el 6. El flujo de CI ya pasaba la bandera a mano; esto arregla
  el caso local.

### 2026-08-23 — Falsa alarma: "la aplicación no arranca"

Se abrió una tarea urgente dando por hecho que la aplicación no arrancaba —ni en
desarrollo ni empaquetada— por un `SyntaxError: The requested module 'electron'
does not provide an export named 'BrowserWindow'`. **Era un artefacto del entorno
desde el que se ejecutaban las pruebas, no un problema del proyecto**, y la tarea
se eliminó.

La causa: la variable **`ELECTRON_RUN_AS_NODE=1`**, que define el host de
extensiones de VS Code. Cualquier binario de Electron lanzado con esa variable
heredada corre como **Node puro**, y ahí el especificador `electron` resuelve al
paquete de npm —que exporta la ruta del binario, no la API—, así que todo import
nombrado falla. La aplicación estaba perfecta; el arranque estaba contaminado.

Queda anotado porque es una trampa cara: el error apunta al formato del módulo
(ESM contra CJS) y manda a investigar la configuración de Vite, el `type` del
`package.json` y la versión de Electron, que no tienen nada que ver. **Antes de
lanzar Electron desde cualquier script o herramienta, limpiar
`ELECTRON_RUN_AS_NODE`.**

Del episodio salió algo aprovechable: se empaquetó la aplicación con
`electron-builder --dir` y se la ejecutó en modo producción contra carpetas de
datos descartables, lo que **verificó la tarea 13 sobre el paquete real**. Con
base nueva registra `Copia previa a las migraciones creada` (12 KB), `Migraciones
aplicadas (8)` y `Verificación de integridad correcta`; con base ya migrada no
saca copia. Es la primera vez que el camino de producción se ejecuta desde que se
escribió.

### 2026-09-06 — Tanda completa: todo lo pendiente salvo una decisión

Se cerraron **13 tareas** en una sola sesión, con un commit por tarea. El plan
queda con **12 hechas**, **18 a testear** y **una sola pendiente**: la 16, que
no es trabajo sino una **decisión de negocio**.

Lo que se hizo, por orden:

- **31** — un fallo del splash ya no cierra la aplicación en medio del arranque.
- **14** — respaldos con `VACUUM INTO`, verificados, y retención por niveles: de
  7 archivos y 7 días de alcance a 14 archivos y 129 días.
- **15** — restaurar un respaldo desde la pantalla, con verificación de
  integridad del archivo entrante (que la importación tampoco hacía).
- **30** — formato de fecha unificado en `job.createdAt/updatedAt`.
- **27, 28, 29** — el vehículo preseleccionado que no se veía, las tarjetas de
  anchos distintos y las del dashboard con la sombra recortada.
- **24** — `npm run verify` y flujo de GitHub Actions en cada push.
- **19** — filtro por aviso al cliente en la bandeja.
- **25** — el stack de PDF (460 kB) se carga sólo al emitir; la ficha del
  vehículo baja a 76 kB.
- **21** — los contadores se refrescan cuando cambian los datos, no al navegar.
- **20** — observación para el cliente, en un campo aparte de las notas internas.
- **17** — editar el próximo service (endpoint que existía sin ninguna pantalla).
- **18** — historial de documentos emitidos (ídem).
- **22** — documento consolidado de todos los vehículos de un cliente.
- **23** — tests de componentes y de base: de 102 a 122.
- **26** — `CLAUDE.md` con las convenciones aprendidas rompiendo cosas.

**Todo esto está sin probar a mano.** Los 122 tests, los scripts de verificación
contra copias de la base y el empaquetado dicen que funciona a nivel código,
pero nadie usó la aplicación. Lo que más conviene mirar con la app abierta:

1. Restaurar un respaldo desde Gestión de datos (circuito destructivo).
2. Editar y programar el próximo service desde la ficha del vehículo.
3. Emitir un documento consolidado de un cliente con dos autos, y **mirar el
   PDF**: la maquetación del consolidado no se puede verificar con un test. Hay
   una vista previa con
   `PDF_PREVIEW_DIR=<carpeta> npx vitest run src/Utils/pdfPreview.test.ts`.
4. El primer arranque después de actualizar: traslada la base a `userData` y
   corre dos migraciones nuevas. Conviene copiar `Documents/taller.db` antes,
   aunque el traslado deje la vieja apartada como `taller.db.migrated`.

### 2026-09-06 — Modernización: de 31 vulnerabilidades a cero

Seis tandas, cada una con su commit y su verificación sobre el paquete real.

|                    | antes                    | ahora                         |
| ------------------ | ------------------------ | ----------------------------- |
| Vulnerabilidades   | 31 (1 crítica, 22 altas) | **0**                         |
| Electron           | 30.5.1 (sin soporte)     | 44.2.0                        |
| Vite               | 5.4                      | 8.2                           |
| ESLint             | 8 (EOL, `.eslintrc`)     | 10 (config plana)             |
| TypeORM            | 0.3 (driver `sqlite3`)   | 1.1 (driver `better-sqlite3`) |
| Tests              | 122                      | **137**                       |
| Build del renderer | 12 s                     | 4,5 s                         |

Cuatro cosas que costaron encontrar y conviene no volver a descubrir:

- **Vite 8 casi rompe la aplicación en silencio.** Empaqueta con Rolldown y
  renombró `build.rollupOptions` a `build.rolldownOptions`. Con el nombre viejo
  la configuración se ignora **sin avisar**: typeorm, sqlite3 y electron-log
  entraron al bundle (720 kB → 2,2 MB) y la aplicación dejó de arrancar con
  `__dirname is not defined in ES module scope`.
- **La versión del driver de la base importa más que el peer de typeorm.**
  `better-sqlite3@12` trae un binario atado al ABI de Node y dentro de Electron
  falla con `NODE_MODULE_VERSION 137`; la 13 trae binarios N-API. Se usa la 13 a
  conciencia, y por eso el `legacy-peer-deps` se queda.
- **`electron-builder` intentaba recompilar lo que ya venía listo**, y hacía
  fallar el empaquetado en cualquier máquina sin toolchain de C++. Se desactivó
  `npmRebuild`.
- **ESLint 10 encontró un bug real**: se mutaba un ref durante el render en
  `useGlobalShortcuts`. React puede descartar y repetir un render, y ahí el
  valor queda desincronizado con lo que se pintó.

Lo que **no** se hizo, a propósito: los 17 `setState` dentro de efectos (tarea 36) y React 19 + HeroUI 3 (tarea 40). Los dos tocan mucha pantalla y ninguno
arregla un bug; encima de un backlog que todavía nadie probó a mano, sumarían
riesgo sin comprar nada. Van cuando haya alguien mirando las pantallas.

### 2026-09-06 — Renders en cascada: nueve migrados, ocho documentados

La tarea 36 estaba anotada como "17 avisos, ninguno es bug". Revisándolos de a
uno resultó que **no eran todos la misma cosa**, y esa distinción es lo que hizo
que valiera la pena:

- **Nueve eran correcciones de estado disfrazadas de efecto** y se migraron.
- **Ocho son efectos legítimos**: traen datos del proceso principal o se
  suscriben a sus avisos. El aviso lo dispara el `setLoading(true)` sincrónico
  con el que arrancan, y sacarlo dejaría la pantalla mostrando el listado viejo
  mientras llega el nuevo.

De los nueve migrados, **uno era un problema de verdad y no sólo un olor**: la
corrección de "la página quedó fuera de rango" retrocedía **de a una página por
vuelta**. Estando en la página 6 y filtrando a algo que deja 3 resultados,
encadenaba cinco consultas —la 6 vacía, la 5 vacía, la 4 vacía…— y repintaba la
tabla vacía en cada una. Acotando al leer con `clampPage`, la respuesta que trae
el total nuevo ya alcanza para ir a la última página buena.

Con los ocho restantes silenciados en el lugar y con el motivo escrito, la regla
**pasó de aviso a error**: ya no hay ruido que ignorar, así que una cascada nueva
traba el lint en vez de sumarse a una lista que nadie mira.

Dos cosas para recordar:

- **Actualizar el estado durante el render no es un truco**: es lo que documenta
  React para preparar estado cuando cambia aquello de lo que depende. React
  descarta el render en curso y vuelve a empezar **sin llegar a pintar**. Pero
  sólo vale para el estado del propio componente: el `reset` de react-hook-form
  avisa a sus suscriptores, así que ése se queda en un efecto.
- **`useResetOn` arranca con el token en `null` a propósito.** Un componente que
  se monta con el modal ya abierto también tiene que preparar sus campos: el
  efecto que reemplaza corría al montar. Sin ese detalle los tests de los dos
  modales fallaban, que es exactamente para lo que se habían escrito.

Avisos de lint: de 28 a 11, sin errores. Tests: de 137 a 144.

Y la versión pasó a **2.0.0**. No es cosmética: entre 1.0.3 y esto la base se
muda de Documentos a `userData`, cambia el driver, cambia el esquema y Electron
saltó catorce mayores. Volver atrás no es reinstalar la anterior, es restaurar
un respaldo.

### 2026-09-06 — Lo que quedaba actualizable, y lo que no

Cuatro mayores más, cada una en su tanda: **React 19**, **Vitest 5**,
**framer-motion 13** y **class-validator 0.15**. Ninguna pidió cambios de
código. Después de esto `npm outdated` sólo lista dos paquetes, y los dos están
descartados con motivo escrito.

React 19 se verificó donde importa: arrancando la aplicación empaquetada contra
una copia de la base real. Traslada la base, saca la copia previa, corre las
once migraciones, verifica integridad, deja el respaldo diario y **pinta el
dashboard completo** —tarjetas, gráficos, aviso de services—. El único error del
log es el de la pantalla de carga, que no existe fuera del paquete: eso es la
tarea 31 haciendo su trabajo, un splash que falla ya no voltea el arranque.

**HeroUI 3 se probó y se descartó.** Es lo que más costó decidir, así que
conviene dejar el número: instalada con sus peers, deja **315 errores de tipos
en los 47 archivos que la usan**, o sea todos. No son renombres mecánicos —los
componentes se importan por subruta, cambiaron de nombre y perdieron las props
más básicas: 39 usos de `label`, 39 de `color`, 27 de `content`— y encima
`Navbar`, `User` y `HeroUIProvider` no existen más. Es rehacer la interfaz
entera contra una API nueva sin poder mirar una sola pantalla mientras se hace,
con 30 tareas todavía sin probar: si algo se rompiera, no habría forma de saber
si fue esto o cualquiera de las otras treinta. La 2.8 está mantenida, sin
vulnerabilidades y andando con React 19, así que no hay nada que fuerce la mano.

TypeScript 7 sigue igual que en la evaluación anterior: `typescript-eslint`
todavía declara `typescript <6.1.0`.

### 2026-09-06 — El primer release de la 2.0.0, y el susto del `latest.yml`

`feat/news` entró a `main` por fast-forward —105 commits, 177 archivos— y el
push disparó el flujo de publicación. **La verificación pasó y el publicado
falló**, pero de la peor manera posible: alcanzó a subir el instalador de 156 MB
y a publicar el release, y recién ahí se cayó. Quedó un **v2.0.0 público con el
`.exe` pero sin `latest.yml` ni `.blockmap`**.

Eso es exactamente el modo de falla silencioso que se venía anotando: el release
se ve perfecto en GitHub y **ninguna aplicación instalada se entera de que hay
una versión nueva**, porque el updater lo primero que busca es `latest.yml`. Se
comprobó corriendo el paquete: `Cannot find latest.yml in the latest release
artifacts (…/v2.0.0/latest.yml): HttpError: 404`. La aplicación lo registra y
sigue andando —el manejo de errores del updater hace su trabajo—, pero se queda
en la versión vieja para siempre.

Volver a publicar lo arregló: electron-builder reemplaza los assets que ya
existen, así que el segundo intento dejó los tres archivos consistentes entre
sí. **No alcanza con ver que estén los tres**: lo que rompe el auto-update en
silencio es que el sha512 de `latest.yml` no corresponda al `.exe` que está
publicado, cosa perfectamente posible si cada archivo viene de un build
distinto. Se verificó bajando el `.exe` publicado y calculándole el sha512:
coincide con el de `latest.yml`. Y corriendo el paquete otra vez, el updater ya
responde `latest version: 2.0.0` en vez del 404.

**Cómo revisar esto en el próximo release**, en ese orden:

1. Que el release tenga **tres** assets, no uno.
2. Que el `size` de `latest.yml` coincida con el del `.exe` publicado.
3. Que el **sha512** coincida. Es el único que falla en silencio.

De paso quedó confirmado lo que estaba anotado como duda en la tarea 40: el
nombre "seguro" (`mecanica-dealbera-setup-2.0.0.exe`) es el mismo con el que
electron-builder sube el artefacto, así que la diferencia con el nombre local
—con acento y espacios— nunca fue un problema.

Y se cerró la puerta por la que había entrado el problema: **`release.yml`
republicaba en cada push a `main`**. Se comprobó sin querer, con un commit de
documentación que rearmó el instalador entero y reemplazó los tres assets de un
release que ya estaba bien —sha512 nuevo incluido—. Cada una de esas vueltas es
otra oportunidad de quedar a mitad de camino, y a cambio de nada.

Ahora la versión de `package.json` es la que manda: si ya existe el release de
esa versión, no se rearma nada. Para publicar hay que subir la versión. Y cuando
sí publica, un paso nuevo **baja el instalador publicado y le compara el sha512
contra `latest.yml`**: si no coinciden, el flujo falla en vez de dejar un release
roto que se ve bien.

También se arregló algo que apareció mirando el historial de ejecuciones: con un
pull request abierto, cada push corría la verificación **dos veces**, una por el
evento `push` y otra por el `pull_request`. Lo resuelve un grupo de concurrencia
con `head_ref || ref_name`.

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
