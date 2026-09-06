# Convenciones del proyecto

Reglas que se aprendieron rompiendo cosas. Están acá porque ninguna es evidente
leyendo el código: cada una costó una sesión de depuración.

El plan de trabajo vivo está en [PLAN_MEJORAS.md](PLAN_MEJORAS.md).

## Cómo se verifica

```bash
npm run verify     # tipos → lint → formato → tests → build del renderer
```

Corta en el primero que falla. Es lo mismo que ejecuta GitHub Actions en cada
push (`.github/workflows/verify.yml`). El instalador lo arma `release.yml` sólo
en `main`.

Para probar contra datos de verdad sin tocar la base del usuario:

```bash
MECANICA_DATA_DIR=<carpeta>  # dónde viven la base y los respaldos
MECANICA_LEGACY_DB=<archivo> # simula la base vieja, para probar el traslado
```

---

## Arquitectura

### El dominio compartido recibe el `EntityManager` por parámetro

`serviceReminders.service.ts`, `dashboardStats.service.ts`,
`migrationSafety.ts`, `backups.ts` y `dataLocation.ts` **no importan Electron**
ni `AppDataSource`: reciben el manager o las rutas que necesitan.

Dos razones, las dos prácticas: se pueden ejercitar contra una copia de la base
con un script, y se les puede pasar el manager de una transacción en curso —que
es lo que hace que cerrar un service y guardar el trabajo sean **un solo
hecho**—.

### Los thunks **resuelven** con `status: "failed"`

Sólo rechazan si falla la llamada IPC. Un rechazo de negocio llega como una
resolución exitosa, así que **una pantalla que sólo mira si la promesa resolvió
va a mostrar "guardado con éxito" sin haber guardado nada**. Ya pasó.

Para eso está `ensureSuccess` (`src/Utils/apiResponse.ts`): convierte la
respuesta en un `throw` con el mensaje del backend. Usarlo en la capa de
presentación y mostrar el motivo real, no un error genérico.

### Las reglas de negocio se validan en el backend

La interfaz puede anticiparlas para evitar un ida y vuelta, pero la validación
que cuenta es la del endpoint. Vale para las acciones de los recordatorios, la
elegibilidad de trabajos en un documento y los datos del próximo service.

---

## Base de datos

### Paginar: `offset/limit` o `skip/take`, según los joins

La regla completa, con la evidencia medida, está arriba de `resolvePage()` en
[`electron/pagination.ts`](electron/pagination.ts). En corto:

- **Todos los joins `*-a-uno`** → `.offset().limit()`. Una consulta menos.
- **Algún join `a-muchos`** → `.skip().take()`. Con `offset/limit`, pedir 8
  clientes devuelve 4 y al último le faltan vehículos.

Y **el orden tiene que terminar en una columna única**. Si no, el desempate lo
decide el plan de ejecución y cambia solo al agregar un índice.

### `COUNT(*)`, no `COUNT(columna)`

El PK es un uuid, no el rowid de SQLite: nombrar la columna obliga a leer la
fila entera. Con un índice presente, el conteo por estado pasaba de 1,1 ms a
88 ms. Son equivalentes porque el PK nunca es NULL.

### Copiar una base: `VACUUM INTO`, nunca `copyFileSync`

Copiar el archivo puede capturarlo a mitad de una escritura o sin el journal que
necesita. `VACUUM INTO` hace que el motor escriba una base nueva y consistente.
Se usa en la copia previa a migraciones, en el respaldo diario, en la
exportación manual y en el traslado de la base.

Y siempre: escribir a un temporal y renombrar al final. Un corte no puede dejar
un archivo con nombre de copia buena y contenido incompleto.

### Migrar toca datos: la red va antes

Las migraciones **no** corren al conectar. Las lanza `initializeDB`: copia
previa, migración, `integrity_check`. Si no se puede sacar la copia, la
aplicación no arranca.

Al escribir una migración que reescribe datos, filtrar por el resultado de la
conversión: `strftime` devuelve NULL ante un texto que no entiende, y sin ese
filtro se vacía una columna `NOT NULL`.

### Dónde viven los datos

- Base viva: `userData` (`%APPDATA%/mecanica-dealbera`). Fuera de la vista y del
  alcance de OneDrive, que puede bloquear el archivo mientras SQLite escribe.
- Respaldos: `Documentos/backups`. Ahí sí tienen que estar: son lo que el
  usuario busca para copiar a un pendrive.

---

## Interfaz

### HeroUI invierte las escalas numéricas entre temas

`text-success-300` se ve lavado en un tema y pesado en el otro. Usar **tokens
base con transparencia**: `text-success`, `bg-warning/10`, `border-primary/40`.

La fuente de verdad de la paleta es `hero.ts`.

### Un contenedor que scrollea no maquetea

Si el elemento con `overflow-y-auto` es además `flex flex-col`, sus hijos con
`overflow-hidden` tienen mínimo automático 0 y **se comprimen** en vez de
desbordar: las Cards quedan en una tira ilegible. El scroller va afuera y la
maquetación en un wrapper interno.

Por lo mismo, `min-h-0` en los hijos flex que tengan que poder achicarse.

Y ojo con el borde superior: un hijo pegado al borde de un contenedor que
recorta **pierde su sombra**. Por eso el cuerpo de `PageShell` lleva `pt-1`.

### `PageShell` es el contenedor estándar

Cabecera fija, cuerpo que scrollea, pie opcional. Las pantallas nuevas van con
`PageShell`, no con un `div` a mano.

### Limpiar las suscripciones IPC

`window.api.onDataChanged` y los listeners del auto-updater devuelven (o
necesitan) su baja. Sin eso se acumula un listener por montaje, y en desarrollo
`StrictMode` monta dos veces. Ya se pagó una vez con los avisos duplicados del
updater.

---

## Trampas del entorno

### `ELECTRON_RUN_AS_NODE`

El host de extensiones de VS Code define esta variable. Cualquier binario de
Electron lanzado desde ahí corre como **Node puro**, y entonces el especificador
`electron` resuelve al paquete de npm —que exporta la ruta del binario, no la
API—: fallan todos los imports nombrados.

El error apunta al formato del módulo y manda a investigar Vite, el `type` del
`package.json` y la versión de Electron, que no tienen nada que ver. **Antes de
lanzar Electron desde un script, limpiar esa variable.**

### Finales de línea: LF siempre

El repositorio guarda LF, pero en Windows `core.autocrlf=true` convierte a CRLF
al hacer checkout. Da igual mientras se programa y rompe el CI: el runner
también es Windows, y `prettier --check` —que espera LF— rechaza **todos** los
archivos. Pasó: 162 archivos marcados, con tipos y lint pasando.

Lo resuelve `.gitattributes` con `* text=auto eol=lf`. No cambiarlo, y no
"arreglarlo" poniendo `endOfLine: "auto"` en Prettier: eso aceptaría CRLF en vez
de impedirlo.

### `npm install` falla sin `.npmrc`

`typeorm` declara `sqlite3@^5` como peer y el proyecto usa el 6. El `.npmrc` con
`legacy-peer-deps=true` está justamente para eso.

---

## Estilo

- **Comentarios en español**, explicando _por qué_ y no _qué_. Si un comentario
  se limita a repetir el código, sobra; si documenta una decisión o una trampa,
  vale oro.
- **Mensajes de commit en español**, contando el problema antes que la solución.
  Sin `Co-Authored-By` y sin mencionar que se verificó con tests.
- Los módulos puros de `src/Utils/` son los únicos con tests hoy. Cualquier
  regla de negocio nueva conviene que viva ahí.
