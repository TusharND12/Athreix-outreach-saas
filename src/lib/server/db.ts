import type { PrismaClient } from "@prisma/client";
import { firebaseIsReachable } from "@/lib/server/firebase-admin";
import { createFirestorePrismaClient } from "@/lib/server/firestore-prisma";

const globalForFirestore = globalThis as unknown as {
  firestorePrisma?: PrismaClient;
};

export const db =
  globalForFirestore.firestorePrisma ?? createFirestorePrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForFirestore.firestorePrisma = db;
}

export const databaseIsReachable = firebaseIsReachable;
