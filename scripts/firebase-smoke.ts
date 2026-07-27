import { randomUUID } from "node:crypto";
import { firebaseAdminApp, firebaseDb } from "../src/lib/server/firebase-admin";

async function main() {
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
