import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { loadEnvFile } from "node:process";

async function main() {
  if (existsSync(".env.local")) loadEnvFile(".env.local");

  const hasInlineCredentials = Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 ||
    (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY),
  );
  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (
    !hasInlineCredentials &&
    credentialPath &&
    !existsSync(path.resolve(process.cwd(), credentialPath))
  ) {
    throw new Error(
      `Firebase Admin credential not found at ${credentialPath}. Add the organization service-account JSON there, then rerun pnpm firebase:smoke.`,
    );
  }

  const { firebaseAdminApp, firebaseDb } =
    await import("../src/lib/server/firebase-admin");
  const id = randomUUID();
  const reference = firebaseDb.collection("_system_smoke").doc(id);

  try {
    await reference.set({
      id,
      purpose: "firebase-connectivity-check",
      createdAt: new Date(),
    });
    const snapshot = await reference.get();
    if (!snapshot.exists || snapshot.get("id") !== id) {
      throw new Error("Firestore did not return the smoke-test record.");
    }
    console.log(
      JSON.stringify({
        reachable: true,
        projectId: firebaseAdminApp.options.projectId,
        cleanup: "complete",
      }),
    );
  } finally {
    await reference.delete().catch(() => undefined);
  }
}

void main();
