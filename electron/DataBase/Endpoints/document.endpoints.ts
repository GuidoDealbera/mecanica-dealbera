import { dialog, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import { handleIpc, handleIpcQuery } from "../../ipc";
import { esIdentificador } from "../../validation";
import { logError } from "../../logger";
import { AppDataSource, getRepositories } from "../dataSource";
import { Document } from "../Entities/document.entity";
import {
  DocumentType,
  formatDocumentNumber,
  type APIResponse,
  type DocumentQueryParams,
  type IssueDocumentBody,
  type IssuedDocument,
} from "../../../src/Types/apiTypes";

const VALID_TYPES = Object.values(DocumentType) as string[];

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

/** Últimos documentos emitidos de un tipo (historial, más recientes primero). */
handleIpcQuery(
  "document:list",
  "No se pudo cargar el historial de documentos",
  async (_event, filters?: DocumentQueryParams): Promise<IssuedDocument[]> => {
    const repo = getRepositories().documentRepository;

    const where: { type?: DocumentType; licensePlate?: string } = {};
    // Un tipo inválido no se ignora: filtrar por "algo que no existe" tiene que
    // devolver vacío, no el historial completo.
    if (filters?.type !== undefined) {
      if (!VALID_TYPES.includes(filters.type)) return [];
      where.type = filters.type;
    }
    if (filters?.licensePlate) {
      where.licensePlate = filters.licensePlate;
    }

    // Orden por fecha y no por número: el correlativo es por tipo, así que al
    // mezclar presupuestos y facturas ordenar por número intercalaría series.
    // Se desempata por número, que dentro de un tipo es único.
    const docs = await repo.find({
      where,
      order: { createdAt: "DESC", number: "DESC" },
      take: Math.min(Math.max(Number(filters?.limit) || 20, 1), 100),
    });
    return docs.map(toPlainDocument);
  }
);
