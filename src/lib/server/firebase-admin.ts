import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const defaultProjectId = "athreix-outreach-saas";
const defaultStorageBucket = "athreix-outreach-saas.firebasestorage.app";

function configuredCredentialFileIsMissing() {
  const configuredPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!configuredPath) return false;
  const absolutePath = path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(process.cwd(), configuredPath);
  return !existsSync(absolutePath);
}

function parseServiceAccount(raw: string): ServiceAccount {
  const parsed = JSON.parse(raw) as {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };
  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new Error("The Firebase service account JSON is incomplete.");
  }
  return {
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    privateKey: parsed.private_key.replace(/\\n/g, "\n"),
  };
}

function localServiceAccount(): ServiceAccount | null {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (inline) return parseServiceAccount(inline);

  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64?.trim();
  if (encoded) {
    return parseServiceAccount(Buffer.from(encoded, "base64").toString("utf8"));
  }

  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return {
      projectId: process.env.FIREBASE_PROJECT_ID ?? defaultProjectId,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    };
  }

  const configuredPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ||
    path.join(process.cwd(), ".athreix", "firebase-admin.json");
  const absolutePath = path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(process.cwd(), configuredPath);
  if (!existsSync(absolutePath)) return null;
  return parseServiceAccount(readFileSync(absolutePath, "utf8"));
}

function initializeFirebaseAdmin(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  const projectId = process.env.FIREBASE_PROJECT_ID ?? defaultProjectId;
  const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET ?? defaultStorageBucket;
  const serviceAccount = localServiceAccount();

  return initializeApp({
    projectId,
    storageBucket,
    credential: serviceAccount ? cert(serviceAccount) : applicationDefault(),
  });
}

export const firebaseAdminApp = initializeFirebaseAdmin();
export const firebaseAuth = getAuth(firebaseAdminApp);
export const firebaseDb = getFirestore(firebaseAdminApp);
export const firebaseStorage = getStorage(firebaseAdminApp);

const globalForFirebase = globalThis as typeof globalThis & {
  athreixFirestoreSettingsApplied?: boolean;
};
if (!globalForFirebase.athreixFirestoreSettingsApplied) {
  firebaseDb.settings({ ignoreUndefinedProperties: true });
  globalForFirebase.athreixFirestoreSettingsApplied = true;
}

export async function firebaseIsReachable() {
  if (configuredCredentialFileIsMissing()) return false;
  try {
    await firebaseDb.doc("_system/connectivity").get();
    return true;
  } catch {
    return false;
  }
}

export async function firebaseAuthIsReachable() {
  if (configuredCredentialFileIsMissing()) return false;
  try {
    await firebaseAuth.listUsers(1);
    return true;
  } catch {
    return false;
  }
}

export async function firebaseStorageIsReachable() {
  if (configuredCredentialFileIsMissing()) return false;
  try {
    const [exists] = await firebaseStorage.bucket().exists();
    return exists;
  } catch {
    return false;
  }
}
