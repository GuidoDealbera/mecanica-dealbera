# Cómo trabajar en este proyecto

Esto es corto a propósito. Lo que hay que saber de verdad está en
[CLAUDE.md](CLAUDE.md), y no es documentación de cortesía: **cada regla de ese
archivo costó una sesión de depuración**. Leerlo antes de tocar algo ahorra
repetirlas.

## Antes de empezar

```bash
npm install          # necesita el .npmrc del repo: ver CLAUDE.md
npm run dev
```

Si `npm install` falla, la respuesta está en CLAUDE.md, en "Trampas del
entorno". No bajar la versión de `better-sqlite3`.

## Antes de commitear

```bash
npm run verify       # tipos → lint → formato → tests → build del renderer
```

Es lo mismo que corre GitHub Actions en cada push. Corta en el primero que falla.

Para ver dónde falta cobertura:

```bash
npm run test:coverage
```

Los umbrales están puestos apenas por debajo de lo medido, como trinquete: si
bajan, algo se destapó.

## Las ramas

```
feat/*  →  develop  →  main
```

`main` **es la rama de publicación**: cada push dispara el build del instalador.
El trabajo se integra en `develop` y `main` recibe un solo merge cuando hay algo
para publicar, con la versión de `package.json` subida.

## Publicar una versión

1. Subir `version` en `package.json`.
2. Agregar la sección al [CHANGELOG](CHANGELOG.md) con el mismo número. **Sin
   ella el flujo falla**, y a propósito: la aplicación muestra esas notas en el
   cartel de actualización, y un release mudo es lo que se estaba tratando de
   evitar.
3. Merge a `main`.

El flujo hace el resto: arma el release **en borrador**, sube los tres archivos,
comprueba que el `sha512` de `latest.yml` corresponda al `.exe`, y recién ahí lo
publica. Si algo falla queda un borrador, que nadie ve y que el próximo intento
reutiliza; el motivo de cada una de esas tres cosas está en CLAUDE.md, y las
tres se aprendieron publicando mal la 2.0.0 y la 2.1.0.

Para reintentar un release que quedó a medias **no hace falta borrar nada**:
volver a pushear a `main` alcanza, porque el guard mira si está completo.

## Cómo se escribe acá

- **Comentarios y mensajes de commit en español.** Explicando _por qué_, no
  _qué_: si el comentario repite el código, sobra.
- **Un test que no se comprobó que falle no es un test**, es una expectativa.
  Antes de dar por bueno un caso nuevo, romper el código a propósito y verlo
  fallar. En este plan pasó más de una vez que un caso pasaba igual con el
  arreglo sacado.
- **Medir antes de optimizar.** Varias tareas del plan se cerraron con "medido,
  no se cambia" porque los números no daban: está bien, y queda escrito con los
  números al lado.
- **Las reglas de negocio se validan en el backend.** La interfaz puede
  anticiparlas, pero la que cuenta es la del endpoint: un canal IPC recibe lo que
  le manden.

## Dónde está el mapa

- [CLAUDE.md](CLAUDE.md) — las convenciones y las trampas.
- [PLAN_MEJORAS_V2.md](PLAN_MEJORAS_V2.md) — las 85 tareas de la revisión, con lo
  que se hizo, lo que se descartó y por qué. Cuando algo del código parezca raro,
  lo más probable es que ahí esté la explicación.
