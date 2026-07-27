import { firebaseAuth } from "@/lib/server/firebase-admin";
import { env } from "@/lib/server/env";
import { AppError } from "@/lib/server/errors";

type PasswordSignInResponse = {
  localId: string;
  email: string;
  idToken: string;
  refreshToken: string;
  expiresIn: string;
};

function authenticationUnavailable() {
  return new AppError(
    "FIREBASE_AUTH_NOT_CONFIGURED",
    "Firebase Authentication is not enabled for this project yet.",
    503,
  );
}

function isConfigurationMissing(error: unknown) {
  return (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "auth/configuration-not-found"
  );
}

export async function createFirebasePasswordUser(input: {
  email: string;
  password: string;
  displayName: string;
}) {
  try {
    return await firebaseAuth.createUser({
      email: input.email,
      password: input.password,
      displayName: input.displayName,
      emailVerified: false,
      disabled: false,
    });
  } catch (error) {
    if (isConfigurationMissing(error)) throw authenticationUnavailable();
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "auth/email-already-exists"
    ) {
      throw new AppError(
        "ACCOUNT_EXISTS",
        "An account with this email already exists.",
        409,
      );
    }
    throw error;
  }
}

export async function deleteFirebaseUser(uid: string) {
  try {
    await firebaseAuth.deleteUser(uid);
  } catch {
    // Registration rollback is best effort; no application data references
    // the identity when this cleanup path runs.
  }
}

export async function verifyFirebasePassword(
  email: string,
  password: string,
): Promise<PasswordSignInResponse | null> {
  const apiKey = env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) throw authenticationUnavailable();
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
      cache: "no-store",
    },
  );
  if (response.ok) {
    return (await response.json()) as PasswordSignInResponse;
  }
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  const code = payload?.error?.message?.split(" : ")[0];
  if (code === "CONFIGURATION_NOT_FOUND") throw authenticationUnavailable();
  if (
    [
      "EMAIL_NOT_FOUND",
      "INVALID_PASSWORD",
      "INVALID_LOGIN_CREDENTIALS",
      "USER_DISABLED",
    ].includes(code ?? "")
  ) {
    return null;
  }
  return null;
}

export async function markFirebaseEmailVerified(uid: string) {
  try {
    await firebaseAuth.updateUser(uid, { emailVerified: true });
  } catch (error) {
    if (isConfigurationMissing(error)) throw authenticationUnavailable();
    throw error;
  }
}

export async function updateFirebasePassword(uid: string, password: string) {
  try {
    await firebaseAuth.updateUser(uid, { password });
    await firebaseAuth.revokeRefreshTokens(uid);
  } catch (error) {
    if (isConfigurationMissing(error)) throw authenticationUnavailable();
    throw error;
  }
}
