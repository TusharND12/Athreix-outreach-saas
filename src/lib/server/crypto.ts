import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";
import { env } from "@/lib/server/env";
import { AppError } from "@/lib/server/errors";

function encryptionKey(): Buffer {
  if (!env.ENCRYPTION_KEY) {
    if (!env.demoMode) {
      throw new AppError(
        "ENCRYPTION_NOT_CONFIGURED",
        "Sensitive-data encryption is not configured.",
        503,
      );
    }
    return createHash("sha256").update(env.AUTH_SECRET).digest();
  }

  const value = env.ENCRYPTION_KEY;
  if (/^[0-9a-f]{64}$/i.test(value)) return Buffer.from(value, "hex");
  try {
    const decoded = Buffer.from(value, "base64");
    if (decoded.length === 32) return decoded;
  } catch {
    // Fall back to a one-way key derivation for passphrase-style keys.
  }
  return createHash("sha256").update(value).digest();
}

export function encryptSensitive(plainText: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSensitive(value: string): string {
  const [version, ivValue, tagValue, encryptedValue] = value.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) {
    throw new AppError(
      "INVALID_CIPHERTEXT",
      "The encrypted value is invalid.",
      500,
    );
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function hashIdentifier(value: string): string {
  return createHmac("sha256", encryptionKey())
    .update(value.trim().toLowerCase())
    .digest("hex");
}

export function hashEmail(value: string): string {
  return hashIdentifier(value.trim().toLowerCase());
}

type PhoneRegion = { callingCode: string; nationalLengths: number[] };

const phoneRegions: Record<string, PhoneRegion> = {
  in: { callingCode: "91", nationalLengths: [10] },
  india: { callingCode: "91", nationalLengths: [10] },
  us: { callingCode: "1", nationalLengths: [10] },
  usa: { callingCode: "1", nationalLengths: [10] },
  "united states": { callingCode: "1", nationalLengths: [10] },
  ca: { callingCode: "1", nationalLengths: [10] },
  canada: { callingCode: "1", nationalLengths: [10] },
  gb: { callingCode: "44", nationalLengths: [9, 10] },
  uk: { callingCode: "44", nationalLengths: [9, 10] },
  "united kingdom": { callingCode: "44", nationalLengths: [9, 10] },
  au: { callingCode: "61", nationalLengths: [9] },
  australia: { callingCode: "61", nationalLengths: [9] },
  sg: { callingCode: "65", nationalLengths: [8] },
  singapore: { callingCode: "65", nationalLengths: [8] },
  ae: { callingCode: "971", nationalLengths: [8, 9] },
  uae: { callingCode: "971", nationalLengths: [8, 9] },
  "united arab emirates": { callingCode: "971", nationalLengths: [8, 9] },
};

function phoneRegion(value?: string): PhoneRegion | undefined {
  if (!value) return undefined;
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (
    phoneRegions[normalized] ??
    Object.entries(phoneRegions).find(([key]) =>
      normalized.split(" ").includes(key),
    )?.[1]
  );
}

/**
 * Canonicalize a phone number for stable identity matching. Local-format
 * numbers are accepted only with an explicit country/jurisdiction; ambiguous
 * numbers are rejected instead of being silently merged across countries.
 */
export function canonicalPhone(
  value: string,
  countryOrJurisdiction?: string,
): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return undefined;

  let international: string | undefined;
  if (trimmed.startsWith("+")) {
    international = `+${digits}`;
  } else if (trimmed.startsWith("00") && digits.length > 2) {
    international = `+${digits.slice(2)}`;
  } else {
    const region = phoneRegion(countryOrJurisdiction);
    if (!region) return undefined;
    let national = digits;
    if (
      national.startsWith(region.callingCode) &&
      region.nationalLengths.includes(
        national.length - region.callingCode.length,
      )
    ) {
      international = `+${national}`;
    } else {
      if (national.startsWith("0")) national = national.slice(1);
      if (!region.nationalLengths.includes(national.length)) return undefined;
      international = `+${region.callingCode}${national}`;
    }
  }

  return /^\+[1-9][0-9]{7,14}$/.test(international) ? international : undefined;
}

export function hashPhone(
  value: string,
  countryOrJurisdiction?: string,
): string {
  const canonical = canonicalPhone(value, countryOrJurisdiction);
  if (!canonical) {
    throw new AppError(
      "INVALID_PHONE",
      "Phone numbers must be valid E.164 or include an explicit country.",
      422,
    );
  }
  return hashIdentifier(canonical);
}

export function privacySafetyIdentifier(
  workspaceId: string,
  userId: string,
): string {
  return `ath_${createHmac("sha256", encryptionKey())
    .update(`${workspaceId}:${userId}`)
    .digest("base64url")
    .slice(0, 32)}`;
}

export function maskEmail(value: string): string {
  const [local = "", domain = ""] = value.split("@");
  return `${local.slice(0, 2)}${"•".repeat(Math.max(2, Math.min(6, local.length - 2)))}@${domain}`;
}

export function maskPhone(value: string): string {
  const visible = value.replace(/\D/g, "").slice(-4);
  return `••••••${visible}`;
}
