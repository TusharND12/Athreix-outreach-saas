/* eslint-disable @typescript-eslint/no-explicit-any -- This compatibility boundary mirrors Prisma's dynamic delegate argument/result surface. */
import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  Timestamp,
  type DocumentData,
  type Firestore,
  type Query,
  type Transaction,
} from "firebase-admin/firestore";
import { firebaseDb } from "@/lib/server/firebase-admin";

type Row = Record<string, unknown>;
type Args = Record<string, any>;
type Model = (typeof Prisma.dmmf.datamodel.models)[number];
type Field = Model["fields"][number];

type TransactionContext = {
  transaction: Transaction;
  pending: Map<string, Row | null>;
};

const collectionNames: Record<string, string> = {
  User: "users",
  Account: "accounts",
  Session: "sessions",
  VerificationToken: "verificationTokens",
  Workspace: "workspaces",
  WorkspaceMember: "workspaceMembers",
  Subscription: "subscriptions",
  BillingEvent: "billingEvents",
  CreditLedger: "creditLedger",
  Search: "searches",
  SearchJob: "searchJobs",
  Company: "companies",
  Contact: "contacts",
  ConsumerProspect: "consumerProspects",
  SearchResult: "searchResults",
  DataSourceRecord: "dataSourceRecords",
  Evidence: "evidence",
  ConsentRecord: "consentRecords",
  SuppressionEntry: "suppressionEntries",
  DataSubjectRequest: "dataSubjectRequests",
  AIResponse: "aiResponses",
  CompanyResearch: "companyResearch",
  WebsiteAnalysis: "websiteAnalyses",
  BuyingSignal: "buyingSignals",
  CompanyTimelineEvent: "companyTimelineEvents",
  SalesTask: "salesTasks",
  CompanyReport: "companyReports",
  ResearchCache: "researchCache",
  SavedFolder: "savedFolders",
  SavedList: "savedLists",
  SavedListItem: "savedListItems",
  Outreach: "outreach",
  Export: "exports",
  Notification: "notifications",
  AuditLog: "auditLogs",
  UsageLog: "usageLogs",
};

const models = Prisma.dmmf.datamodel.models;
const modelByName = new Map(models.map((model) => [model.name, model]));
const delegateToModel = new Map(
  models.map((model) => [
    `${model.name.charAt(0).toLowerCase()}${model.name.slice(1)}`,
    model,
  ]),
);

function collectionName(model: Model) {
  return collectionNames[model.name] ?? `${model.name.toLowerCase()}Records`;
}

function internalKey(model: Model, documentId: string) {
  return `${collectionName(model)}/${documentId}`;
}

function documentIdOf(model: Model, row: Row) {
  const idField = model.fields.find((field) => field.isId);
  const value = idField ? row[idField.name] : row.__firestoreDocumentId;
  return typeof value === "string" && value ? value : randomUUID();
}

function withoutInternalFields(row: Row) {
  const clean: Row = {};
  for (const [key, value] of Object.entries(row)) {
    if (!key.startsWith("__firestore")) clean[key] = value;
  }
  return clean;
}

function fromFirestore(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate();
  if (Array.isArray(value)) return value.map(fromFirestore);
  if (value && typeof value === "object") {
    const converted: Row = {};
    for (const [key, nested] of Object.entries(value)) {
      converted[key] = fromFirestore(nested);
    }
    return converted;
  }
  return value;
}

function toFirestore(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === Prisma.DbNull || value === Prisma.JsonNull) return null;
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Date) return value;
  if (Array.isArray(value)) {
    return value.map(toFirestore).filter((item) => item !== undefined);
  }
  if (value && typeof value === "object") {
    const converted: Row = {};
    for (const [key, nested] of Object.entries(value)) {
      const serialized = toFirestore(nested);
      if (serialized !== undefined) converted[key] = serialized;
    }
    return converted;
  }
  return value;
}

function prismaError(code: string, message: string, meta?: Row) {
  return new Prisma.PrismaClientKnownRequestError(message, {
    code,
    clientVersion: Prisma.prismaVersion.client,
    meta,
  });
}

function scalarFields(model: Model) {
  return model.fields.filter((field) => field.kind !== "object");
}

function relationFields(model: Model) {
  return model.fields.filter((field) => field.kind === "object");
}

function defaultValue(field: Field): unknown {
  if (!field.hasDefaultValue) return undefined;
  if (
    field.default &&
    typeof field.default === "object" &&
    "name" in field.default
  ) {
    if (field.default.name === "now") return new Date();
    if (["cuid", "uuid", "nanoid"].includes(field.default.name)) {
      return randomUUID();
    }
    return undefined;
  }
  return structuredClone(field.default);
}

function uniqueGroups(model: Model) {
  const groups = model.fields
    .filter((field) => field.isId || field.isUnique)
    .map((field) => [field.name]);
  for (const index of model.uniqueIndexes) groups.push([...index.fields]);
  if (model.primaryKey?.fields?.length)
    groups.push([...model.primaryKey.fields]);
  return groups;
}

function expandCompoundWhere(model: Model, where: Args = {}) {
  const expanded: Args = {};
  for (const [key, value] of Object.entries(where)) {
    const group = uniqueGroups(model).find(
      (fields) => fields.length > 1 && fields.join("_") === key,
    );
    if (group && value && typeof value === "object") {
      Object.assign(expanded, value);
    } else {
      expanded[key] = value;
    }
  }
  return expanded;
}

function comparable(value: unknown) {
  if (value instanceof Date) return value.getTime();
  return value;
}

function scalarMatches(actual: unknown, condition: unknown): boolean {
  if (
    !condition ||
    typeof condition !== "object" ||
    condition instanceof Date ||
    Array.isArray(condition)
  ) {
    return comparable(actual) === comparable(condition);
  }

  const operators = condition as Args;
  if ("equals" in operators && !scalarMatches(actual, operators.equals)) {
    return false;
  }
  if (
    "in" in operators &&
    (!Array.isArray(operators.in) ||
      !operators.in.some((value: unknown) => scalarMatches(actual, value)))
  ) {
    return false;
  }
  if (
    "notIn" in operators &&
    Array.isArray(operators.notIn) &&
    operators.notIn.some((value: unknown) => scalarMatches(actual, value))
  ) {
    return false;
  }
  if ("not" in operators && scalarMatches(actual, operators.not)) return false;

  const left = comparable(actual) as any;
  if ("lt" in operators && !(left < (comparable(operators.lt) as any)))
    return false;
  if ("lte" in operators && !(left <= (comparable(operators.lte) as any)))
    return false;
  if ("gt" in operators && !(left > (comparable(operators.gt) as any)))
    return false;
  if ("gte" in operators && !(left >= (comparable(operators.gte) as any)))
    return false;

  const caseInsensitive = operators.mode === "insensitive";
  const text = String(actual ?? "");
  const normalized = caseInsensitive ? text.toLowerCase() : text;
  const operand = (key: string) => {
    const value = String(operators[key] ?? "");
    return caseInsensitive ? value.toLowerCase() : value;
  };
  if ("contains" in operators && !normalized.includes(operand("contains"))) {
    return false;
  }
  if (
    "startsWith" in operators &&
    !normalized.startsWith(operand("startsWith"))
  ) {
    return false;
  }
  if ("endsWith" in operators && !normalized.endsWith(operand("endsWith"))) {
    return false;
  }

  const list = Array.isArray(actual) ? actual : [];
  if (
    "has" in operators &&
    !list.some((item) => scalarMatches(item, operators.has))
  ) {
    return false;
  }
  if (
    "hasSome" in operators &&
    (!Array.isArray(operators.hasSome) ||
      !operators.hasSome.some((item: unknown) =>
        list.some((value) => scalarMatches(value, item)),
      ))
  ) {
    return false;
  }
  if (
    "hasEvery" in operators &&
    (!Array.isArray(operators.hasEvery) ||
      !operators.hasEvery.every((item: unknown) =>
        list.some((value) => scalarMatches(value, item)),
      ))
  ) {
    return false;
  }
  if (
    "isEmpty" in operators &&
    Boolean(operators.isEmpty) !== (list.length === 0)
  ) {
    return false;
  }
  return true;
}

function sortRows(rows: Row[], orderBy: Args | Args[] | undefined) {
  const clauses = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
  if (!clauses.length) return rows;
  return [...rows].sort((left, right) => {
    for (const clause of clauses) {
      const [field, specification] = Object.entries(clause)[0] ?? [];
      if (!field) continue;
      const direction =
        typeof specification === "string"
          ? specification
          : ((specification as Args | undefined)?.sort ?? "asc");
      const a = comparable(left[field]);
      const b = comparable(right[field]);
      if (a === b) continue;
      if (a === null || a === undefined) return direction === "asc" ? -1 : 1;
      if (b === null || b === undefined) return direction === "asc" ? 1 : -1;
      const result = a! < b! ? -1 : 1;
      return direction === "desc" ? -result : result;
    }
    return 0;
  });
}

function applyUpdate(model: Model, current: Row, data: Args) {
  const next = { ...current };
  for (const field of scalarFields(model)) {
    const incoming = data[field.name];
    if (incoming === undefined) continue;
    if (
      incoming &&
      typeof incoming === "object" &&
      !(incoming instanceof Date) &&
      !Array.isArray(incoming)
    ) {
      if ("set" in incoming) next[field.name] = incoming.set;
      else if ("increment" in incoming) {
        next[field.name] =
          Number(next[field.name] ?? 0) + Number(incoming.increment);
      } else if ("decrement" in incoming) {
        next[field.name] =
          Number(next[field.name] ?? 0) - Number(incoming.decrement);
      } else if ("multiply" in incoming) {
        next[field.name] =
          Number(next[field.name] ?? 0) * Number(incoming.multiply);
      } else if ("divide" in incoming) {
        next[field.name] =
          Number(next[field.name] ?? 0) / Number(incoming.divide);
      } else if ("push" in incoming) {
        const values = Array.isArray(incoming.push)
          ? incoming.push
          : [incoming.push];
        const existing = Array.isArray(next[field.name])
          ? (next[field.name] as unknown[])
          : [];
        next[field.name] = [...existing, ...values];
      } else {
        next[field.name] = incoming;
      }
    } else {
      next[field.name] = incoming;
    }
  }
  for (const field of scalarFields(model)) {
    if (field.isUpdatedAt) next[field.name] = new Date();
  }
  return next;
}

function prepareCreate(model: Model, data: Args) {
  const row: Row = {};
  for (const field of scalarFields(model)) {
    const incoming = data[field.name];
    if (incoming !== undefined) {
      row[field.name] = incoming;
      continue;
    }
    const generated = defaultValue(field);
    if (generated !== undefined) row[field.name] = generated;
    else if (field.isUpdatedAt) row[field.name] = new Date();
    else if (field.isList) row[field.name] = [];
  }
  return row;
}

class FirestorePrismaRuntime {
  private readonly delegateCache = new Map<string, Args>();

  constructor(
    private readonly firestore: Firestore,
    private readonly context?: TransactionContext,
  ) {}

  asClient(): PrismaClient {
    return new Proxy(this as unknown as PrismaClient, {
      get: (_target, property) => {
        if (property === "$transaction") return this.transaction.bind(this);
        if (property === "$connect" || property === "$disconnect") {
          return async () => undefined;
        }
        if (typeof property !== "string") return undefined;
        const model = delegateToModel.get(property);
        if (!model) return undefined;
        const cached = this.delegateCache.get(property);
        if (cached) return cached;
        const delegate = this.createDelegate(model);
        this.delegateCache.set(property, delegate);
        return delegate;
      },
    });
  }

  private delegateName(model: Model) {
    return `${model.name.charAt(0).toLowerCase()}${model.name.slice(1)}`;
  }

  private createDelegate(model: Model) {
    return {
      findUnique: (args: Args) => this.findUnique(model, args),
      findUniqueOrThrow: (args: Args) => this.findUniqueOrThrow(model, args),
      findFirst: (args: Args) => this.findFirst(model, args),
      findFirstOrThrow: (args: Args) => this.findFirstOrThrow(model, args),
      findMany: (args: Args = {}) => this.findMany(model, args),
      count: (args: Args = {}) => this.count(model, args),
      aggregate: (args: Args = {}) => this.aggregate(model, args),
      groupBy: (args: Args) => this.groupBy(model, args),
      create: (args: Args) => this.runWrite(model, "create", args),
      createMany: (args: Args) => this.runWrite(model, "createMany", args),
      update: (args: Args) => this.runWrite(model, "update", args),
      updateMany: (args: Args) => this.runWrite(model, "updateMany", args),
      upsert: (args: Args) => this.runWrite(model, "upsert", args),
      delete: (args: Args) => this.runWrite(model, "delete", args),
      deleteMany: (args: Args = {}) => this.runWrite(model, "deleteMany", args),
    };
  }

  private async runWrite(model: Model, method: string, args: Args) {
    if (this.context) {
      return (this as any)[method](model, args);
    }
    return this.transaction(async (client) => {
      return (client as any)[this.delegateName(model)][method](args);
    });
  }

  private async transaction<T>(
    input: ((client: PrismaClient) => Promise<T>) | Array<Promise<unknown>>,
  ): Promise<T> {
    if (Array.isArray(input)) return (await Promise.all(input)) as T;
    if (this.context) return input(this.asClient());
    return this.firestore.runTransaction(async (transaction) => {
      const context: TransactionContext = {
        transaction,
        pending: new Map(),
      };
      const runtime = new FirestorePrismaRuntime(this.firestore, context);
      const result = await input(runtime.asClient());
      for (const [key, row] of context.pending) {
        const separator = key.indexOf("/");
        const collection = key.slice(0, separator);
        const documentId = key.slice(separator + 1);
        const reference = this.firestore.collection(collection).doc(documentId);
        if (row === null) transaction.delete(reference);
        else {
          transaction.set(
            reference,
            toFirestore(withoutInternalFields(row)) as DocumentData,
          );
        }
      }
      return result;
    });
  }

  private async readQuery(
    model: Model,
    query: Query<DocumentData>,
  ): Promise<Row[]> {
    const snapshot = this.context
      ? await this.context.transaction.get(query)
      : await query.get();
    const rows = new Map<string, Row>();
    for (const document of snapshot.docs) {
      rows.set(document.id, {
        ...(fromFirestore(document.data()) as Row),
        __firestoreDocumentId: document.id,
      });
    }
    if (this.context) {
      const prefix = `${collectionName(model)}/`;
      for (const [key, pending] of this.context.pending) {
        if (!key.startsWith(prefix)) continue;
        const documentId = key.slice(prefix.length);
        if (pending === null) rows.delete(documentId);
        else rows.set(documentId, { ...pending });
      }
    }
    return [...rows.values()];
  }

  private async readAll(model: Model) {
    return this.readQuery(
      model,
      this.firestore.collection(collectionName(model)),
    );
  }

  private async readCandidates(model: Model, rawWhere: Args = {}) {
    const where = expandCompoundWhere(model, rawWhere);
    const fields = new Set(scalarFields(model).map((field) => field.name));
    const preferred = [
      "workspaceId",
      "searchId",
      "userId",
      "listId",
      "companyId",
      "contactId",
      "consumerId",
      "id",
      ...Object.keys(where),
    ];
    for (const key of preferred) {
      if (!fields.has(key) || !(key in where)) continue;
      const condition = where[key];
      if (condition === undefined) continue;
      const collection = this.firestore.collection(collectionName(model));
      if (
        condition === null ||
        typeof condition === "string" ||
        typeof condition === "number" ||
        typeof condition === "boolean" ||
        condition instanceof Date
      ) {
        return this.readQuery(model, collection.where(key, "==", condition));
      }
      if (
        condition &&
        typeof condition === "object" &&
        "equals" in condition &&
        condition.equals !== undefined
      ) {
        return this.readQuery(
          model,
          collection.where(key, "==", condition.equals),
        );
      }
      if (
        condition &&
        typeof condition === "object" &&
        Array.isArray(condition.in)
      ) {
        if (!condition.in.length) return [];
        if (condition.in.length <= 30) {
          return this.readQuery(
            model,
            collection.where(key, "in", condition.in),
          );
        }
      }
    }
    return this.readAll(model);
  }

  private async resolveRelation(model: Model, row: Row, field: Field) {
    const target = modelByName.get(field.type);
    if (!target) return field.isList ? [] : null;
    if (field.relationFromFields?.length) {
      const where: Args = {};
      field.relationFromFields.forEach((from, index) => {
        const to = field.relationToFields?.[index];
        if (to) where[to] = row[from];
      });
      if (
        Object.values(where).some(
          (value) => value === null || value === undefined,
        )
      ) {
        return field.isList ? [] : null;
      }
      const related = await this.filteredRows(target, where);
      return field.isList ? related : (related[0] ?? null);
    }

    const opposite = relationFields(target).find(
      (candidate) =>
        candidate.type === model.name &&
        candidate.relationName === field.relationName &&
        candidate.relationFromFields?.length,
    );
    if (!opposite) return field.isList ? [] : null;
    const where: Args = {};
    (opposite.relationFromFields ?? []).forEach((from, index) => {
      const sourceField = opposite.relationToFields?.[index];
      if (sourceField) where[from] = row[sourceField];
    });
    const related = await this.filteredRows(target, where);
    return field.isList ? related : (related[0] ?? null);
  }

  private async matchesWhere(model: Model, row: Row, rawWhere: Args = {}) {
    const where = expandCompoundWhere(model, rawWhere);
    for (const [key, condition] of Object.entries(where)) {
      if (key === "AND") {
        const clauses = Array.isArray(condition) ? condition : [condition];
        for (const clause of clauses) {
          if (!(await this.matchesWhere(model, row, clause ?? {})))
            return false;
        }
        continue;
      }
      if (key === "OR") {
        const clauses = Array.isArray(condition) ? condition : [condition];
        let matched = false;
        for (const clause of clauses) {
          if (await this.matchesWhere(model, row, clause ?? {})) {
            matched = true;
            break;
          }
        }
        if (!matched) return false;
        continue;
      }
      if (key === "NOT") {
        const clauses = Array.isArray(condition) ? condition : [condition];
        for (const clause of clauses) {
          if (await this.matchesWhere(model, row, clause ?? {})) return false;
        }
        continue;
      }

      const relation = relationFields(model).find(
        (field) => field.name === key,
      );
      if (!relation) {
        if (!scalarMatches(row[key], condition)) return false;
        continue;
      }

      const related = await this.resolveRelation(model, row, relation);
      const relationCondition = (condition ?? {}) as Args;
      if (relation.isList) {
        const values = Array.isArray(related) ? related : [];
        const target = modelByName.get(relation.type)!;
        if (
          "some" in relationCondition &&
          !(await this.anyMatches(target, values, relationCondition.some ?? {}))
        ) {
          return false;
        }
        if (
          "none" in relationCondition &&
          (await this.anyMatches(target, values, relationCondition.none ?? {}))
        ) {
          return false;
        }
        if (
          "every" in relationCondition &&
          !(await this.everyMatches(
            target,
            values,
            relationCondition.every ?? {},
          ))
        ) {
          return false;
        }
      } else {
        const target = modelByName.get(relation.type)!;
        if (relationCondition === null) {
          if (related !== null) return false;
        } else if ("is" in relationCondition) {
          if (
            !related ||
            !(await this.matchesWhere(
              target,
              related as Row,
              relationCondition.is ?? {},
            ))
          ) {
            return false;
          }
        } else if ("isNot" in relationCondition) {
          if (
            related &&
            (await this.matchesWhere(
              target,
              related as Row,
              relationCondition.isNot ?? {},
            ))
          ) {
            return false;
          }
        } else if (
          !related ||
          !(await this.matchesWhere(target, related as Row, relationCondition))
        ) {
          return false;
        }
      }
    }
    return true;
  }

  private async anyMatches(model: Model, rows: Row[], where: Args) {
    for (const row of rows) {
      if (await this.matchesWhere(model, row, where)) return true;
    }
    return false;
  }

  private async everyMatches(model: Model, rows: Row[], where: Args) {
    for (const row of rows) {
      if (!(await this.matchesWhere(model, row, where))) return false;
    }
    return true;
  }

  private async filteredRows(model: Model, where: Args = {}) {
    const rows = await this.readCandidates(model, where);
    const filtered: Row[] = [];
    for (const row of rows) {
      if (await this.matchesWhere(model, row, where)) filtered.push(row);
    }
    return filtered;
  }

  private async projectRow(model: Model, row: Row, args: Args = {}) {
    const base = withoutInternalFields(row);
    const selection = args.select as Args | undefined;
    const inclusion = args.include as Args | undefined;
    if (!selection && !inclusion) return base;

    const output: Row = selection ? {} : { ...base };
    const shape = selection ?? inclusion ?? {};
    for (const [key, specification] of Object.entries(shape)) {
      if (!specification) continue;
      if (key === "_count") {
        output._count = await this.relationCounts(model, row, specification);
        continue;
      }
      const relation = relationFields(model).find(
        (field) => field.name === key,
      );
      if (!relation) {
        if (selection) output[key] = base[key];
        continue;
      }
      const target = modelByName.get(relation.type)!;
      const related = await this.resolveRelation(model, row, relation);
      const nestedArgs = specification === true ? {} : (specification as Args);
      if (relation.isList) {
        let values = Array.isArray(related) ? related : [];
        if (nestedArgs.where) {
          const matched: Row[] = [];
          for (const value of values) {
            if (await this.matchesWhere(target, value, nestedArgs.where)) {
              matched.push(value);
            }
          }
          values = matched;
        }
        values = sortRows(values, nestedArgs.orderBy);
        const skip = Math.max(0, Number(nestedArgs.skip ?? 0));
        const take =
          nestedArgs.take === undefined
            ? values.length
            : Math.max(0, Number(nestedArgs.take));
        values = values.slice(skip, skip + take);
        output[key] = await Promise.all(
          values.map((value) => this.projectRow(target, value, nestedArgs)),
        );
      } else {
        output[key] = related
          ? await this.projectRow(target, related as Row, nestedArgs)
          : null;
      }
    }
    return output;
  }

  private async relationCounts(model: Model, row: Row, specification: unknown) {
    const countSelection =
      specification === true
        ? Object.fromEntries(
            relationFields(model)
              .filter((field) => field.isList)
              .map((field) => [field.name, true]),
          )
        : ((specification as Args)?.select ?? {});
    const counts: Row = {};
    for (const [key, nested] of Object.entries(countSelection)) {
      if (!nested) continue;
      const relation = relationFields(model).find(
        (field) => field.name === key,
      );
      if (!relation) continue;
      const target = modelByName.get(relation.type)!;
      const related = await this.resolveRelation(model, row, relation);
      let values = Array.isArray(related)
        ? related
        : related
          ? [related as Row]
          : [];
      const where = nested === true ? undefined : (nested as Args).where;
      if (where) {
        const matched: Row[] = [];
        for (const value of values) {
          if (await this.matchesWhere(target, value, where))
            matched.push(value);
        }
        values = matched;
      }
      counts[key] = values.length;
    }
    return counts;
  }

  private async findMany(model: Model, args: Args = {}) {
    let rows = await this.filteredRows(model, args.where ?? {});
    rows = sortRows(rows, args.orderBy);
    if (Array.isArray(args.distinct)) {
      const seen = new Set<string>();
      rows = rows.filter((row) => {
        const key = JSON.stringify(
          args.distinct.map((field: string) => row[field]),
        );
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    const skip = Math.max(0, Number(args.skip ?? 0));
    if (args.cursor) {
      const cursor = expandCompoundWhere(model, args.cursor);
      const index = rows.findIndex((row) =>
        Object.entries(cursor).every(([key, value]) =>
          scalarMatches(row[key], value),
        ),
      );
      if (index >= 0) rows = rows.slice(index + skip);
    } else {
      rows = rows.slice(skip);
    }
    if (args.take !== undefined) {
      const take = Number(args.take);
      rows = take < 0 ? rows.slice(take).reverse() : rows.slice(0, take);
    }
    return Promise.all(rows.map((row) => this.projectRow(model, row, args)));
  }

  private async findUnique(model: Model, args: Args) {
    const where = expandCompoundWhere(model, args.where ?? {});
    const idField = model.fields.find((field) => field.isId);
    if (
      idField &&
      typeof where[idField.name] === "string" &&
      Object.keys(where).length === 1
    ) {
      const documentId = where[idField.name];
      const key = internalKey(model, documentId);
      const pending = this.context?.pending.get(key);
      if (pending === null) return null;
      if (pending) return this.projectRow(model, pending, args);
      const reference = this.firestore
        .collection(collectionName(model))
        .doc(documentId);
      const snapshot = this.context
        ? await this.context.transaction.get(reference)
        : await reference.get();
      if (!snapshot.exists) return null;
      const row = {
        ...(fromFirestore(snapshot.data()!) as Row),
        __firestoreDocumentId: snapshot.id,
      };
      return this.projectRow(model, row, args);
    }
    const rows = await this.filteredRows(model, where);
    return rows[0] ? this.projectRow(model, rows[0], args) : null;
  }

  private async findUniqueOrThrow(model: Model, args: Args) {
    const row = await this.findUnique(model, args);
    if (!row) throw prismaError("P2025", `${model.name} was not found.`);
    return row;
  }

  private async findFirst(model: Model, args: Args) {
    const rows = await this.findMany(model, { ...args, take: 1 });
    return rows[0] ?? null;
  }

  private async findFirstOrThrow(model: Model, args: Args) {
    const row = await this.findFirst(model, args);
    if (!row) throw prismaError("P2025", `${model.name} was not found.`);
    return row;
  }

  private async count(model: Model, args: Args = {}) {
    return (await this.filteredRows(model, args.where ?? {})).length;
  }

  private async aggregate(model: Model, args: Args) {
    const rows = await this.filteredRows(model, args.where ?? {});
    const result: Args = {};
    for (const operation of ["_sum", "_avg", "_min", "_max"] as const) {
      if (!args[operation]) continue;
      result[operation] = {};
      for (const field of Object.keys(args[operation])) {
        const values = rows
          .map((row) => row[field])
          .filter((value) => value !== null && value !== undefined) as any[];
        if (!values.length) result[operation][field] = null;
        else if (operation === "_sum") {
          result[operation][field] = values.reduce(
            (sum, value) => sum + Number(value),
            0,
          );
        } else if (operation === "_avg") {
          result[operation][field] =
            values.reduce((sum, value) => sum + Number(value), 0) /
            values.length;
        } else if (operation === "_min") {
          result[operation][field] = values.reduce((a, b) =>
            comparable(a)! < comparable(b)! ? a : b,
          );
        } else {
          result[operation][field] = values.reduce((a, b) =>
            comparable(a)! > comparable(b)! ? a : b,
          );
        }
      }
    }
    if (args._count) {
      result._count =
        args._count === true
          ? rows.length
          : Object.fromEntries(
              Object.keys(args._count).map((field) => [
                field,
                rows.filter(
                  (row) => row[field] !== null && row[field] !== undefined,
                ).length,
              ]),
            );
    }
    return result;
  }

  private async groupBy(model: Model, args: Args) {
    const rows = await this.filteredRows(model, args.where ?? {});
    const fields = args.by as string[];
    const groups = new Map<string, Row[]>();
    for (const row of rows) {
      const key = JSON.stringify(fields.map((field) => row[field]));
      const group = groups.get(key) ?? [];
      group.push(row);
      groups.set(key, group);
    }
    let output: Row[] = [];
    for (const group of groups.values()) {
      const record: Args = Object.fromEntries(
        fields.map((field) => [field, group[0]![field]]),
      );
      if (args._count) {
        record._count =
          args._count === true
            ? group.length
            : Object.fromEntries(
                Object.keys(args._count).map((field) => [
                  field,
                  group.filter(
                    (row) => row[field] !== null && row[field] !== undefined,
                  ).length,
                ]),
              );
      }
      for (const operation of ["_sum", "_avg", "_min", "_max"]) {
        if (!args[operation]) continue;
        record[operation] = {};
        for (const field of Object.keys(args[operation])) {
          const values = group
            .map((row) => row[field])
            .filter((value) => value !== null && value !== undefined) as any[];
          if (!values.length) record[operation][field] = null;
          else if (operation === "_sum") {
            record[operation][field] = values.reduce(
              (sum, value) => sum + Number(value),
              0,
            );
          } else if (operation === "_avg") {
            record[operation][field] =
              values.reduce((sum, value) => sum + Number(value), 0) /
              values.length;
          } else if (operation === "_min") {
            record[operation][field] = values.reduce((a, b) =>
              comparable(a)! < comparable(b)! ? a : b,
            );
          } else {
            record[operation][field] = values.reduce((a, b) =>
              comparable(a)! > comparable(b)! ? a : b,
            );
          }
        }
      }
      output.push(record);
    }
    output = sortRows(output, args.orderBy);
    if (args.skip) output = output.slice(Number(args.skip));
    if (args.take !== undefined) output = output.slice(0, Number(args.take));
    return output;
  }

  private queue(model: Model, row: Row | null, documentId: string) {
    if (!this.context) {
      throw new Error("Firestore writes must run inside a transaction.");
    }
    this.context.pending.set(internalKey(model, documentId), row);
  }

  private async enforceUnique(
    model: Model,
    row: Row,
    excludeDocumentId?: string,
  ) {
    for (const fields of uniqueGroups(model)) {
      if (
        fields.some((field) => row[field] === null || row[field] === undefined)
      ) {
        continue;
      }
      const where = Object.fromEntries(
        fields.map((field) => [field, row[field]]),
      );
      const candidates = await this.filteredRows(model, where);
      const conflict = candidates.find(
        (candidate) =>
          documentIdOf(model, candidate) !== excludeDocumentId &&
          fields.every((field) => scalarMatches(candidate[field], row[field])),
      );
      if (conflict) {
        throw prismaError(
          "P2002",
          `Unique constraint failed on ${model.name}.${fields.join(",")}.`,
          { modelName: model.name, target: fields },
        );
      }
    }
  }

  private async create(model: Model, args: Args) {
    const data = args.data ?? {};
    const row = prepareCreate(model, data);
    const documentId = documentIdOf(model, row);
    row.__firestoreDocumentId = documentId;
    await this.enforceUnique(model, row);
    this.queue(model, row, documentId);
    await this.createNestedRelations(model, row, data);
    return this.projectRow(model, row, args);
  }

  private async createNestedRelations(model: Model, row: Row, data: Args) {
    for (const relation of relationFields(model)) {
      const nested = data[relation.name];
      if (!nested || typeof nested !== "object") continue;

      if (nested.connect && relation.relationFromFields?.length) {
        relation.relationFromFields.forEach((from, index) => {
          const to = relation.relationToFields?.[index];
          if (to) row[from] = nested.connect[to];
        });
      }

      const requested = [
        ...(nested.create
          ? Array.isArray(nested.create)
            ? nested.create
            : [nested.create]
          : []),
        ...(nested.createMany?.data
          ? Array.isArray(nested.createMany.data)
            ? nested.createMany.data
            : [nested.createMany.data]
          : []),
      ];
      if (!requested.length) continue;
      const target = modelByName.get(relation.type);
      if (!target) continue;
      const opposite = relationFields(target).find(
        (candidate) =>
          candidate.type === model.name &&
          candidate.relationName === relation.relationName &&
          candidate.relationFromFields?.length,
      );
      for (const nestedData of requested) {
        const childData = { ...nestedData };
        if (opposite) {
          (opposite.relationFromFields ?? []).forEach((from, index) => {
            const parentField = opposite.relationToFields?.[index];
            if (parentField) childData[from] = row[parentField];
          });
        }
        await this.create(target, { data: childData });
      }
    }
  }

  private async createMany(model: Model, args: Args) {
    const data = Array.isArray(args.data) ? args.data : [args.data];
    let count = 0;
    for (const item of data) {
      try {
        await this.create(model, { data: item });
        count += 1;
      } catch (error) {
        if (
          args.skipDuplicates &&
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          continue;
        }
        throw error;
      }
    }
    return { count };
  }

  private async rawUnique(model: Model, where: Args) {
    const rows = await this.filteredRows(
      model,
      expandCompoundWhere(model, where),
    );
    return rows[0] ?? null;
  }

  private async update(model: Model, args: Args) {
    const current = await this.rawUnique(model, args.where ?? {});
    if (!current) throw prismaError("P2025", `${model.name} was not found.`);
    const documentId = documentIdOf(model, current);
    const next = applyUpdate(model, current, args.data ?? {});
    next.__firestoreDocumentId = documentId;
    await this.enforceUnique(model, next, documentId);
    this.queue(model, next, documentId);
    return this.projectRow(model, next, args);
  }

  private async updateMany(model: Model, args: Args) {
    const rows = await this.filteredRows(model, args.where ?? {});
    for (const current of rows) {
      const documentId = documentIdOf(model, current);
      const next = applyUpdate(model, current, args.data ?? {});
      next.__firestoreDocumentId = documentId;
      await this.enforceUnique(model, next, documentId);
      this.queue(model, next, documentId);
    }
    return { count: rows.length };
  }

  private async upsert(model: Model, args: Args) {
    const current = await this.rawUnique(model, args.where ?? {});
    return current
      ? this.update(model, {
          where: args.where,
          data: args.update,
          select: args.select,
          include: args.include,
        })
      : this.create(model, {
          data: args.create,
          select: args.select,
          include: args.include,
        });
  }

  private async cascadeDelete(model: Model, row: Row) {
    for (const target of models) {
      for (const relation of relationFields(target)) {
        if (
          relation.type !== model.name ||
          !relation.relationFromFields?.length
        ) {
          continue;
        }
        const where: Args = {};
        relation.relationFromFields.forEach((from, index) => {
          const parentField = relation.relationToFields?.[index];
          if (parentField) where[from] = row[parentField];
        });
        const dependents = await this.filteredRows(target, where);
        if (!dependents.length) continue;
        if (relation.relationOnDelete === "Cascade") {
          for (const dependent of dependents) {
            await this.deleteRow(target, dependent);
          }
        } else if (relation.relationOnDelete === "SetNull") {
          for (const dependent of dependents) {
            const data = Object.fromEntries(
              relation.relationFromFields.map((field) => [field, null]),
            );
            const idField = target.fields.find((field) => field.isId);
            if (idField) {
              await this.update(target, {
                where: { [idField.name]: dependent[idField.name] },
                data,
              });
            }
          }
        }
      }
    }
  }

  private async deleteRow(model: Model, row: Row) {
    await this.cascadeDelete(model, row);
    this.queue(model, null, documentIdOf(model, row));
  }

  private async delete(model: Model, args: Args) {
    const current = await this.rawUnique(model, args.where ?? {});
    if (!current) throw prismaError("P2025", `${model.name} was not found.`);
    await this.deleteRow(model, current);
    return this.projectRow(model, current, args);
  }

  private async deleteMany(model: Model, args: Args) {
    const rows = await this.filteredRows(model, args.where ?? {});
    for (const row of rows) await this.deleteRow(model, row);
    return { count: rows.length };
  }
}

export function createFirestorePrismaClient(
  firestore: Firestore = firebaseDb,
): PrismaClient {
  return new FirestorePrismaRuntime(firestore).asClient();
}
