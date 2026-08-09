import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));

vi.mock("@/lib/server/firebase-admin", () => ({
  firebaseAuth: {
    createUser: vi.fn(),
    deleteUser: vi.fn(),
    getUser,
    updateUser: vi.fn(),
    revokeRefreshTokens: vi.fn(),
  },
}));

vi.mock("@/lib/server/env", () => ({
  env: { NEXT_PUBLIC_FIREBASE_API_KEY: "firebase-web-key" },
}));

import {
  firebaseEmailIsVerified,
  sendFirebasePasswordResetEmail,
  sendFirebaseVerificationEmail,
} from "@/lib/server/firebase-auth";

describe("Firebase Authentication email delivery", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getUser.mockReset();
  });

  it("authenticates the new account and sends Firebase verification email", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            localId: "user-1",
            email: "asha@example.com",
            idToken: "firebase-id-token",
            refreshToken: "refresh-token",
            expiresIn: "3600",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ email: "asha@example.com" }), {
          status: 200,
        }),
      );

    await expect(
      sendFirebaseVerificationEmail("asha@example.com", "SecurePassword123"),
    ).resolves.toBe(true);

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("accounts:sendOobCode"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          requestType: "VERIFY_EMAIL",
          idToken: "firebase-id-token",
        }),
      }),
    );
  });

  it("uses Firebase's non-enumerating password-reset email endpoint", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    await expect(
      sendFirebasePasswordResetEmail("asha@example.com"),
    ).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("accounts:sendOobCode"),
      expect.objectContaining({
        body: JSON.stringify({
          requestType: "PASSWORD_RESET",
          email: "asha@example.com",
        }),
      }),
    );
  });

  it("reads the authoritative verification state from Firebase", async () => {
    getUser.mockResolvedValue({ emailVerified: true });
    await expect(firebaseEmailIsVerified("user-1")).resolves.toBe(true);
  });
});
