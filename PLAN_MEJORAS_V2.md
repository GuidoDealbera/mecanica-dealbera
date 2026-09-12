# Plan de mejoras v2 — revisión completa del proyecto

Segunda pasada, hecha sobre el código en `2.0.0` (commit `6897f50`), después de
cerrar el [plan v1](PLAN_MEJORAS.md). Ese plan nació de una lista de mejoras
pedidas; **este nace de leer el proyecto entero buscando qué está mal**.

Se revisaron los 45 archivos de `electron/` y los 15.000 renglones de `src/`, y
donde había una duda se comprobó contra la base en vez de suponer.

## Cómo leer esto

Cada tarea tiene un **identificador fijo** (`A1`, `B2`, …) y no un número de
lista. Es a propósito: Prettier renumera las listas ordenadas de Markdown al
formatear, y en el plan v1 eso corrió los números y provocó una tarea duplicada
y una edición fallida. Con identificadores el orden puede cambiar sin que se
rompa ninguna referencia.

Estados: `pendiente` · `en progreso` · `a testear` · `hecho`

Cada tarea dice **qué pasa**, **por qué importa** (con el escenario concreto en
el que muerde) y **dónde**. Las que no tienen un escenario de fallo concreto
están en los sprints de más abajo, que son de calidad y no de corrección.

**Severidad**:

- 🔴 **Rompe o puede romper datos**, o deja al usuario con información falsa.
- 🟠 **Comportamiento inesperado** que el usuario va a notar.
- 🟡 **Deuda real**: hoy no muerde, pero es la causa raíz de la próxima tanda.
- ⚪ **Pulido**: profesionalismo, consistencia, mantenibilidad.

## Resumen

| Sprint                               | Tareas | 🔴  | 🟠  | 🟡  | ⚪  |
| ------------------------------------ | ------ | --- | --- | --- | --- |
| A — Bugs confirmados                 | 12     | 7   | 4   | 0   | 1   |
| B — Validación que existe y no corre | 7      | 3   | 3   | 1   | 0   |
| C — Seguridad y endurecimiento       | 7      | 1   | 0   | 5   | 1   |
| D — Integridad de datos              | 6      | 2   | 3   | 1   | 0   |
| E — Errores no atajados              | 8      | 1   | 4   | 3   | 0   |
| F — Consistencia del contrato        | 9      | 0   | 3   | 4   | 2   |
| G — Rendimiento                      | 7      | 0   | 1   | 4   | 2   |
| H — Huecos de producto               | 8      | 0   | 5   | 2   | 1   |
| I — Interfaz y accesibilidad         | 6      | 0   | 2   | 2   | 2   |
| J — Tests                            | 7      | 0   | 0   | 5   | 2   |
| K — Empaquetado y mantenimiento      | 7      | 0   | 1   | 4   | 2   |
| **Total**                            | **84** | 14  | 26  | 31  | 13  |

---

## Sprint A — Bugs confirmados

Cosas que están mal hoy, con el escenario concreto en el que muerden.

### A1 · 🔴 Restaurar un respaldo viejo deja la aplicación contra un esquema que no entiende

**[a testear]** · `electron/DataBase/Endpoints/backup.endpoints.ts` →
`replaceDatabaseWith`

Restaurar o importar copia el archivo encima de la base y hace
`AppDataSource.initialize()`. Pero el `DataSource` declara `migrationsRun: false`
—las migraciones sólo las lanza `initializeDB` en el arranque—, así que **la base
restaurada nunca se migra**.

Escenario: se restaura un respaldo de marzo (esquema de la 1.0.3) desde la 2.0.0.
La base entra sin la tabla `service_reminder`, sin `document`, sin
`job.clientNote`, y con `job.serviceType` en vez de `isService`. La aplicación
sigue abierta y **cada pantalla que toque esas columnas revienta**.

`checkDatabaseHealth` no lo detecta, y no es su culpa: `integrity_check` mira la
estructura del archivo, no si el esquema es el que la aplicación espera. Una base
vieja está perfectamente sana.

Solución: después de reemplazar, correr el mismo camino que el arranque —copia
previa, migraciones pendientes, verificación—. Si no se puede migrar, volver a la
base anterior; el mecanismo de `_pre_import_` ya está escrito.

**Resuelto.** El núcleo "migrar y verificar" se extrajo a `applyPendingMigrations`
—exportado desde `dataSource.ts`— y ahora lo usan los dos caminos: el arranque
(que le agrega la copia previa y el ofrecimiento de restaurar) y la restauración
(cuya red es la base que se acaba de apartar). El mensaje avisa cuántos cambios se
aplicaron: el respaldo ya no es idéntico a lo que quedó restaurado.

De paso se cerró el caso inverso, que era el mismo agujero al revés: una base
escrita por una versión **posterior** no tiene migraciones pendientes —para este
código no las hay— así que pasaba el control igual. `findUnknownMigrations` la
detecta y la aplicación no la toca.

Dos cosas que sólo aparecieron probándolo de verdad:

- **`constructor.name` no sirve para identificar una migración.** El bundle del
  proceso principal va minificado, así que ahí el nombre de la clase es una
  letra: la primera versión daba por desconocidas a las once migraciones propias
  y la aplicación no arrancaba. Va por la propiedad `name` que cada migración
  declara, que es lo que usa TypeORM por el mismo motivo. Hay un test que fija la
  causa —que todas la declaren—, porque el síntoma no se reproduce sin minificar.
- **La base real de la 1.0.3 ya tenía dos migraciones anotadas**
  (`InitialSchema` y `AddPartsToExistingJobs`), así que al ponerla al día corren
  nueve y no once. La afirmación de que la 1.0.3 no tenía ninguna migración, en la
  descripción original de esta tarea, estaba equivocada.

Cubierto por `electron/DataBase/applyPendingMigrations.test.ts` (4 casos) y
`electron/DataBase/Endpoints/backupRestore.test.ts` (3 casos, sobre el handler
real: respaldo viejo, archivo que no es una base —con la vuelta atrás— y respaldo
inexistente). Se comprobó que el test falla si se saca la corrección.

### A2 · 🔴 `service:save` no invalida la caché del dashboard

**[a testear]** · `electron/DataBase/Endpoints/service.endpoints.ts`

`snooze`, `dismiss`, `reactivate`, `complete` y `settings-set` llaman a
`invalidateDashboardStatsCache()`. **`service:save` no.**

Escenario: se corrige a mano la fecha del próximo service de un vehículo para que
venza mañana. El recordatorio cambia, pero el badge de la barra y el dashboard
siguen mostrando el conteo viejo hasta que otra cosa invalide la caché. Es
información incorrecta en la pantalla principal, que es exactamente lo que una
caché no puede permitirse.

**Resuelto.** El test no espía la llamada sino la señal que sale de ella
(`onDashboardStatsInvalidated`), que es la misma por la que el proceso principal
manda `data-changed` al renderer: lo que importa no es que se invoque una
función, es que el contador de la barra se entere.

### A3 · 🔴 `service:save` puede dejar dos recordatorios vigentes en el mismo vehículo

**[a testear]** · `electron/DataBase/Endpoints/service.endpoints.ts`

La invariante del sistema es **un solo recordatorio vigente por vehículo**, y el
endpoint la cuida sólo en la rama sin `id`: si no se pasa uno, reutiliza el
vigente. Pero con `body.id` toma ese recordatorio **sea cual sea su estado** y lo
pone en `pending` sin comprobar que no haya otro activo.

Escenario: se completa un service (el viejo pasa a `done`, se genera uno nuevo
`pending`) y después se edita el viejo desde el historial. Quedan dos vigentes: el
vehículo aparece duplicado en la bandeja y se cuenta dos veces en el badge.

Que esto ya pasó está documentado: la migración `SimplifyServiceType` tuvo que
**colapsar los múltiples recordatorios activos por vehículo** que había en la base
real.

`service:reactivate` sí hace la comprobación con `findActiveReminder`; `save`
tiene que hacer la misma.

**Resuelto junto con A4**: los dos eran el mismo hueco —tomar el recordatorio del
`id` sin mirar nada más— así que se cerró con un solo bloque de tres controles.

### A4 · 🔴 `service:save` puede mover un recordatorio de un vehículo a otro

**[a testear]** · `electron/DataBase/Endpoints/service.endpoints.ts`

El endpoint busca el recordatorio por `body.id` y después hace
`reminder.car = car`, donde `car` sale de `body.licensePlate`. **No comprueba que
el recordatorio pertenezca a ese vehículo.** Un `id` equivocado —o una pantalla
con datos viejos— lo reasigna en silencio a otro auto.

**Resuelto junto con A3.** Escribiendo los controles apareció un tercer caso que
no estaba anotado: si el `id` **ya no existe**, el código caía en el `create` de
más abajo y **creaba un recordatorio nuevo** sin decir nada. Ahora falla y lo
explica.

### A5 · 🔴 Un teléfono repetido revienta con el error crudo de SQLite

**[a testear]** · `electron/DataBase/Endpoints/client.endpoints.ts`

`Client.phone` es `unique` en la base. `client:create` comprueba el **nombre**
duplicado y devuelve un mensaje claro, pero **no comprueba el teléfono**;
`client:update` no comprueba ninguno de los dos al cambiarlo.

Escenario: se carga un cliente con un teléfono que ya tiene otro. `repo.save()`
lanza `SQLITE_CONSTRAINT: UNIQUE constraint failed: client.phone`, `handleIpc` lo
relanza y el usuario ve ese texto —o un "Error inesperado"— en vez de "el teléfono
ya está registrado a nombre de X".

Lo llamativo es que **el mensaje bueno ya existe**: `car:create` y
`car:reassign-owner` sí hacen esa comprobación. Es la misma regla escrita dos
veces y faltando en un tercer lugar.

**Resuelto, y de paso F4.** En vez de escribir la tercera y la cuarta copia, la
regla se mudó a `clients.service.ts` (`findClientConflict`) y ahora la usan los
cuatro caminos. Recibe el `EntityManager` por parámetro, como el resto del
dominio, así que funciona igual dentro de las transacciones de `car:create` y
`car:reassign-owner`.

Detalle que apareció escribiendo el test: `@IsPhoneNumber("AR")` es estricto y
rechaza números inventados como `3510000001`. Los datos de prueba usan números
con formato válido de verdad.

### A6 · 🔴 `car:create` descarta en silencio los datos del titular recién cargados

**[a testear]** · `electron/DataBase/Endpoints/car.crud.endpoints.ts`

Al registrar un vehículo, si ya existe un cliente **con el mismo nombre**, se
reutiliza ese cliente y **se ignoran el teléfono, la dirección, la localidad y el
correo que el usuario acaba de escribir**. Sin avisar: el mensaje es "Vehículo
registrado correctamente".

Escenario: llega un cliente que se llama igual que uno viejo. Su vehículo queda a
nombre del otro, con el teléfono del otro. Cuando haya que llamarlo por el
recordatorio de service, se llama a la persona equivocada.

Y si es la misma persona pero cambió de teléfono, el dato nuevo se pierde igual.

Mínimo: avisar que se va a asociar a un cliente existente y mostrar sus datos para
que el usuario confirme. Ver también **D5**.

**Resuelto sin tocar la interfaz.** Se compara lo cargado contra el cliente que ya
existe con ese nombre: si coincide, el vehículo se le asocia como siempre; si
difiere, se frena y el mensaje dice **qué campo** no coincide y qué hacer —si es
la misma persona, actualizarla desde Clientes; si es otra, usar un nombre que las
distinga—.

El flujo normal no se ve afectado, y eso está probado: el autocompletar del
formulario rellena los datos del cliente elegido, así que llegan idénticos. Y un
campo que el usuario dejó en blanco no cuenta como diferencia: no retipearlo no es
pedir que se borre.

### A7 · 🔴 La búsqueda global trata los comodines de `LIKE` como comodines

**[a testear]** · `electron/DataBase/Endpoints/car.search.endpoints.ts`

`global:search` arma su patrón **sin escapar** `%` ni `_`, cuando el proyecto
tiene un helper (`escapeLike`) escrito justamente para eso y usado en todos los
demás listados.

Escenario: buscar `_` devuelve todo. Una patente parcial con guión bajo devuelve
resultados que no corresponden. No es explotable —la consulta está parametrizada,
no hay inyección— pero los resultados son incorrectos.

De paso, `client:search` **reimplementa** el escape a mano en vez de usar
`escapeLike`, que hace exactamente eso.

**Resuelto, y con él F5.** `global:search` pasó de `Like()` —que no admite
cláusula `ESCAPE`— a un query builder con `escapeLike`, igual que el resto de los
listados, y `client:search` usa el helper en vez de su copia. Los dos ignoran
ahora un término que no sea texto, que era una vía de caída
(`query.replace` sobre `undefined`).

Se comprobó que los tests fallan si se saca el escape.

### A8 · ⚪ `useFormGuard` nunca resetea el bloqueador de navegación

**[a testear]** · `src/Hooks/useFormGuard.ts`

`useBlocker` de React Router deja el bloqueador en estado `blocked` hasta que se
llame a `proceed()` o a `reset()`. `confirmNavigation` llama a `proceed()`, pero
**`cancelNavigation` sólo cierra el modal**: nunca llama a `blocker.reset()`.

**El síntoma que decía esta tarea no existe, y estaba mal anotado acá.** Yo
había escrito que el siguiente intento de salir podía no volver a preguntar. Se
probó y no pasa: React Router evalúa el bloqueador otra vez en cada navegación y
la vuelve a frenar. Midiendo los estados por los que pasa sin el `reset`, la
secuencia es `unblocked → blocked → blocked`, y la pantalla no se abandona
ninguna de las dos veces.

Así que baja de 🟠 a ⚪: el `reset()` **se agregó igual** —es el uso que documenta
la API, deja `blocker.state` diciendo la verdad y suelta los `proceed`/`reset`
viejos— pero no arregla nada que el usuario pudiera ver.

Lo que sí quedó de valor es la cobertura: el guard no tenía ninguna, y ahora hay
tres casos sobre el ciclo completo (preguntar, quedarse y volver a intentar,
confirmar y salir).

### A9 · 🟠 Cerrar la aplicación con cambios sin guardar no avisa nada

**[a testear]** · `src/Hooks/useFormGuard.ts`, `electron/main.ts`

El guard sólo intercepta navegaciones de React Router. **Cerrar la ventana no está
cubierto**: se pierde el formulario sin una palabra. Hace falta atender el `close`
de la ventana principal y preguntar.

**Resuelto.** `useFormGuard` —que ya es el único lugar que sabe si el formulario
está sucio— le avisa al proceso principal por un canal nuevo, y el proceso
principal atiende el `close` de la ventana y pregunta antes de cerrar. El aviso se
retira al desmontar: una pantalla que ya no está no tiene cambios sin guardar, y
sin eso la aplicación quedaría preguntando para siempre. También se limpia en
`did-finish-load`, porque al recargar el renderer arranca de cero.

Detalles que aparecieron probándolo contra la aplicación real:

- **El cuadro va en su variante sincrónica.** `close` no espera promesas: con la
  asíncrona la ventana se cierra igual mientras el cuadro se dibuja.
- **`window.close()` desde el renderer no pasa por `BrowserWindow.on("close")`.**
  Se descubrió porque la primera prueba —hecha justamente con eso— cerraba la
  aplicación sin disparar el guard. Los caminos reales (la X, Alt+F4, `app.quit`)
  sí pasan, y se verificó que ahí el guard frena el cierre y muestra el cuadro.
  Ningún archivo del renderer llama a `window.close()`, así que no hay una vía de
  escape; queda anotado por si alguien la agrega.

### A10 · 🟠 Los hooks devuelven el `Error` donde el llamador espera la respuesta del backend

**[a testear]** · `src/Hooks/useCarQueries.ts`

Varios `catch` hacen `return error`, y los llamadores hacen
`if (response.status === "success")`. Un `Error` no tiene `status`, así que da
`undefined`: hoy **funciona de casualidad**, porque `undefined` es falsy y se
interpreta como fallo.

El archivo además arranca con un `eslint-disable` de `no-explicit-any` y tiene
seis `catch (error: any)`: si lo que se lanza no es un `Error`, `error.message` es
`undefined` y el toast sale vacío.

**Resuelto.** Dos helpers nuevos en `src/Utils/apiResponse.ts`, que es donde ya
vive `ensureSuccess`: `errorMessage` saca un texto legible de lo que sea que se
haya lanzado, y `failureFrom` arma una respuesta con la forma del backend. Los
seis `catch` pasaron a `unknown` y el `eslint-disable` del archivo se fue.

Los tres que no devolvían nada útil —`getCars`, `refresh` y `refreshCar`, cuyos
llamadores ignoran el retorno— dejaron de devolver el error: devolverlo sólo
servía para confundir sobre el contrato.

### A11 · 🟠 Las notificaciones de Windows no declaran la identidad de la aplicación

**[pendiente]** · `electron/main.ts`

No se llama a `app.setAppUserModelId("com.dealbera.mecanica")`. En Windows, sin
eso las notificaciones nativas pueden no mostrarse, o mostrarse atribuidas a
`electron.app.…` en vez de a Mecánica Dealbera.

Es justo la notificación de arranque de "N vehículos requieren service", que es la
única que la aplicación manda.

### A12 · 🟠 La segunda instancia sigue arrancando después de pedir el cierre

**[pendiente]** · `electron/main.ts`

`app.quit()` no interrumpe la ejecución del módulo: si no se obtuvo el lock, se
siguen registrando `whenReady`, los handlers de IPC y el resto. En la práctica
Electron termina cerrando antes, pero es una carrera contra un arranque que
**abriría la misma base**. Corresponde salir de verdad y no seguir ejecutando.

---

## Sprint B — Validación: la que existe y no se ejecuta

Este sprint sale de un hallazgo que conviene leer entero antes que las tareas
sueltas.

El proyecto tiene **seis clases DTO** con decoradores de `class-validator`, un
helper (`validateDto`) que las aplica bien —con `whitelist: true`, mensajes en
castellano y validación anidada— y **sólo tres se usan**:

| DTO               | ¿Se valida?  | Dónde                                   |
| ----------------- | ------------ | --------------------------------------- |
| `CreateCarDto`    | ✅           | `car:create`                            |
| `CreateClientDto` | ✅           | `client:create`                         |
| `UpdateClientDto` | ✅           | `client:update`                         |
| `UpdateJobDto`    | ❌ **nunca** | definido y no usado en `car:update-job` |
| `UpdateCarDto`    | ❌ **nunca** | definido y no usado en ningún lado      |
| `JobsDto`         | ❌ **nunca** | definido y no usado en ningún lado      |

O sea: **la mitad de la validación del proyecto está escrita, revisada y muerta**.
Los endpoints que deberían usarla leen las propiedades directamente del objeto que
llega por IPC.

Es la causa raíz común de B1 a B4. Vale la pena resolverlo como una sola tarea de
fondo —"todo endpoint que reciba un objeto valida su DTO"— y no una por una.

### B1 · 🔴 `car:add-job` guarda lo que le manden, sin validar nada

**[pendiente]** · `electron/DataBase/Endpoints/car.jobs.endpoints.ts`

El endpoint no valida ningún DTO y hace `price: jobDto.price as number` —un
**cast**, que en TypeScript no comprueba nada en tiempo de ejecución—.

Qué entra sin control:

- `price` negativo, decimal o `NaN`. La columna es `integer`; SQLite es de tipado
  laxo y guarda lo que le den.
- `status` con cualquier texto. La columna es `varchar` sin `CHECK`, así que un
  estado inventado se guarda y después **ninguna pantalla sabe pintarlo** y ningún
  filtro lo encuentra: el trabajo queda invisible en los listados.
- `parts` con cualquier JSON. El total del presupuesto lo suma con `reduce`: un
  `price` que sea texto convierte el total en `"0abc"` o `NaN`, y eso va impreso
  en la factura.

`UpdateJobDto` ya declara `@IsEnum(JobStatus)` y `@IsInt()` para esto. Sólo hay
que aplicarlo, y crear el DTO equivalente para el alta.

### B2 · 🔴 `car:update-job` tampoco valida

**[pendiente]** · `electron/DataBase/Endpoints/car.jobs.endpoints.ts`

Mismo problema que B1, con el agravante de que **el DTO correcto existe y está
importado**: `UpdateJobDto` se usa sólo como tipo de TypeScript. Los decoradores
no corren nunca.

Además, aunque se validara, `parts` está declarado como `@IsOptional()` **sin**
`@ValidateNested()` ni `@Type()`, así que los ítems de adentro seguirían sin
comprobarse.

### B3 · 🔴 `car:reassign-owner` crea clientes sin validar

**[pendiente]** · `electron/DataBase/Endpoints/car.crud.endpoints.ts`

En el modo `new`, el endpoint hace `qr.manager.create(Client, payload.newOwner)`
directamente. `car:create` sí valida el titular anidado (`CreateCarDto` lo declara
con `@ValidateNested()`); este camino no.

Escenario: reasignar el titular a uno nuevo permite crear un cliente con teléfono
en formato inválido, dirección vacía o correo mal formado —cosas que el alta
normal rechaza—. Quedan dos calidades de dato según por dónde se entró.

### B4 · 🟠 El vehículo no se puede editar: sólo el kilometraje

**[pendiente]** · `electron/DataBase/Endpoints/car.crud.endpoints.ts`

`car:update` recibe `(id, kilometers)` y **nada más**. Marca, modelo, año e
intervalos propios de service no se pueden corregir desde ningún lado.

Escenario: se carga un vehículo con el modelo mal escrito o el año equivocado. La
única salida es borrarlo —perdiendo todos sus trabajos, su historial de
kilometraje y su recordatorio— y volver a cargarlo.

`UpdateCarDto` ya está definido con `owner` y `kilometers`, sin usarse. Ni siquiera
cubre marca/modelo/año.

### B5 · 🟠 Guardar una configuración inválida dice que salió bien

**[pendiente]** · `electron/DataBase/serviceReminders.service.ts` →
`saveServiceSettings`

La función filtra los valores que no sean números positivos y **guarda sólo el
resto**, en silencio. El endpoint devuelve siempre
`"Configuración de service actualizada"`.

Escenario: se pone `0` en "avisar con N días de anticipación" y se guarda. No pasa
nada, el mensaje dice que sí, y el campo vuelve a mostrar el valor viejo sin
explicación.

Tampoco hay techo: `intervalKm = 999999999` se acepta y deja el recordatorio
programado para el año 3000.

### B6 · 🟠 `document:issue` acepta totales negativos

**[pendiente]** · `electron/DataBase/Endpoints/document.endpoints.ts`

`total: Math.round(Number(body.total) || 0)` no rechaza negativos. El total del
documento es el **snapshot** que queda en el historial: un negativo ahí es un dato
contable falso que no se puede corregir después (el registro es de sólo lectura).

### B7 · 🟡 La validación de negocio está repartida entre DTOs y comprobaciones a mano

**[pendiente]** · varios

Además de los DTOs, hay reglas escritas a mano en los endpoints: el kilometraje en
`car:update`, la fecha y el km en `service:save`, el tipo en `document:issue`, el
rango de días en `service:snooze`. Cada una con su propio estilo y su propio
mensaje.

No es un bug, pero es la razón por la que las de B1–B3 se pudieron olvidar: no hay
un lugar donde se vea "todo lo que entra por IPC se valida así". Conviene un
criterio único y una prueba que lo verifique para todos los canales.

---

## Sprint C — Seguridad y endurecimiento

El modelo de amenaza de una aplicación de escritorio monousuario es acotado: no
hay atacante remoto ni datos de terceros. Pero **el renderer ejecuta HTML y
JavaScript**, y todo lo que le demos alcanza a cualquier cosa que llegue a
ejecutarse ahí.

### C1 · 🔴 El preload expone un `ipcRenderer` genérico que anula el puente tipado

**[pendiente]** · `electron/preload.ts`

Además del objeto `api` —bien diseñado, canal por canal, con tipos—, el preload
hace:

```ts
contextBridge.exposeInMainWorld("ipcRenderer", {
  on,
  off,
  send,
  invoke,
});
```

Eso le da al renderer **`invoke` y `send` sobre cualquier canal, con cualquier
argumento**. Todo el trabajo de acotar la superficie con `api` queda sin efecto:
`window.ipcRenderer.invoke("backup:import")` o `("car:delete", ...)` funcionan
igual.

Lo revisé: **nadie lo usa**, salvo tres renglones en `src/main.tsx` que escuchan
`main-process-message` —código de ejemplo de la plantilla de electron-vite que
sólo hace un `console.log`—. O sea que la superficie está abierta **para sostener
código muerto**.

Se saca el bloque del preload, se sacan los tres renglones de `main.tsx`, se saca
el `send` de `main-process-message` en `electron/main.ts` y se limpia el tipo en
`global.d.ts`.

### C2 · 🟡 El renderer no tiene Content-Security-Policy

**[pendiente]** · `index.html`

No hay ninguna CSP declarada. Con `contextIsolation: true` y `nodeIntegration:
false` el daño posible está acotado, pero una CSP es la diferencia entre "un
script inyectado no puede hacer nada" y "puede hablar con la red y con lo que el
preload exponga".

Mínimo razonable: `default-src 'self'`, `script-src 'self'`, `connect-src 'none'`,
`img-src 'self' data:`. Hay que verificar que Tailwind y HeroUI no necesiten
`'unsafe-inline'` para estilos.

### C3 · 🟡 La ventana no restringe la navegación ni la apertura de ventanas

**[pendiente]** · `electron/main.ts`

No hay `webContents.setWindowOpenHandler` ni un manejador de `will-navigate`.

- Un `target="_blank"` o un `window.open()` abre **una ventana de Electron**, no
  el navegador.
- Una navegación a una URL externa convierte la ventana de la aplicación en un
  navegador sin barra de direcciones ni forma de volver.

Lo correcto: denegar toda apertura de ventana y toda navegación fuera de la
aplicación, y derivar al navegador del sistema. El canal para eso ya existe
(`app:open-external`, que además valida que sea `https://`).

### C4 · 🟡 El CSV exportado es vulnerable a inyección de fórmulas

**[pendiente]** · `electron/DataBase/Endpoints/backup.endpoints.ts` → `toCsv`

`toCsv` escapa comillas y separadores —correcto para el formato— pero no neutraliza
los valores que **empiezan con `=`, `+`, `-` o `@`**. Excel y LibreOffice los
interpretan como fórmulas al abrir el archivo.

Escenario: un cliente cargado con el nombre `=HYPERLINK(...)` o una fórmula que
lea otras celdas. Al abrir el CSV exportado, se ejecuta. Es el vector clásico de
CSV injection, y acá los datos los escribe una persona en un formulario.

Se resuelve anteponiendo un apóstrofo a los valores que arranquen con esos
caracteres.

### C5 · 🟡 El menú por defecto de Electron sigue activo

**[pendiente]** · `electron/main.ts`

Se llama a `setMenuBarVisibility(false)`, que **oculta** la barra pero no quita el
menú: los aceleradores siguen funcionando. `Ctrl+Shift+I` abre las herramientas de
desarrollo y `Ctrl+R` recarga la aplicación en medio de lo que se esté haciendo.

Para una aplicación de taller conviene `Menu.setApplicationMenu(null)` en
producción y dejar el menú sólo en desarrollo.

### C6 · 🟡 `app:open-external` falla en silencio hacia el renderer

**[pendiente]** · `electron/main.ts`

Si la URL no empieza con `https://`, se registra el error y se hace `return`. El
renderer recibe `undefined`, que es indistinguible del éxito: el usuario aprieta
"WhatsApp", no pasa nada y nadie le dice por qué.

Corresponde devolver el envelope `{ status: "failed", message }` como el resto de
los canales.

### C7 · ⚪ La firma del instalador no está configurada en ningún lado

**[pendiente]** · `electron-builder.json5`

No hay **ninguna** configuración de firma: ni `certificateFile`, ni
`certificateSubjectName`, ni secretos de firma en el flujo de publicación. Lo que
pase depende de lo que haya en el almacén de certificados de la máquina que
compile, que no es lo mismo compilando en local que en el runner de GitHub.

Consecuencia concreta: SmartScreen advierte "editor desconocido" en cada
instalación. No es urgente para uso interno, pero es lo que separa un instalador
que inspira confianza de uno que no —y hoy ni siquiera es reproducible, que es lo
que más molesta—.

---

## Sprint D — Integridad de datos e invariantes

Lo que la base permite que no debería, y lo que sólo se sostiene porque el código
se porta bien.

### D1 · 🔴 La invariante "un recordatorio vigente por vehículo" no existe en la base

**[pendiente]** · `electron/DataBase/Entities/serviceReminder.entity.ts`

La regla está escrita en el comentario de la entidad y la cuidan los endpoints a
mano. **La base no la impide**: no hay índice único ni restricción.

Que eso no alcanza está probado: la migración `SimplifyServiceType` tuvo que
recorrer la base real **colapsando los múltiples recordatorios activos por
vehículo** que ya existían, quedándose con el más urgente y descartando el resto
con una nota. O sea que el código ya falló en sostenerla al menos una vez, y
**A3** describe un camino por el que puede volver a pasar.

SQLite soporta índices únicos parciales, que es exactamente la herramienta:

```sql
CREATE UNIQUE INDEX IDX_service_reminder_activo_por_auto
  ON service_reminder (carId)
  WHERE status IN ('pending', 'snoozed');
```

Con eso, el bug deja de poder ocurrir en vez de tener que acordarse de evitarlo.

### D2 · 🔴 Los tipos de las entidades mienten sobre lo que puede ser nulo

**[pendiente]** · `electron/DataBase/Entities/*.entity.ts`

Tres columnas están declaradas `nullable: true` en la base y **no nulas** en
TypeScript:

| Campo           | Base             | TypeScript            |
| --------------- | ---------------- | --------------------- |
| `Car.owner`     | `nullable: true` | `owner!: Client`      |
| `Car.kmHistory` | `nullable: true` | `kmHistory!: {...}[]` |
| `Job.parts`     | `nullable: true` | `parts!: {...}[]`     |

El compilador cree que siempre hay valor, así que **no obliga a nadie a
contemplar el caso nulo**. En el código conviven las dos cosas: hay lugares que se
defienden (`car.owner?.fullname ?? "Sin titular"`, `Array.isArray(car.kmHistory)`)
y lugares que no. Los que no se defienden hoy funcionan por suerte, no por
garantía; y el compilador —que es quien tendría que avisar— está mirando para otro
lado porque le mintieron.

Cambiar los tipos a `Client | null` y compañía va a hacer aparecer los sitios sin
proteger. Ese es el punto.

### D3 · 🟠 `countDueReminders` usa `COUNT(columna)`, contra la regla del propio proyecto

**[pendiente]** · `electron/DataBase/serviceReminders.service.ts`

```ts
.select("COUNT(reminder.id)", "count")
```

`CLAUDE.md` documenta la regla con la medición: el PK es un uuid y no el rowid de
SQLite, así que nombrar la columna obliga a leer la fila entera, y un conteo por
estado pasó **de 1,1 ms a 88 ms**. `dashboardStats.service.ts` tiene hasta una
constante `COUNT_ALL = "COUNT(*)"` con el razonamiento escrito arriba.

Es el único lugar del backend que se quedó afuera, y no es cualquiera: alimenta el
badge de la barra y la notificación de arranque.

### D4 · 🟠 Un recordatorio descartado saca al vehículo del circuito para siempre

**[pendiente]** · `electron/DataBase/serviceReminders.service.ts`

`ensureReminder` dice en su documentación que se usa "al registrar un auto **y
como red de seguridad**". Lo comprobé: **se llama en un solo lugar**, en
`car:create`. La red de seguridad no existe.

Escenario: se descarta el recordatorio de un vehículo (por ejemplo porque el
cliente dijo que no lo trae más). El auto **no vuelve a generar ninguno**: queda
fuera del circuito de service de forma permanente, salvo que alguien se acuerde de
crearle uno a mano desde su ficha.

Hay dos salidas razonables y hay que elegir una: llamar a `ensureReminder` de
verdad como red de seguridad (al abrir la ficha, o al cerrar cualquier trabajo), o
sacar la frase de la documentación y hacer explícito en la interfaz que descartar
es definitivo.

### D5 · 🟠 El nombre del cliente es la clave única, así que no puede haber dos homónimos

**[pendiente]** · `electron/DataBase/Entities/client.entity.ts`

`Client.fullname` es `unique`, y **es la clave por la que se busca al cliente** en
casi todos lados: `client:find-by-name`, la reasignación de titular por
`existingOwnerFullname`, la asociación automática en `car:create`.

Consecuencias:

- Dos clientes que se llamen igual son imposibles. En un taller de barrio eso pasa.
- El teléfono también es `unique`: una familia que comparte un número no puede
  tener dos fichas.
- Buscar por nombre en vez de por `id` es frágil: renombrar un cliente cambia la
  clave con la que lo referencian las pantallas.

Lo correcto de fondo es referenciar por `id` en toda la interfaz y quitar la
unicidad de `fullname` (dejando quizás un aviso de duplicado, no un impedimento).
Es un cambio grande: toca endpoints, hooks y pantallas.

### D6 · 🟡 El dinero se guarda en `integer` para el trabajo y en JSON libre para los repuestos

**[pendiente]** · `electron/DataBase/Entities/job.entity.ts`

`Job.price` es `integer`, así que la mano de obra no admite centavos. Los
repuestos viven en `Job.parts` como `simple-json`, donde `price` es un número de
JavaScript cualquiera: **sí admite decimales**.

Escenario: se carga un repuesto a $1.234,56. Se guarda con decimales, y el total
del presupuesto los arrastra, pero la mano de obra del mismo trabajo no puede
tenerlos. El documento impreso mezcla las dos cosas.

Hay que decidir una representación y aplicarla a las dos: o todo en centavos
(`integer`, que es lo más sano para dinero), o todo con decimales explícitos. Hoy
es medio y medio por accidente.

---

## Sprint E — Errores no atajados y observabilidad

Qué pasa cuando algo sale mal, y si queda rastro.

### E1 · 🔴 Un error de la interfaz no deja **ningún** rastro en los logs

**[pendiente]** · `src/Pages/Components/ErrorBoundary.tsx`

Cuando una pantalla revienta, el `ErrorBoundary` la reemplaza por "Algo salió mal"
y hace `console.error`. Nada más.

El problema es que `console.error` del renderer **no va al archivo de log**: va a
la consola de las herramientas de desarrollo, que en producción nadie abre. Y el
detalle técnico se muestra sólo `if (import.meta.env.DEV)`.

Escenario completo: al usuario le revienta una pantalla, ve un cartel genérico,
llama por teléfono, y del otro lado se le pide que mande los logs —hay un botón
"abrir carpeta de logs" justamente para eso—. **En los logs no hay nada.** El único
error que importaba es el único que no se registró.

Hay que mandarlo al proceso principal por IPC y registrarlo con `logError`, como
todo lo demás.

### E2 · 🟠 Si falla cargar la configuración de service, la pantalla ofrece guardar valores inventados

**[pendiente]** · `src/Pages/ServiceAlertsPage.tsx`

```ts
} catch {
  /* si falla, quedan los valores por defecto */
}
```

El comentario describe lo que hace, pero no el efecto: el formulario de
configuración queda mostrando **los valores por defecto como si fueran los
guardados**. Si el usuario abre ese panel y aprieta guardar, **pisa su
configuración real con los defaults** sin haberse enterado de nada.

Un fallo al leer configuración no puede ser silencioso si esa misma pantalla
permite escribirla.

### E3 · 🟠 El PDF se descarga sin preguntar y sin confirmar que se guardó

**[pendiente]** · `src/Hooks/useBudgetPdf.ts`

La emisión termina en `doc.save(...)`, que es la descarga de jsPDF: el archivo cae
en la carpeta de descargas del sistema sin diálogo, sin elegir dónde y **sin
devolver si funcionó**.

Dos cosas mal:

- Es incoherente con el resto de la aplicación. Exportar la base y exportar el CSV
  usan `dialog.showSaveDialog`, dejan elegir la carpeta y avisan al terminar.
  Emitir una factura —que es más importante— no.
- Como `doc.save()` no informa el resultado, **un fallo al escribir no dispara el
  descarte del documento**. Ver E4.

### E4 · 🟠 El número de documento se puede quemar sin que salga ningún PDF

**[pendiente]** · `src/Hooks/useBudgetPdf.ts`,
`electron/DataBase/Endpoints/document.endpoints.ts`

La secuencia es: pedir el número (se **commitea** en la base) → dibujar el PDF →
descargarlo. Si algo falla en el medio, hay un `document:discard` que lo borra,
pero sólo funciona si el documento es el último de su tipo, y **sólo se dispara si
la excepción llega al `catch`**.

Los caminos por los que se pierde el número igual:

- `doc.save()` no informa fallos (E3), así que un error de escritura no se ve.
- Si la aplicación se cierra entre el commit y la descarga, no corre ningún
  descarte.
- Si el descarte falla, se traga el error (`/* no se pudo descartar */`) y no
  queda rastro.

Resultado: un hueco en el correlativo, que es justo lo que toda esta maquinaria
existe para evitar. Lo correcto es al revés: **generar el PDF primero y tomar el
número al confirmar que se guardó**.

### E5 · 🟠 `data:export-csv` revienta hacia el renderer en vez de devolver el error

**[pendiente]** · `electron/DataBase/Endpoints/backup.endpoints.ts`

`fs.writeFileSync(filePath, csv, "utf8")` no está en un `try`. Un disco lleno, una
carpeta sin permisos o un pendrive desconectado lanzan, `handleIpc` relanza y el
renderer recibe una promesa rechazada con el mensaje crudo de Node.

Todos los demás flujos de respaldo devuelven `{ status: "failed", message }` con
un texto entendible. Éste no.

### E6 · 🟡 Los archivos `_pre_import_*.db` se acumulan sin límite

**[pendiente]** · `electron/DataBase/Endpoints/backup.endpoints.ts`

Cada importación o restauración guarda la base anterior al lado, con nombre
`taller_pre_import_<marca>.db`, y **nunca se borra ninguna**. Las copias previas a
migraciones sí tienen retención (`pruneSnapshots`, últimas 3) y los respaldos
diarios también (por niveles). Éstas no.

No es grave, pero es la misma decisión tomada tres veces con tres resultados
distintos, y con el tiempo llena la carpeta de datos con copias enteras de la base.

### E7 · 🟡 `backup:export` borra el archivo de destino antes de saber si puede escribirlo

**[pendiente]** · `electron/DataBase/Endpoints/backup.endpoints.ts`

```ts
fs.rmSync(filePath, { force: true });
await AppDataSource.query("VACUUM INTO ?", [filePath]);
```

El borrado previo es necesario porque `VACUUM INTO` falla si el destino existe.
Pero si el `VACUUM` falla después, **el archivo que había ahí ya no está**.

Escenario: el usuario exporta encima de un respaldo anterior en un pendrive, el
pendrive se desconecta a mitad, y se queda sin el respaldo viejo **y** sin el
nuevo.

Lo correcto es el patrón que el propio proyecto ya usa en `createPreMigrationSnapshot`:
escribir a `<destino>.parcial` y renombrar al final.

### E8 · 🟡 El reemplazo de base no limpia los archivos laterales de SQLite

**[pendiente]** · `electron/DataBase/Endpoints/backup.endpoints.ts`,
`electron/DataBase/migrationSafety.ts` → `restoreSnapshot`

Las dos funciones hacen `fs.copyFileSync` sobre el `.db` sin borrar antes un
`-journal`, `-wal` o `-shm` que pudiera haber quedado del archivo anterior. Si
quedara uno, SQLite lo aplicaría sobre una base que no le corresponde.

Comprobé que hoy el riesgo es bajo: la base corre en `journal_mode = delete`
—verificado en ejecución, no supuesto—, así que no hay `-wal` permanente. Pero es
una suposición no escrita en ningún lado: alcanza con que alguien active WAL para
buscar rendimiento y esto pase de improbable a corrupción. Borrar los laterales
antes de copiar cuesta dos renglones.

---

## Sprint F — Consistencia del contrato y del código

Nada de esto rompe hoy. Todo esto es la razón por la que mañana algo se va a
romper: cuando la misma cosa se hace de tres formas distintas, la cuarta vez se
elige mal.

### F1 · 🟠 Los contadores y el dashboard nunca se enteran de que pasó el tiempo

**[pendiente]** · `electron/DataBase/dashboardCache.ts`, `src/Components/Header.tsx`

Dos mecanismos que se invalidan **sólo ante escrituras**, calculando cosas que
dependen de la fecha:

- La caché del dashboard no tiene vencimiento. `computeDashboardStats` usa
  `new Date()` para el mes en curso y los últimos seis meses.
- Los contadores de la barra (services por vencer, trabajos activos) se refrescan
  al montar y con el aviso `data-changed`. Nada más.

Escenario: el taller deja la aplicación abierta, como es normal. El 31 de
diciembre a la noche pasa a ser 1° de enero: **el dashboard sigue mostrando
diciembre como mes en curso**, con su facturación y su "+3 este mes", hasta que
alguien cargue algo. Lo mismo con un recordatorio que vence a medianoche: el badge
no lo cuenta hasta la próxima escritura.

Se arregla con un vencimiento por tiempo en la caché y un refresco periódico (o al
volver el foco a la ventana).

### F2 · 🟠 Cinco endpoints devuelven algo distinto de lo que devuelven los demás

**[pendiente]** · `electron/DataBase/Endpoints/*`

El contrato dominante es el envelope `APIResponse<T>` con `status`, `message` y
`result`. Pero:

- `car:get-all`, `client:get-all`, `service:list` devuelven `Paginated<T>` pelado.
- `car:active-jobs-count`, `service:count-due` devuelven un número pelado.
- `client:cities` devuelve un array pelado.
- `document:list` devuelve un array pelado.
- `service:settings-get` devuelve el objeto pelado.
- `client:create` devuelve el envelope pero **sin `result`**, mientras que
  `car:create` y `client:update` sí lo mandan.

El resultado práctico: `ensureSuccess` —el helper que existe justamente para no
tragarse un `status: "failed"`— no se puede usar en la mitad de las llamadas, y
cada pantalla inventa su propio manejo de error. Que es exactamente el problema
que `ensureSuccess` documenta como ya sufrido.

### F3 · 🟠 `client:create` no devuelve el cliente creado

**[pendiente]** · `electron/DataBase/Endpoints/client.endpoints.ts`

Caso particular de F2, pero con efecto propio: quien crea un cliente no recibe su
`id`, así que para hacer cualquier cosa a continuación tiene que volver a
buscarlo **por nombre**, que es la clave frágil de **D5**.

### F4 · 🟡 La regla "teléfono ya registrado" está escrita dos veces y falta en un tercer lugar

**[a testear]** · `car.crud.endpoints.ts`, `client.endpoints.ts`

Ver **A5**. La misma comprobación, con el mismo mensaje, copiada en `car:create` y
en `car:reassign-owner`, y ausente en `client:create` y `client:update`. Es el
argumento a favor de que las reglas de unicidad vivan en un solo módulo de dominio
y no en cada endpoint.

**Resuelto al hacer A5**: escribir la tercera copia para arreglar A5 habría sido
absurdo, así que la regla se mudó a `clients.service.ts` y los cuatro caminos la
comparten.

### F5 · 🟡 Tres formas distintas de escapar una búsqueda

**[a testear]** · `electron/pagination.ts` y los endpoints de búsqueda

- Los listados usan `escapeLike` (correcto).
- `client:search` **reimplementa** el mismo `replace` a mano.
- `global:search` **no escapa nada** (ver **A7**).

Un helper, tres criterios.

**Resuelto al hacer A7**: los tres caminos usan `escapeLike`.

### F6 · 🟡 El proyecto detecta "modo desarrollo" con `NODE_ENV` en vez de `app.isPackaged`

**[pendiente]** · `electron/main.ts`, `electron/DataBase/dataSource.ts`

`process.env.NODE_ENV === "development"` decide cosas serias: **dónde vive la base
de datos**, dónde van los respaldos, si se hace el respaldo diario y si se
comprueban actualizaciones.

`NODE_ENV` es una convención de las herramientas, no algo que Electron garantice.
Hoy funciona porque Vite la define, pero es una variable de entorno heredada: un
`NODE_ENV=production` en la terminal del desarrollador hace que `npm run dev`
**abra la base real del usuario y escriba respaldos en sus Documentos**.

`app.isPackaged` es la comprobación que no depende del entorno.

### F7 · 🟡 `Car` obliga a pasar un objeto al constructor y las demás entidades no

**[pendiente]** · `electron/DataBase/Entities/*.entity.ts`

`Car` declara `constructor(partial: Partial<Car>)` (obligatorio) mientras `Job`,
`ServiceReminder`, `Document` y `AppSetting` usan `partial?` (opcional). TypeORM
instancia entidades sin argumentos: funciona porque `Object.assign(this, undefined)`
no hace nada, o sea **por una casualidad del lenguaje**. Conviene unificar.

### F8 · ⚪ Queda código de la plantilla de electron-vite

**[pendiente]** · `src/main.tsx`, `electron/main.ts`, `electron/preload.ts`

El canal `main-process-message` sólo existe para hacer un `console.log` de la
fecha al cargar. Arrastra consigo la exposición del `ipcRenderer` genérico
(**C1**). También quedan comentarios en inglés de la plantilla
(`// Test active push message to Renderer-process.`,
`// You can expose other APTs you need here.`, con la errata incluida) en un
proyecto cuya convención es comentar en castellano.

### F9 · ⚪ `FormWrapper` desactiva el chequeo de tipos de todo el archivo

**[pendiente]** · `src/Components/Forms/FormWrapper.tsx`

`/* eslint-disable @typescript-eslint/no-explicit-any */` con
`form: UseFormReturn<any>`. Es un componente genérico, así que se resuelve con un
parámetro de tipo (`<T extends FieldValues>`) en vez de apagar la regla para el
archivo entero.

---

## Sprint G — Rendimiento

Con la base de hoy (3 vehículos) nada de esto se nota. Todos son casos que
aparecen al crecer, y algunos crecen rápido.

### G1 · 🟠 La ficha de un vehículo trae **todos** sus trabajos, siempre

**[pendiente]** · `electron/DataBase/Endpoints/car.crud.endpoints.ts` →
`car:get-by-license`

`relations: { owner: true, jobs: true }` sin límite. Cada trabajo viaja completo
por IPC: descripción, notas, notas al cliente y el JSON de repuestos.

La tabla de la ficha **pagina de a 5 en el frontend**, así que un auto con 200
trabajos manda 200 por IPC para mostrar 5. Un vehículo de flota con años de
historia hace que abrir su ficha sea la operación más pesada de la aplicación.

Corresponde paginar del lado del servidor, como ya se hace en los otros tres
listados.

### G2 · 🟡 Listar recordatorios escribe en la base

**[pendiente]** · `electron/DataBase/serviceReminders.service.ts` →
`reactivateExpiredSnoozes`

Se llama al principio de `service:list`, de `service:by-car` y de
`countDueReminders` —y `countDueReminders` lo llaman el badge de la barra y la
notificación de arranque—. Son **dos `UPDATE`** por cada una de esas lecturas,
casi siempre sin filas que tocar.

Que una lectura escriba no es gratis: toma el bloqueo de escritura, invalida
páginas y ensucia el archivo. Y son dos sentencias que podrían ser una.

Mejor: correrlo una vez al arrancar y después en un intervalo, no en cada lectura.

### G3 · 🟡 `getServiceSettings` consulta la base varias veces por request

**[pendiente]** · `electron/DataBase/serviceReminders.service.ts`

Cada llamada hace un `find` sobre `app_setting`. En `service:list` se llama una vez
directamente y otra vez por cada `evaluate()`; en `service:snooze` y compañía, otra
vez más. Es configuración que cambia una vez al año: se cachea en memoria y se
invalida al guardarla.

### G4 · 🟡 `service:list` carga el historial de kilometraje completo de cada vehículo

**[pendiente]** · `electron/DataBase/Endpoints/service.endpoints.ts` → `toView`

`toView` calcula `estimateKmPerDay(reminder.car?.kmHistory)` para no mandar el
historial por IPC —bien pensado— pero el `innerJoinAndSelect("reminder.car")`
**sí lo trae de la base**, entero, para cada fila de la página. `kmHistory` crece
con cada actualización de kilometraje.

Se resuelve seleccionando las columnas que hacen falta en vez de la entidad
completa, como ya hace `client:get-all` con `addSelect(["cars.id", "cars.licensePlate"])`.

### G5 · 🟡 `document:list` ordena por una columna sin índice

**[pendiente]** · `electron/DataBase/Entities/document.entity.ts`

El único índice es el único compuesto `(type, number)`. El listado ordena por
`createdAt DESC, number DESC`, así que hace un recorrido completo más un ordenado
en memoria. Hoy son pocos documentos; crecen uno por presupuesto emitido y no se
borran nunca por diseño.

### G6 · ⚪ Consultas que traen relaciones que no se usan

**[pendiente]** · `electron/DataBase/Endpoints/client.endpoints.ts`

- `client:toggle-active` carga `relations: { cars: true }` y no toca los autos.
- `client:update` hace un `findOne` extra **después** de guardar sólo para
  devolver el cliente con sus autos.
- `client:find-by-name` trae `cars.jobs` completos para mostrar **un número** por
  vehículo; alcanzaría con un conteo.

### G7 · ⚪ El respaldo diario retrasa la apertura de la ventana

**[pendiente]** · `electron/main.ts` → `createWindow`

El orden del arranque es: base → respaldo diario (`VACUUM INTO` de toda la base) →
conteo de recordatorios → recién ahí se crea la ventana. Con la base chica no se
nota; con una base grande, el usuario mira la pantalla de carga mientras se copia
un archivo que no necesita para empezar a trabajar.

El respaldo es best-effort por diseño: puede correr después de mostrar la ventana.

---

## Sprint H — Huecos de producto

Cosas que la aplicación no hace y que un taller va a necesitar. No son bugs: son
decisiones que todavía no se tomaron.

### H1 · 🟠 Una factura emitida no se puede volver a imprimir

**[pendiente]** · `electron/DataBase/Entities/document.entity.ts`

`Document` guarda tipo, número, patente, nombre del titular y total. **No guarda
los renglones**: ni los trabajos, ni los repuestos, ni las observaciones.

Consecuencia: el historial dice que se emitió `FAC-000007` por $89.000, pero **no
hay forma de volver a generar ese PDF**. Si el cliente lo pierde, o se cerró el
navegador antes de guardarlo, el documento no se puede reproducir. Y si mientras
tanto se editó o borró el trabajo, la información original ya no existe en ningún
lado.

Para un documento que es un comprobante, guardar el snapshot completo de lo que se
imprimió no es una mejora: es la razón de existir de la tabla.

### H2 · 🟠 Un documento consolidado no aparece en el historial de ningún vehículo

**[pendiente]** · `src/Hooks/useBudgetPdf.ts`,
`electron/DataBase/Endpoints/document.endpoints.ts`

En el consolidado de un cliente, `licensePlate` se guarda como `"AB123CD, XY456ZW"`.
`document:list` filtra por patente con **igualdad exacta**, así que ese documento
no sale en el historial de ninguno de los dos autos: sólo en el listado general.

### H3 · 🟠 El correlativo se puede saltear sin que nadie se entere

**[pendiente]** · varios

Ver **E4**. Además del bug, falta lo de producto: **no hay forma de detectar un
hueco**. Ni una pantalla que lo muestre, ni un aviso. Para una numeración
correlativa que existe justamente para no tener huecos, corresponde al menos
poder verificarla.

### H4 · 🟠 No se puede corregir un trabajo mal cargado

**[pendiente]** · `electron/DataBase/Types/car.dto.ts` → `UpdateJobDto`

`UpdateJobDto` permite cambiar `status`, `price`, `parts`, `notes`, `clientNote` e
`isService`. **No permite cambiar `description` ni `isThirdParty`.**

Escenario: se carga "Cambio de correa de distribucion" con un error de tipeo y esa
descripción sale impresa en el presupuesto del cliente. No hay forma de
corregirla; hay que borrar el trabajo y cargarlo de nuevo.

Junto con **B4** (no se puede editar marca/modelo/año del vehículo), el patrón es
claro: la aplicación sabe crear y sabe borrar, pero **corregir un error de carga
casi siempre implica borrar y rehacer**.

### H5 · 🟠 No hay forma de deshacer un borrado

**[pendiente]** · todos los `delete`

Borrar un vehículo se lleva sus trabajos, su historial de kilometraje y su
recordatorio. Borrar un cliente se lleva además **todos sus vehículos**. Es
irreversible salvo restaurando un respaldo entero, lo que descarta todo lo hecho
desde entonces.

Los clientes ya tienen `isActive` para la baja lógica; los vehículos no tienen
equivalente. Un borrado lógico con papelera resolvería el caso real —"me equivoqué
de auto"— sin obligar a elegir entre perder un dato y perder un día.

### H6 · 🟡 No hay búsqueda ni filtro en el historial de documentos

**[pendiente]** · `src/Components/DocumentHistory.tsx`

`document:list` acepta `type`, `licensePlate` y `limit` (tope 100). No hay
búsqueda por nombre de cliente, ni rango de fechas, ni paginado. Con dos años de
presupuestos, el historial es una lista de 100 y nada más.

### H7 · 🟡 Los intervalos de service por vehículo no se pueden configurar

**[pendiente]** · `electron/DataBase/Entities/car.entity.ts`

`Car.serviceIntervalMonths` y `Car.serviceIntervalKm` existen en la entidad, los
usa `computeNextService`, y **ninguna pantalla los edita**. La funcionalidad está
implementada al 90% y es inalcanzable: hoy todos los vehículos usan los intervalos
generales.

Es justo el caso que el comentario de la entidad describe —"distinguir un auto de
uso intensivo de uno de fin de semana"— y no se puede hacer.

### H8 · ⚪ Los respaldos exportados a mano no aparecen en la lista de restauración

**[pendiente]** · `electron/DataBase/backups.ts` → `listBackups`

`listBackups` reconoce sólo el patrón `taller_<AAAA-MM-DD>.db`. El nombre que
propone la exportación manual es `taller_backup_<fecha>.db`, que **no matchea**:
si el usuario lo guarda en la carpeta de respaldos esperando verlo ahí, no
aparece. Además la fecha que muestra la pantalla sale del **nombre del archivo**,
no de su fecha real.

---

## Sprint I — Interfaz y accesibilidad

### I1 · 🟠 Ninguno de los 24 botones de sólo ícono tiene nombre accesible

**[pendiente]** · varios componentes

Hay **24 usos de `isIconOnly`** en la interfaz y **ninguno** declara `aria-label`
en el mismo elemento. Un botón cuyo único contenido es un `<svg>` no tiene texto:
para un lector de pantalla es "botón", sin más.

Afecta a las acciones más habituales —borrar, refrescar, editar, emitir— y también
a las pruebas: hoy no se puede escribir
`getByRole("button", { name: /eliminar/i })` para la mitad de la interfaz, que es
la forma correcta de testear.

Muchos tienen `Tooltip`, que ayuda con el mouse y no con el teclado.

### I2 · 🟠 El documento se declara en inglés

**[pendiente]** · `index.html`

`<html lang="en">` en una aplicación íntegramente en castellano. Los lectores de
pantalla la van a leer con pronunciación inglesa, y los correctores del navegador
usan el diccionario equivocado. Es un atributo.

### I3 · 🟡 El `ErrorBoundary` esconde el motivo justo cuando hace falta

**[pendiente]** · `src/Pages/Components/ErrorBoundary.tsx`

El detalle técnico se muestra sólo con `import.meta.env.DEV`. En producción el
usuario ve "Ocurrió un error inesperado" y nada más, y como tampoco queda en los
logs (**E1**), la información se pierde del todo.

No hace falta mostrarle un stack trace: alcanza con un identificador de error que
pueda dictar por teléfono y que esté en el log.

### I4 · 🟡 `removeAllListeners` del updater es un martillo

**[pendiente]** · `electron/preload.ts`

Los `onUpdate*` no devuelven función de baja; la limpieza es
`removeAllListeners()`, que borra **todos** los listeners de esos canales, sean de
quien sean. Hoy el único consumidor es el `Header`, así que funciona. El día que
otra pantalla escuche uno de esos canales, desmontar el Header la deja sorda sin
ningún error.

El patrón correcto ya está en el mismo archivo: `onDataChanged` devuelve su propia
función de baja.

### I5 · ⚪ `onUpdateNotAvailable` y `onDownloaded` le pasan el evento IPC al callback

**[pendiente]** · `electron/preload.ts`

Mientras `onUpdateAvailable`, `onProgress` y `onError` envuelven el callback para
pasar sólo los datos, estos dos registran el callback directo, así que reciben
`(event, ...args)`. Hoy no molesta porque no usan argumentos, pero es una
inconsistencia que filtra el objeto del evento al renderer.

### I6 · ⚪ Los repuestos no se pueden editar ni se detectan repetidos

**[pendiente]** · `src/Components/Parts/PartsEditor.tsx`

Sólo agregar y borrar: corregir el precio de un repuesto obliga a borrarlo y
volver a cargarlo. Tampoco avisa si se agrega dos veces el mismo nombre, ni hay
tope de precio.

---

## Sprint J — Tests

Hay 145 tests y pasan todos. El problema no es la cantidad, es **dónde están**.

| Capa                           | Archivos | Con test |
| ------------------------------ | -------- | -------- |
| Utilidades puras (`src/Utils`) | 8        | **7**    |
| Componentes (`src/Components`) | ~40      | 3        |
| Endpoints IPC (`electron`)     | 8        | **0**    |
| Store Redux (`src/Store`)      | 5        | **0**    |
| Hooks (`src/Hooks`)            | 10       | **0**    |
| Migraciones                    | 11       | **0**    |

Lo que está probado son los módulos puros, que son los que menos se rompen. **Los
ocho archivos de endpoints —donde vive toda la lógica de negocio y donde están 10
de los 14 bugs 🔴 de este plan— no tienen una sola prueba.**

Y no es que sean difíciles de probar: el proyecto ya tomó la decisión de diseño
que lo permite (los módulos de dominio reciben el `EntityManager` por parámetro) y
`dashboardStats.test.ts` demuestra que funciona.

### J1 · 🟡 Ninguna prueba sobre los endpoints IPC

**[pendiente]** · `electron/DataBase/Endpoints/*`

Prioridad por riesgo: `car:create` (transacción + titular + recordatorio),
`car:add-job` y `car:update-job` (transacción + cierre de service),
`service:save` (donde están A2, A3 y A4), `document:issue` (correlativo),
`client:delete` (borra en cascada los vehículos).

Se pueden ejercitar contra una base SQLite en memoria o contra una copia, como ya
hace `dashboardStats.test.ts`.

### J2 · 🟡 Ninguna prueba sobre las migraciones

**[pendiente]** · `electron/DataBase/Migrations/*`

Son 11 migraciones que **reescriben datos del usuario**, y ninguna tiene prueba.
`SimplifyServiceType` colapsa recordatorios y borra una columna;
`NormalizeJobDates` reescribe fechas con `strftime` —con la trampa documentada de
que devuelve `NULL` ante un texto que no entiende y puede vaciar una columna
`NOT NULL`—.

El patrón razonable: armar la base en el esquema anterior, insertar los casos
raros, correr la migración y verificar el resultado. Es lo que se hizo a mano
contra la base real; hay que dejarlo escrito.

### J3 · 🟡 Ninguna prueba sobre el store ni los thunks

**[pendiente]** · `src/Store/*`

El contrato "los thunks **resuelven** con `status: failed`" está documentado en
`CLAUDE.md` como algo que ya se pagó una vez —una pantalla mostró "guardado con
éxito" sin haber guardado—. Justamente ese contrato no tiene ninguna prueba que lo
sostenga.

### J4 · 🟡 Los hooks de consulta no tienen prueba

**[pendiente]** · `src/Hooks/*`

`useCarQueries` (273 renglones, con los `catch (error: any)` de **A10**),
`useBudgetPdf` (el flujo de emisión, con **E4**) y `useFormGuard` (con el bug
**A8**) son los tres que más lo justifican: cada uno tiene un bug de este plan que
una prueba habría atrapado.

### J5 · 🟡 No hay ninguna prueba de extremo a extremo

**[pendiente]**

Se evaluó y se descartó en su momento (ver la nota del 2026-08-16 en el plan v1) y
la decisión sigue siendo razonable. Pero conviene revisarla ahora que hay **28
tareas marcadas "a testear" que nadie ejercitó**: un puñado de recorridos
completos —cargar un auto, cargar un trabajo, emitir un presupuesto, cerrar un
service— cubriría más que cualquier prueba unitaria nueva.

### J6 · ⚪ No se mide la cobertura

**[pendiente]** · `vitest.config.ts`

No hay `coverage` configurado, así que la tabla de arriba la armé contando
archivos a mano. Con `@vitest/coverage-v8` y un umbral mínimo, la conversación
sobre qué falta probar deja de ser una opinión.

### J7 · ⚪ Los tests no cubren los caminos de error del backend

**[pendiente]**

Ni un test comprueba qué pasa cuando la base está bloqueada, cuando el disco está
lleno, cuando una transacción falla a mitad o cuando el IPC rechaza. Son
exactamente los caminos donde el manejo de errores importa, y donde el plan v1
puso mucho trabajo que hoy nadie verifica.

---

## Sprint K — Empaquetado, metadatos y mantenimiento

### K1 · 🟠 La carpeta de salida del instalador es una ruta absoluta de una máquina

**[pendiente]** · `electron-builder.json5`

```json5
directories: {
  output: "C:/Users/ASUS/Downloads/MecanicaDealbera-Release",
}
```

Una ruta absoluta con un nombre de usuario adentro, en un archivo versionado.
`npm run build` en cualquier otra máquina escribe en una ruta que no existe. El
flujo de publicación funciona **sólo porque la pisa** con
`--config.directories.output=release`.

Corresponde `output: "release"` (relativo, ignorado por git) y que quien quiera
otra carpeta la pase por parámetro.

### K2 · 🟡 `package.json` no declara autor ni licencia

**[pendiente]** · `package.json`

Faltan `author` y `license`. No es cosmético: electron-builder **avisa durante el
build** (`author is missed in the package.json`) y usa ese campo para el nombre
del publicador en las propiedades del ejecutable de Windows —que es lo que ve el
usuario cuando SmartScreen le pregunta si confía—.

### K3 · 🟡 Se empaqueta para macOS y Linux sin que nadie lo haya probado

**[pendiente]** · `electron-builder.json5`

Hay objetivos `mac` (dmg) y `linux` (AppImage) configurados. Pero el código asume
Windows en varios lados —`app.getPath("documents")` para los respaldos, el traslado
desde `Documentos`, `signtool`— y no hay ninguna prueba en esas plataformas.

Un artefacto que se puede construir y nunca se probó es peor que no tenerlo: da a
entender que está soportado. O se prueba, o se saca hasta que se decida.

### K4 · 🟡 El ícono de Windows es un PNG

**[pendiente]** · `electron-builder.json5`

`icon: "public/logo-grande.png"`. electron-builder lo convierte, pero un `.ico`
real con varias resoluciones (16, 32, 48, 256) se ve mejor en la barra de tareas y
en el explorador, que es donde el usuario lo mira todos los días.

### K5 · 🟡 No hay forma de saber qué cambió entre versiones

**[pendiente]**

No hay `CHANGELOG.md`, y los releases de GitHub se publican sin notas. La
aplicación **muestra `info.releaseNotes`** en el modal de actualización —el código
está escrito— y hoy recibe siempre vacío. El usuario ve "hay una versión nueva" sin
una palabra sobre qué trae.

### K6 · ⚪ `.gitignore` no cubre la carpeta de salida del build

**[pendiente]** · `.gitignore`

Ignora `dist`, `dist-electron` y `data`, pero no `release/` —que es adonde escribe
el flujo de publicación— ni `coverage/`. Hoy no molesta porque el build local
escribe en `Downloads` (**K1**); al arreglar K1, empieza a molestar.

### K7 · ⚪ No hay plantilla de reporte ni guía de contribución

**[pendiente]** · `.github/`

Para un proyecto de una persona es opinable. Pero como el propio `CLAUDE.md` dice,
"cada regla costó una sesión de depuración": un `CONTRIBUTING.md` corto que apunte
a `CLAUDE.md` y al plan evita que la próxima persona —o la próxima sesión— tenga
que redescubrirlas.

---

## Cómo se hizo esta revisión

Se leyeron completos los 45 archivos de `electron/` y los archivos de `src/` con
lógica: hooks, store, utilidades, formularios, las páginas grandes y los
componentes con reglas propias.

**Lo que se comprobó ejecutando, en vez de suponerlo:**

- Las claves foráneas **están activas** (`PRAGMA foreign_keys = 1`), así que el
  borrado en cascada de trabajos y recordatorios funciona de verdad. Era una
  sospecha razonable —SQLite las trae apagadas por defecto— y resultó infundada:
  la activa el driver de TypeORM.
- El `journal_mode` es `delete`, no WAL. Eso **baja** la gravedad de **E8** de
  "corrupción probable" a "suposición no escrita".
- `synchronous = 2` (FULL) y `busy_timeout = 5000`: la configuración de durabilidad
  es la correcta.
- La FK de `job` declara `ON DELETE CASCADE` en el esquema real, no sólo en la
  entidad.
- `class-validator` 0.15 aplica bien los mensajes propios, la validación anidada
  del titular y el `@Transform` de la patente.
- Que `window.ipcRenderer` **no lo usa nadie** salvo el código de ejemplo de la
  plantilla (**C1**), y que `ensureReminder` se llama **en un solo lugar**
  (**D4**): las dos cosas se verificaron buscando en todo el proyecto antes de
  anotarlas.

**Lo que NO se revisó**, y conviene decirlo:

- El dibujo de los PDF renglón por renglón (`budgetPdf.ts`, 499 líneas). Tiene tres
  archivos de test propios.
- El detalle visual de cada pantalla. Esta revisión es de código; **no reemplaza
  usar la aplicación**, que sigue siendo lo que le falta a las 28 tareas del plan
  v1 marcadas "a testear".
- Las 11 migraciones una por una. Se leyó qué hace cada una, no se auditó su SQL.

## Por dónde empezar

Si hubiera que elegir, el orden que más riesgo saca por unidad de trabajo:

1. **A1** — restaurar un respaldo viejo rompe la aplicación. Es el único bug de
   esta lista que se dispara justamente cuando algo ya salió mal.
2. **B1–B3** — aplicar los DTOs que ya existen. Es poco trabajo y cierra tres 🔴 de
   una vez.
3. **A2, A3, A4** — los tres de `service:save`, que se tocan entre sí.
4. **D1** — el índice único parcial: convierte A3 en algo que no puede volver a
   pasar.
5. **C1** — sacar el `ipcRenderer` genérico y el código muerto que lo sostiene.
6. **E1** — que un error del renderer llegue al log, antes de que haga falta.
7. **J1** — probar los endpoints. Sin esto, la próxima revisión encuentra lo mismo.
