import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { stringify } from "csv-stringify/sync";
import { db } from "@/lib/server/db";
import { AppError } from "@/lib/server/errors";
import { firebaseStorage } from "@/lib/server/firebase-admin";
import {
  LEAD_COLUMN_DEFINITIONS,
  LEAD_COLUMN_KEYS,
  type LeadColumnKey,
  type LeadRecord,
} from "@/lib/leads/columns";
import type { RequestContext } from "@/server/auth-context";
import type { z } from "zod";
import type { exportSchema } from "@/server/schemas";
import { demoState } from "@/server/demo-store";
import { serializeDatabaseResult } from "@/server/search-service";
import { writeAudit } from "@/server/audit";
import { Prisma } from "@prisma/client";

type ExportInput = z.infer<typeof exportSchema>;

type CoreExportRow = {
  name: string;
  subjectType: string;
  title?: string;
  company?: string;
  industry?: string;
  location?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  website?: string;
  score: number;
  buyingIntent: string;
  consentStatus?: string;
  summary?: string;
  sourceProvider?: string;
  sourceUrl?: string;
};
type ExportRow = CoreExportRow & LeadRecord;
type ExportColumn = keyof CoreExportRow | LeadColumnKey;

type ExportBatch = {
  rows: ExportRow[];
  exclusions: {
    candidates: number;
    excludedByPolicy: number;
  };
};

const crmColumnNames: Record<keyof CoreExportRow, string> = {
  name: "Full Name",
  subjectType: "Record Type",
  title: "Job Title",
  company: "Company",
  industry: "Industry",
  location: "Location",
  email: "Email",
  phone: "Phone",
  linkedin: "LinkedIn URL",
  website: "Company Website",
  score: "Lead Score",
  buyingIntent: "Buying Intent",
  consentStatus: "Consent Status",
  summary: "AI Summary",
  sourceProvider: "Source Provider",
  sourceUrl: "Evidence URL",
};
const leadColumnNames = new Map<LeadColumnKey, string>(
  LEAD_COLUMN_DEFINITIONS.map((column) => [column.key, column.label]),
);

function exportColumnName(column: ExportColumn) {
  return (
    crmColumnNames[column as keyof CoreExportRow] ??
    leadColumnNames.get(column as LeadColumnKey) ??
    column
  );
}

const defaultFields = [
  "PROFILE",
  "COMPANY_OR_AUDIENCE",
  "CONTACT",
  "LEAD_DATA",
  "AI_ANALYSIS",
  "PROVENANCE",
] as const;

export function exportColumns(fields: ExportInput["fields"]): ExportColumn[] {
  const selected = new Set(fields ?? defaultFields);
  return Array.from(
    new Set<ExportColumn>([
      ...(selected.has("LEAD_DATA") ? LEAD_COLUMN_KEYS : []),
      ...(selected.has("PROFILE")
        ? (["name", "subjectType", "title", "location"] as const)
        : []),
      ...(selected.has("COMPANY_OR_AUDIENCE")
        ? (["company", "industry", "website"] as const)
        : []),
      ...(selected.has("CONTACT")
        ? (["email", "phone", "linkedin"] as const)
        : []),
      ...(selected.has("AI_ANALYSIS")
        ? (["score", "buyingIntent", "summary"] as const)
        : []),
      ...(selected.has("PROVENANCE")
        ? (["consentStatus", "sourceProvider", "sourceUrl"] as const)
        : []),
    ]),
  );
}

export function neutralizeSpreadsheetFormula(value: unknown) {
  if (typeof value !== "string") return value;
  return /^\s*[=+\-@]/.test(value) ? `'${value}` : value;
}

export function explicitNullForMissingValue(value: unknown) {
  return value === undefined || value === null || value === "" ? null : value;
}

function selectAndSanitizeRows(
  rows: ExportRow[],
  selectedColumns: ExportColumn[],
): Array<Partial<Record<ExportColumn, unknown>>> {
  return rows.map(
    (row) =>
      Object.fromEntries(
        selectedColumns.map((column) => [
          column,
          neutralizeSpreadsheetFormula(
            explicitNullForMissingValue(row[column]),
          ),
        ]),
      ) as Partial<Record<ExportColumn, unknown>>,
  );
}

async function rowsForExport(
  context: RequestContext,
  input: ExportInput,
): Promise<ExportBatch> {
  if (input.listId) {
    let grouped: Map<string, string[]>;
    if (context.demo) {
      const list = demoState.lists.find((item) => item.id === input.listId);
      if (!list) throw new AppError("NOT_FOUND", "Saved list not found.", 404);
      grouped = new Map();
      for (const result of demoState.results.filter((item) =>
        list.resultIds.includes(item.id),
      )) {
        const ids = grouped.get(result.searchId) ?? [];
        ids.push(result.id);
        grouped.set(result.searchId, ids);
      }
    } else {
      const list = await db.savedList.findFirst({
        where: { id: input.listId, workspaceId: context.workspaceId },
        include: {
          items: {
            where: { resultId: { not: null } },
            include: { result: { select: { id: true, searchId: true } } },
          },
        },
      });
      if (!list) throw new AppError("NOT_FOUND", "Saved list not found.", 404);
      grouped = new Map();
      for (const item of list.items) {
        if (!item.result) continue;
        const ids = grouped.get(item.result.searchId) ?? [];
        ids.push(item.result.id);
        grouped.set(item.result.searchId, ids);
      }
    }
    const requested = input.selectedIds?.length
      ? new Set(input.selectedIds)
      : null;
    const batches = await Promise.all(
      [...grouped.entries()].map(([searchId, ids]) =>
        rowsForExport(context, {
          ...input,
          listId: undefined,
          searchId,
          selectedIds: requested ? ids.filter((id) => requested.has(id)) : ids,
        }),
      ),
    );
    return {
      rows: batches.flatMap((batch) => batch.rows),
      exclusions: {
        candidates: batches.reduce(
          (sum, batch) => sum + batch.exclusions.candidates,
          0,
        ),
        excludedByPolicy: batches.reduce(
          (sum, batch) => sum + batch.exclusions.excludedByPolicy,
          0,
        ),
      },
    };
  }
  const searchId = input.searchId;
  if (!searchId) {
    throw new AppError(
      "VALIDATION_ERROR",
      "A search or saved list is required.",
      422,
    );
  }
  if (context.demo) {
    const search = demoState.searches.find((item) => item.id === searchId);
    if (!search) throw new AppError("NOT_FOUND", "Search not found.", 404);
    if (search.mode === "B2C" && !["OWNER", "ADMIN"].includes(context.role)) {
      throw new AppError(
        "FORBIDDEN",
        "Administrator access is required for consumer-data exports.",
        403,
      );
    }
    const candidates = demoState.results.filter(
      (row) =>
        row.searchId === searchId &&
        (!input.selectedIds?.length || input.selectedIds.includes(row.id)) &&
        row.score >= (input.minScore ?? 0),
    );
    const rows = candidates
      .filter(
        (row) =>
          !row.isSuppressed &&
          (!input.onlyVerified || row.status === "verified") &&
          (row.mode !== "B2C" || row.consentStatus === "GRANTED") &&
          new Date(search.retentionUntil) > new Date(),
      )
      .map((row) => ({
        ...row.leadFields,
        name: row.name,
        subjectType: row.mode === "B2C" ? "consumer" : "professional_contact",
        title: row.title,
        company: row.company,
        industry: row.industry,
        location: row.location,
        email: row.email,
        phone: row.phone,
        linkedin: row.linkedin,
        website: row.website,
        score: row.score,
        buyingIntent: row.buyingIntent,
        consentStatus: row.consentStatus,
        summary: row.summary,
        sourceProvider: row.evidence[0]?.provider,
        sourceUrl: row.evidence[0]?.sourceUrl,
      }));
    return {
      rows,
      exclusions: {
        candidates: candidates.length,
        excludedByPolicy: candidates.length - rows.length,
      },
    };
  }
  const search = await db.search.findFirst({
    where: { id: searchId, workspaceId: context.workspaceId },
  });
  if (!search) throw new AppError("NOT_FOUND", "Search not found.", 404);
  if (search.mode === "B2C" && !["OWNER", "ADMIN"].includes(context.role)) {
    throw new AppError(
      "FORBIDDEN",
      "Administrator access is required for consumer-data exports.",
      403,
    );
  }
  const now = new Date();
  const baseWhere = {
    searchId,
    score: { gte: input.minScore ?? 0 },
    ...(input.selectedIds?.length ? { id: { in: input.selectedIds } } : {}),
  };
  const policyConditions: Prisma.SearchResultWhereInput[] = [
    { retentionUntil: { gt: now } },
    search.mode === "B2C"
      ? {
          consumer: {
            consentStatus: { in: ["GRANTED", "NOT_REQUIRED"] },
            ...(search.lawfulBasis === "CONSENT"
              ? {
                  consentRecords: {
                    some: {
                      status: "GRANTED",
                      purpose: search.purpose,
                      capturedAt: { lte: now },
                      withdrawnAt: null,
                      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
                    },
                  },
                }
              : {}),
          },
        }
      : { contactId: { not: null } },
  ];
  if (input.onlyVerified) {
    policyConditions.push({
      OR: [
        { contact: { emailVerification: "VERIFIED" } },
        { consumer: { emailVerification: "VERIFIED" } },
        { consumer: { phoneVerification: "VERIFIED" } },
      ],
    });
  }
  const candidateCount = await db.searchResult.count({ where: baseWhere });
  const rows = await db.searchResult.findMany({
    where: {
      ...baseWhere,
      isSuppressed: false,
      AND: policyConditions,
    },
    include: {
      search: true,
      company: true,
      contact: true,
      consumer: { include: { consentRecords: true } },
      aiResponses: true,
    },
    orderBy: { score: "desc" },
    take: 1_000,
  });
  const exportRows = rows.map((row) => {
    const item = serializeDatabaseResult(
      row,
      input.fields
        ? input.fields.some((field) => ["CONTACT", "LEAD_DATA"].includes(field))
        : true,
    );
    const currentPermissions = new Set(
      row.consumer?.consentRecords
        .filter(
          (record) =>
            record.status === "GRANTED" &&
            record.purpose === search.purpose &&
            record.capturedAt <= now &&
            !record.withdrawnAt &&
            (!record.expiresAt || record.expiresAt > now) &&
            record.channel,
        )
        .map((record) => record.channel) ?? [],
    );
    const consentBasedConsumer = Boolean(row.consumer);
    return {
      ...item.leadFields,
      name: item.name,
      subjectType: item.subjectType,
      title: item.title ?? undefined,
      company: item.company ?? undefined,
      industry: item.industry ?? undefined,
      location: item.location ?? undefined,
      email:
        consentBasedConsumer && !currentPermissions.has("EMAIL")
          ? undefined
          : (item.email ?? undefined),
      phone:
        consentBasedConsumer && !currentPermissions.has("PHONE")
          ? undefined
          : (item.phone ?? undefined),
      linkedin: item.linkedin ?? undefined,
      website: item.website ?? undefined,
      score: item.score,
      buyingIntent: item.buyingIntent,
      consentStatus: row.consumer
        ? currentPermissions.size
          ? "GRANTED"
          : "REVIEW_REQUIRED"
        : undefined,
      summary: item.summary ?? undefined,
      sourceProvider: item.sourceProvider,
      sourceUrl: item.sourceUrl,
    };
  });
  return {
    rows: exportRows,
    exclusions: {
      candidates: candidateCount,
      excludedByPolicy: candidateCount - exportRows.length,
    },
  };
}

async function renderFile(
  format: ExportInput["format"],
  rows: ExportRow[],
  selectedColumns: ExportColumn[],
) {
  if (format === "JSON") {
    const selectedRows = rows.map((row) =>
      Object.fromEntries(
        selectedColumns.map((column) => [
          column,
          explicitNullForMissingValue(row[column]),
        ]),
      ),
    );
    return Buffer.from(JSON.stringify(selectedRows, null, 2), "utf8");
  }
  const safeRows = selectAndSanitizeRows(rows, selectedColumns);
  if (format === "CRM") {
    const crmRows = safeRows.map((row) =>
      Object.fromEntries(
        selectedColumns.map((column) => [
          exportColumnName(column),
          row[column],
        ]),
      ),
    );
    return Buffer.from(stringify(crmRows, { header: true }), "utf8");
  }
  if (format === "CSV") {
    return Buffer.from(
      stringify(safeRows, { header: true, columns: selectedColumns }),
      "utf8",
    );
  }
  if (format === "PDF" || format === "AI_REPORT") {
    return renderPdfReport(safeRows, selectedColumns, format === "AI_REPORT");
  }
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Athreix Prospect AI";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Prospects", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = selectedColumns.map((key) => ({
    header: key,
    key,
    width: key === "summary" ? 48 : 22,
  }));
  sheet.addRows(safeRows);
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF111111" },
  };
  sheet.autoFilter = {
    from: "A1",
    to: `${excelColumnName(selectedColumns.length)}${rows.length + 1}`,
  };
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function excelColumnName(index: number) {
  let value = Math.max(1, Math.trunc(index));
  let output = "";
  while (value > 0) {
    value -= 1;
    output = String.fromCharCode(65 + (value % 26)) + output;
    value = Math.floor(value / 26);
  }
  return output;
}

function printable(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "")
    .trim();
}

function wrappedLines(
  text: string,
  font: PDFFont,
  size: number,
  width: number,
) {
  const words = printable(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

async function renderPdfReport(
  rows: Array<Partial<Record<ExportColumn, unknown>>>,
  selectedColumns: ExportColumn[],
  executive: boolean,
) {
  const document = await PDFDocument.create();
  document.setTitle(
    executive
      ? "Athreix AI Lead Intelligence Report"
      : "Athreix Prospect Export",
  );
  document.setAuthor("Athreix Lead Intelligence");
  document.setCreationDate(new Date());
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const medium = await document.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [595.28, 841.89];
  const margin = 46;
  let page = document.addPage(pageSize);
  let y = pageSize[1] - margin;
  const ink = rgb(0.08, 0.08, 0.09);
  const muted = rgb(0.38, 0.38, 0.42);
  const amber = rgb(0.96, 0.65, 0.12);
  const addPage = () => {
    page = document.addPage(pageSize);
    y = pageSize[1] - margin;
  };
  const drawText = (
    text: string,
    options: {
      font?: PDFFont;
      size?: number;
      color?: ReturnType<typeof rgb>;
      indent?: number;
      gap?: number;
    } = {},
  ) => {
    const font = options.font ?? regular;
    const size = options.size ?? 9;
    const indent = options.indent ?? 0;
    const lineHeight = size * 1.42;
    for (const line of wrappedLines(
      text,
      font,
      size,
      pageSize[0] - margin * 2 - indent,
    )) {
      if (y < margin + lineHeight) addPage();
      page.drawText(line, {
        x: margin + indent,
        y,
        size,
        font,
        color: options.color ?? ink,
      });
      y -= lineHeight;
    }
    y -= options.gap ?? 0;
  };

  page.drawRectangle({
    x: 0,
    y: pageSize[1] - 8,
    width: pageSize[0],
    height: 8,
    color: amber,
  });
  drawText(
    executive ? "AI LEAD INTELLIGENCE REPORT" : "PROSPECT INTELLIGENCE EXPORT",
    { font: medium, size: 17, gap: 8 },
  );
  drawText(
    `${rows.length} evidence-aware records | Generated ${new Date().toISOString()}`,
    { color: muted, size: 8, gap: 18 },
  );
  if (executive) {
    drawText("Executive brief", { font: medium, size: 11, gap: 4 });
    drawText(
      "This report ranks the selected opportunities and preserves the supporting source context. Scores and AI summaries are decision support, not verified facts; review the evidence before outreach.",
      { color: muted, size: 9, gap: 16 },
    );
  }

  rows.forEach((row, index) => {
    if (y < 150) addPage();
    const heading = printable(
      row.company
        ? `${index + 1}. ${row.company}${row.name ? ` - ${row.name}` : ""}`
        : `${index + 1}. ${row.name ?? "Prospect"}`,
    );
    drawText(heading, { font: medium, size: 11, gap: 5 });
    for (const column of selectedColumns) {
      const value = row[column];
      if (value === undefined || value === "") continue;
      drawText(`${exportColumnName(column)}: ${printable(value)}`, {
        color: column === "summary" ? ink : muted,
        size: column === "summary" ? 9 : 8,
        indent: 8,
        gap: 2,
      });
    }
    y -= 9;
  });

  const pages = document.getPages();
  pages.forEach((current, index) => {
    current.drawText(`Athreix | ${index + 1} / ${pages.length}`, {
      x: margin,
      y: 22,
      size: 7,
      font: regular,
      color: muted,
    });
  });
  return Buffer.from(await document.save());
}

export async function createExport(
  context: RequestContext,
  input: ExportInput,
  idempotencyKey?: string,
) {
  if (!context.demo && idempotencyKey) {
    const existing = await db.export.findFirst({
      where: {
        workspaceId: context.workspaceId,
        createdById: context.userId,
        idempotencyKey,
      },
      select: { id: true },
    });
    if (existing) {
      throw new AppError(
        "IDEMPOTENT_REPLAY",
        "This export request was already completed.",
        409,
        { exportId: existing.id },
      );
    }
  }
  const { rows, exclusions } = await rowsForExport(context, input);
  if (!rows.length)
    throw new AppError(
      "NO_EXPORTABLE_RESULTS",
      "No eligible records match this export.",
      422,
    );
  const id = `export-${crypto.randomUUID()}`;
  const extension = {
    CSV: "csv",
    XLSX: "xlsx",
    JSON: "json",
    PDF: "pdf",
    CRM: "csv",
    AI_REPORT: "pdf",
  }[input.format];
  const fileStem =
    input.format === "AI_REPORT"
      ? "athreix-ai-intelligence-report"
      : input.format === "CRM"
        ? "athreix-crm-import"
        : "athreix-prospects";
  const filename = `${fileStem}-${new Date().toISOString().slice(0, 10)}.${extension}`;
  const selectedColumns = exportColumns(input.fields);
  const containsConsumerData = rows.some(
    (row) => row.subjectType === "consumer",
  );
  const file = await renderFile(input.format, rows, selectedColumns);
  const mimeType =
    input.format === "CSV" || input.format === "CRM"
      ? "text/csv; charset=utf-8"
      : input.format === "JSON"
        ? "application/json; charset=utf-8"
        : input.format === "PDF" || input.format === "AI_REPORT"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  if (context.demo) {
    demoState.exports.unshift({
      id,
      searchId: input.searchId,
      listId: input.listId,
      format: input.format,
      status: "READY",
      recordCount: rows.length,
      createdAt: new Date().toISOString(),
    });
  } else {
    await db.export.create({
      data: {
        id,
        workspaceId: context.workspaceId,
        createdById: context.userId,
        searchId: input.searchId,
        format: input.format,
        status: "PROCESSING",
        idempotencyKey,
        filters: {
          minScore: input.minScore,
          onlyVerified: input.onlyVerified,
          fields: input.fields ?? defaultFields,
          listId: input.listId,
          containsConsumerData,
          lawfulUseAcknowledged: true,
        },
        selectedIds: input.selectedIds ?? [],
        recordCount: rows.length,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  }
  await writeAudit({
    workspaceId: context.workspaceId,
    actorId: context.userId,
    action: "export.create",
    entityType: "export",
    entityId: id,
    metadata: {
      format: input.format,
      recordCount: rows.length,
      searchId: input.searchId,
      listId: input.listId,
      fields: input.fields ?? defaultFields,
      ...exclusions,
    },
  });

  let retained = false;
  if (!context.demo) {
    const path = `${context.workspaceId}/${id}/${filename}`;
    try {
      await firebaseStorage
        .bucket()
        .file(path)
        .save(file, {
          contentType: mimeType,
          resumable: false,
          metadata: {
            cacheControl: "private, max-age=0, no-store",
            metadata: {
              workspaceId: context.workspaceId,
              exportId: id,
            },
          },
          preconditionOpts: { ifGenerationMatch: 0 },
        });
      retained = true;
      await db.export.update({
        where: { id },
        data: {
          status: "READY",
          storagePath: path,
          signedUrl: null,
          errorCode: null,
        },
      });
    } catch (error) {
      await db.export.update({
        where: { id },
        data: {
          status: "FAILED",
          errorCode: "STORAGE_UPLOAD_FAILED",
          storagePath: null,
          signedUrl: null,
        },
      });
      console.warn(
        "Export retention failed; the immediate response remains available",
        error instanceof Error ? error.message : "unknown storage error",
      );
    }
  }
  return { id, rows: rows.length, filename, mimeType, file, retained };
}

export async function listExports(
  context: RequestContext,
  page = 1,
  pageSize = 25,
) {
  if (context.demo)
    return {
      data: demoState.exports.slice((page - 1) * pageSize, page * pageSize),
      total: demoState.exports.length,
    };
  const where = {
    workspaceId: context.workspaceId,
    ...(["OWNER", "ADMIN"].includes(context.role)
      ? {}
      : { createdById: context.userId }),
  };
  const [data, total] = await db.$transaction([
    db.export.findMany({
      where,
      select: {
        id: true,
        searchId: true,
        format: true,
        status: true,
        recordCount: true,
        expiresAt: true,
        errorCode: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.export.count({ where }),
  ]);
  return { data, total };
}

export async function getExportDownload(context: RequestContext, id: string) {
  if (context.demo) {
    throw new AppError(
      "DOWNLOAD_NOT_STORED",
      "Demo exports are downloaded when they are generated and are not retained.",
      404,
    );
  }
  const item = await db.export.findFirst({
    where: { id, workspaceId: context.workspaceId },
    include: { search: { select: { mode: true } } },
  });
  if (!item) throw new AppError("NOT_FOUND", "Export not found.", 404);
  const filters =
    item.filters &&
    typeof item.filters === "object" &&
    !Array.isArray(item.filters)
      ? (item.filters as Record<string, unknown>)
      : {};
  const containsConsumerData =
    item.search?.mode === "B2C" || filters.containsConsumerData === true;
  if (
    (item.createdById !== context.userId || containsConsumerData) &&
    !["OWNER", "ADMIN"].includes(context.role)
  ) {
    throw new AppError(
      "FORBIDDEN",
      containsConsumerData
        ? "Administrator access is required to download consumer-data exports."
        : "Only the export creator or a workspace administrator can download this file.",
      403,
    );
  }
  if (item.status !== "READY" || !item.storagePath) {
    throw new AppError(
      "DOWNLOAD_NOT_READY",
      "This export is not available for download.",
      409,
    );
  }
  if (!item.expiresAt || item.expiresAt <= new Date()) {
    throw new AppError("EXPORT_EXPIRED", "This export has expired.", 410);
  }
  let signedUrl: string;
  try {
    [signedUrl] = await firebaseStorage
      .bucket()
      .file(item.storagePath)
      .getSignedUrl({
        action: "read",
        expires: Date.now() + 5 * 60 * 1_000,
      });
  } catch {
    throw new AppError(
      "STORAGE_UNAVAILABLE",
      "The export download could not be prepared.",
      503,
    );
  }
  await writeAudit({
    workspaceId: context.workspaceId,
    actorId: context.userId,
    action: "export.download",
    entityType: "export",
    entityId: id,
    metadata: { mode: item.search?.mode, shortLivedUrlSeconds: 300 },
  });
  return signedUrl;
}

export async function deleteExport(context: RequestContext, id: string) {
  if (context.demo) {
    const index = demoState.exports.findIndex((item) => item.id === id);
    if (index < 0) throw new AppError("NOT_FOUND", "Export not found.", 404);
    demoState.exports.splice(index, 1);
    return;
  }
  const item = await db.export.findFirst({
    where: { id, workspaceId: context.workspaceId },
  });
  if (!item) throw new AppError("NOT_FOUND", "Export not found.", 404);
  if (
    item.createdById !== context.userId &&
    !["OWNER", "ADMIN"].includes(context.role)
  ) {
    throw new AppError(
      "FORBIDDEN",
      "Only the export creator or an administrator can delete it.",
      403,
    );
  }
  if (item.storagePath) {
    try {
      await firebaseStorage
        .bucket()
        .file(item.storagePath)
        .delete({ ignoreNotFound: true });
    } catch {
      throw new AppError(
        "STORAGE_UNAVAILABLE",
        "The export could not be deleted safely.",
        503,
      );
    }
  }
  await db.export.delete({ where: { id } });
  await writeAudit({
    workspaceId: context.workspaceId,
    actorId: context.userId,
    action: "export.delete",
    entityType: "export",
    entityId: id,
  });
}
