import { dialog, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import { handleIpc, handleIpcQuery } from "../../ipc";
import { escapeLike } from "../../pagination";
import { esIdentificador } from "../../validation";
import { logError } from "../../logger";
import { AppDataSource, getRepositories } from "../dataSource";
import { Document } from "../Entities/document.entity";
import {
  DocumentType,
  formatDocumentNumber,
  type APIResponse,
  type DocumentQueryParams,
  type DocumentSnapshot,
  type SequenceCheck,
  type IssueDocumentBody,
  type IssuedDocument,
} from "../../../src/Types/apiTypes";

const VALID_TYPES = Object.values(DocumentType) as string[];

/**
 * Tope de lo que se acepta como copia impresa, en caracteres del JSON.
 *
 * No es desconfianza del renderer: es que esta tabla no se borra nunca y una
 * copia por documento se acumula para siempre. Doscientos mil caracteres son
 * holgados —un documento con cincuenta renglones y sus repuestos anda por los
 * quince mil— y ponen un techo a lo que puede crecer la base por documento.
 */
const MAXIMO_DE_LA_COPIA = 200_000;

/**
 * Valida la copia de lo impreso que manda el renderer.
 *
 * Se comprueba la forma mínima —que tenga los renglones y los totales— y no
 * cada campo: lo que se guarda es un reflejo de lo que se dibujó, y el que lo
 * arma es el mismo módulo que lo dibuja. Lo que sí importa es que no entre
 * cualquier cosa y que no entre algo enorme.
 */
const copiaValida = (valor: unknown): valor is DocumentSnapshot => {
  if (!valor || typeof valor !== "object") return false;
  const copia = valor as Partial<DocumentSnapshot>;
  if (!Array.isArray(copia.jobs)) return false;
  if (!copia.totals || typeof copia.totals.total !== "number") return false;
  if (!copia.car || typeof copia.car.licensePlate !== "string") return false;
  return JSON.stringify(valor).length <= MAXIMO_DE_LA_COPIA;
};

const toPlainDocument = (doc: Document): IssuedDocument => ({
  id: doc.id,
  type: doc.type,
  number: doc.number,
  formatted: formatDocumentNumber(doc.type, doc.number),
  licensePlate: doc.licensePlate,
  clientName: doc.clientName,
  total: doc.total,
  createdAt:
    doc.createdAt instanceof Date
      ? doc.createdAt.toISOString()
      : new Date(doc.createdAt).toISOString(),
  hasSnapshot: doc.snapshot != null,
});

/**
 * Emite un documento: asigna el siguiente número correlativo de su tipo y
 * guarda el registro (snapshot de patente/titular/total).
 *
 * El `MAX(number) + 1` y el insert van en una **transacción**, y la tabla tiene
 * un índice único `(type, number)`, así que no se pueden repetir números.
 */
handleIpc(
  "document:issue",
  async (
    _event,
    body: IssueDocumentBody
  ): Promise<APIResponse<IssuedDocument>> => {
    if (!body || !VALID_TYPES.includes(body.type)) {
      return { status: "failed", message: "Tipo de documento inválido" };
    }

    // El total es el **snapshot** que queda en el historial, y el registro es de
    // sólo lectura: lo que entre mal acá no se corrige después.
    //
    // Se exige que sea un número y no se convierte: `Number(null)` es `0`, así
    // que con `Number(...) || 0` un total ausente emitía un documento en cero
    // sin decir nada. El renderer manda el resultado de `computeTotals`, que
    // siempre es un número; si llega otra cosa es que algo se rompió antes.
    if (typeof body.total !== "number" || !Number.isFinite(body.total)) {
      return {
        status: "failed",
        message: "El total del documento no es válido",
      };
    }
    const total = Math.round(body.total);
    if (total < 0) {
      return {
        status: "failed",
        message: "El total del documento no es válido",
      };
    }

    // La copia de lo impreso es obligatoria: un documento sin ella es un número
    // en el historial que no se puede volver a imprimir, que es exactamente el
    // agujero que esta columna vino a tapar.
    if (!copiaValida(body.snapshot)) {
      return {
        status: "failed",
        message: "No se pudo registrar el contenido del documento",
      };
    }

    const qr = AppDataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const row = await qr.manager
        .createQueryBuilder(Document, "document")
        .select("MAX(document.number)", "max")
        .where("document.type = :type", { type: body.type })
        .getRawOne<{ max: number | null }>();

      const nextNumber = Number(row?.max ?? 0) + 1;

      const doc = qr.manager.create(Document, {
        type: body.type,
        number: nextNumber,
        licensePlate: body.licensePlate ?? "",
        clientName: body.clientName ?? "",
        total,
        snapshot: body.snapshot,
      });
      const saved = await qr.manager.save(doc);
      await qr.commitTransaction();

      return {
        status: "success",
        message: "Documento emitido correctamente",
        result: toPlainDocument(saved),
      };
    } catch (error) {
      await qr.rollbackTransaction();
      logError("document:issue", error);
      return { status: "failed", message: "No se pudo emitir el documento" };
    } finally {
      await qr.release();
    }
  }
);

/**
 * Descarta un documento emitido. Se usa cuando la generación del PDF falla
 * después de haber tomado el número: sólo borra el registro si es el **último**
 * de su tipo, para no dejar huecos en el correlativo.
 */
handleIpc(
  "document:discard",
  async (_event, id: string): Promise<APIResponse> => {
    if (!esIdentificador(id)) {
      return { status: "failed", message: "Documento no encontrado" };
    }

    const repo = getRepositories().documentRepository;
    const doc = await repo.findOne({ where: { id } });
    if (!doc) {
      return { status: "failed", message: "Documento no encontrado" };
    }

    const row = await repo
      .createQueryBuilder("document")
      .select("MAX(document.number)", "max")
      .where("document.type = :type", { type: doc.type })
      .getRawOne<{ max: number | null }>();

    if (Number(row?.max ?? 0) !== doc.number) {
      return {
        status: "failed",
        message: "No se descarta: ya se emitieron documentos posteriores",
      };
    }

    await repo.remove(doc);
    return {
      status: "success",
      message: "Documento descartado",
      result: undefined,
    };
  }
);

/**
 * Guarda el PDF ya dibujado, preguntando dónde.
 *
 * Antes esto lo hacía `doc.save()` de jsPDF, que es la descarga del navegador:
 * el archivo caía en la carpeta de descargas del sistema sin diálogo, sin
 * poder elegir dónde y —lo que importa— **sin devolver si funcionó**.
 *
 * Las dos cosas estaban mal. Era incoherente con el resto de la aplicación
 * —exportar la base y exportar el CSV preguntan y avisan— justo en la
 * operación más importante. Y como no informaba el resultado, un fallo al
 * escribir no disparaba el descarte del documento, así que el número quedaba
 * quemado sin que existiera ningún PDF.
 *
 * Se escribe a un temporal y se renombra al final, como todo lo que este
 * proyecto escribe en disco: un corte no puede dejar un archivo con nombre de
 * documento emitido y contenido a medias.
 */
handleIpc(
  "document:save-pdf",
  async (
    _event,
    payload: unknown
  ): Promise<APIResponse<{ filePath: string }>> => {
    const datos = (payload ?? {}) as { defaultName?: unknown; bytes?: unknown };
    const nombre =
      typeof datos.defaultName === "string" && datos.defaultName.trim()
        ? datos.defaultName
        : "documento.pdf";
    const bytes = datos.bytes;
    if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
      return { status: "failed", message: "El PDF llegó vacío" };
    }

    const { filePath } = await dialog.showSaveDialog({
      title: "Guardar documento",
      defaultPath: nombre,
      filters: [{ name: "Documento PDF", extensions: ["pdf"] }],
    });

    if (!filePath) {
      return { status: "cancelled", message: "Emisión cancelada" };
    }

    const parcial = `${filePath}.parcial`;
    try {
      fs.writeFileSync(parcial, bytes);
      fs.renameSync(parcial, filePath);
    } catch (error) {
      // Un temporal a medias no se deja tirado.
      try {
        fs.rmSync(parcial, { force: true });
      } catch {
        /* si tampoco se puede borrar, no hay más que hacer */
      }
      logError("document:save-pdf", error, { filePath });
      return {
        status: "failed",
        message: `No se pudo guardar el documento en ${path.dirname(filePath)}`,
      };
    }

    shell.showItemInFolder(filePath);
    return {
      status: "success",
      message: "Documento guardado",
      result: { filePath },
    };
  }
);

/**
 * Un documento con su copia impresa, para volver a generar el PDF.
 *
 * Va aparte del listado a propósito: el historial trae veinte documentos y no
 * tiene por qué arrastrar veinte copias completas. La copia se pide sólo cuando
 * alguien aprieta reimprimir.
 */
handleIpcQuery(
  "document:get",
  "No se pudo leer el documento",
  async (
    _event,
    id: unknown
  ): Promise<
    (IssuedDocument & { snapshot: DocumentSnapshot | null }) | null
  > => {
    if (!esIdentificador(id)) return null;
    const doc = await getRepositories().documentRepository.findOne({
      where: { id },
    });
    if (!doc) return null;
    return { ...toPlainDocument(doc), snapshot: doc.snapshot };
  }
);

/** Cuántos huecos se detallan antes de que el detalle deje de servir. */
const MAXIMO_DE_HUECOS = 50;

/**
 * Comprueba que la numeración no tenga huecos.
 *
 * Toda la maquinaria del correlativo —la transacción, el índice único, el
 * descarte— existe para que no falte ninguno, y no había forma de verificarlo:
 * ni una pantalla, ni un aviso. Un hueco quedaba invisible.
 *
 * Se lee la columna `number` de cada tipo y se camina: son pocos documentos, y
 * esto lo pide una persona cuando quiere revisar, no una pantalla en cada
 * render.
 */
handleIpcQuery(
  "document:check-sequence",
  "No se pudo revisar la numeración",
  async (): Promise<SequenceCheck[]> => {
    const repo = getRepositories().documentRepository;

    return await Promise.all(
      (Object.values(DocumentType) as DocumentType[]).map(async (type) => {
        const filas = await repo
          .createQueryBuilder("document")
          .select("document.number", "number")
          .where("document.type = :type", { type })
          .orderBy("document.number", "ASC")
          .getRawMany<{ number: number }>();

        const numeros = filas.map((f) => Number(f.number));
        const last = numeros.length > 0 ? numeros[numeros.length - 1] : 0;

        // Se camina desde 1 hasta el último: así se detecta tanto un hueco en
        // el medio como que la serie no arranque en 1.
        const missing: number[] = [];
        const presentes = new Set(numeros);
        for (let n = 1; n <= last && missing.length <= MAXIMO_DE_HUECOS; n++) {
          if (!presentes.has(n)) missing.push(n);
        }

        const truncated = missing.length > MAXIMO_DE_HUECOS;
        return {
          type,
          emitted: numeros.length,
          last,
          missing: truncated ? missing.slice(0, MAXIMO_DE_HUECOS) : missing,
          truncated,
        };
      })
    );
  }
);

/** Últimos documentos emitidos de un tipo (historial, más recientes primero). */
handleIpcQuery(
  "document:list",
  "No se pudo cargar el historial de documentos",
  async (_event, filters?: DocumentQueryParams): Promise<IssuedDocument[]> => {
    const repo = getRepositories().documentRepository;

    // Un tipo inválido no se ignora: filtrar por "algo que no existe" tiene que
    // devolver vacío, no el historial completo.
    if (filters?.type !== undefined && !VALID_TYPES.includes(filters.type)) {
      return [];
    }

    const qb = repo.createQueryBuilder("document");

    if (filters?.type !== undefined) {
      qb.andWhere("document.type = :type", { type: filters.type });
    }

    if (filters?.licensePlate) {
      // Pertenencia a la lista, no igualdad.
      //
      // El documento **consolidado** de un cliente guarda todas las patentes en
      // esta columna: `"AB123CD, XY456ZW"`. Con igualdad exacta no salía en el
      // historial de ninguno de los dos autos —sólo en el listado general—, que
      // es justo donde el usuario lo va a buscar.
      //
      // Se rodea la columna y el término con el separador y se compara: así
      // `AB123CD` encuentra la lista que lo contiene y **no** una patente que lo
      // tenga como fragmento. Un `LIKE '%...%'` a secas haría lo segundo.
      qb.andWhere(
        "(', ' || document.licensePlate || ', ') LIKE ('%, ' || :plate || ', %') ESCAPE :esc",
        { plate: escapeLike(filters.licensePlate), esc: "\\" }
      );
    }

    // Orden por fecha y no por número: el correlativo es por tipo, así que al
    // mezclar presupuestos y facturas ordenar por número intercalaría series.
    // Se desempata por número, que dentro de un tipo es único.
    const docs = await qb
      .orderBy("document.createdAt", "DESC")
      .addOrderBy("document.number", "DESC")
      .take(Math.min(Math.max(Number(filters?.limit) || 20, 1), 100))
      .getMany();
    return docs.map(toPlainDocument);
  }
);
