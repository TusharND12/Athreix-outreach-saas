"use client";

import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import {
  Check,
  KeyRound,
  Laptop,
  LogOut,
  Mail,
  Save,
  ShieldCheck,
  Trash2,
  UserX,
} from "lucide-react";
import {
  Button,
  Field,
  InlineNotice,
  PageHeader,
  SectionHeading,
  SelectField,
  StatusBadge,
  Surface,
} from "@/components/product/ui";
import { requestOrFallback } from "@/lib/demo/client";

type ProfileResponse = {
  data?: {
    name?: string | null;
    email?: string;
    timezone?: string | null;
    role?: string;
    createdAt?: string;
  };
};

export default function ProfilePage() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    timezone: "Asia/Kolkata",
    role: "Member",
    createdAt: "",
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [deletionConfirmation, setDeletionConfirmation] = useState("");
  const [deletionRequesting, setDeletionRequesting] = useState(false);
  const [revokingSessions, setRevokingSessions] = useState(false);
  const [withdrawingConsent, setWithdrawingConsent] = useState(false);

  useEffect(() => {
    let active = true;
    requestOrFallback<ProfileResponse>("/api/profile", { data: {} })
      .then(({ data }) => {
        if (!active || !data.data) return;
        setProfile({
          name: data.data.name ?? session?.user?.name ?? "",
          email: data.data.email ?? session?.user?.email ?? "",
          timezone: data.data.timezone ?? "Asia/Kolkata",
          role: data.data.role ?? session?.user?.role ?? "Member",
          createdAt: data.data.createdAt ?? "",
        });
      })
      .catch(() => {
        if (active) setError("Your profile could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, [session?.user?.email, session?.user?.name, session?.user?.role]);

  const save = async () => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await requestOrFallback(
        "/api/profile",
        { data: { name: profile.name, timezone: profile.timezone } },
        {
          method: "PATCH",
          body: JSON.stringify({
            name: profile.name,
            timezone: profile.timezone,
          }),
        },
      );
      setSaved(true);
      setNotice("Name and timezone saved");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Your profile could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };

  const requestPasswordReset = async () => {
    if (!profile.email) return;
    setError("");
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: profile.email }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        data?: { message?: string };
        error?: { message?: string };
      };
      if (!response.ok)
        throw new Error(
          payload.error?.message ?? "Password reset could not be requested.",
        );
      setNotice(
        payload.data?.message ??
          "If this account uses a password, reset instructions will be sent.",
      );
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : "Password reset could not be requested.",
      );
    }
  };

  const revokeAllSessions = async () => {
    setRevokingSessions(true);
    setError("");
    try {
      await requestOrFallback(
        "/api/profile/sessions/revoke",
        { data: { revoked: true } },
        { method: "POST" },
      );
      await signOut({ callbackUrl: "/login?revoked=1" });
    } catch (revokeError) {
      setError(
        revokeError instanceof Error
          ? revokeError.message
          : "Other sessions could not be revoked.",
      );
      setRevokingSessions(false);
    }
  };

  const requestAccountDeletion = async () => {
    if (!profile.email || deletionConfirmation !== profile.email) return;
    setDeletionRequesting(true);
    setError("");
    setNotice("");
    try {
      await requestOrFallback(
        "/api/privacy/requests",
        { data: { status: "RECEIVED" } },
        {
          method: "POST",
          body: JSON.stringify({
            type: "DELETION",
            identity: profile.email,
            details:
              "Delete my Athreix account and owner-managed workspace data. Cancelled billing records may be retained only where legally required.",
          }),
        },
      );
      setDeletionConfirmation("");
      setNotice(
        "Deletion request received. Access remains available while identity, billing, exports, and provider cleanup are verified.",
      );
    } catch (deletionError) {
      setError(
        deletionError instanceof Error
          ? deletionError.message
          : "The deletion request could not be submitted.",
      );
    } finally {
      setDeletionRequesting(false);
    }
  };

  const withdrawDataProcessingConsent = async () => {
    if (
      !window.confirm(
        "Withdraw consent and sign out? Athreix will restrict account processing and queue deletion subject to legal retention duties.",
      )
    ) {
      return;
    }
    setWithdrawingConsent(true);
    setError("");
    try {
      await requestOrFallback(
        "/api/privacy/consent",
        { data: { withdrawn: true } },
        { method: "POST" },
      );
      await signOut({ callbackUrl: "/login?consent=withdrawn" });
    } catch (withdrawalError) {
      setError(
        withdrawalError instanceof Error
          ? withdrawalError.message
          : "Consent could not be withdrawn.",
      );
      setWithdrawingConsent(false);
    }
  };

  const initials = (profile.name || profile.email || "A")
    .split(/[ @]/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile"
        description="Manage the personal details attached to your workspace activity and current sign-in."
        action={
          <Button
            variant="secondary"
            onClick={() => void signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
        }
      />
      {notice ? (
        <div
          role="status"
          className="flex min-h-11 items-center gap-2 rounded-lg bg-emerald-50 px-3 text-xs text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
        >
          <Check className="size-3.5" />
          {notice}
        </div>
      ) : null}
      {error ? (
        <InlineNotice title="Profile action failed" tone="danger">
          <p>{error}</p>
        </InlineNotice>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Surface className="p-5 sm:p-7">
            <SectionHeading
              title="Personal details"
              description="Your name is used for workspace attribution; timezone controls local date display."
            />
            <div className="mt-6 flex flex-col gap-6 sm:flex-row">
              <div className="flex size-20 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-xl font-semibold text-white dark:bg-white dark:text-zinc-950">
                {initials}
              </div>
              <div className="grid min-w-0 flex-1 gap-5 sm:grid-cols-2">
                <Field
                  label="Full name"
                  value={profile.name}
                  onChange={(event) => {
                    setProfile({ ...profile, name: event.target.value });
                    setSaved(false);
                  }}
                />
                <Field
                  label="Account email"
                  type="email"
                  value={profile.email}
                  readOnly
                  hint="Email changes are managed by your authentication provider."
                />
                <SelectField
                  label="Timezone"
                  value={profile.timezone}
                  onChange={(event) => {
                    setProfile({ ...profile, timezone: event.target.value });
                    setSaved(false);
                  }}
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value="America/Los_Angeles">
                    America/Los_Angeles
                  </option>
                </SelectField>
                <Field label="Workspace role" value={profile.role} readOnly />
              </div>
            </div>
            <div className="mt-6 flex justify-end border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <Button onClick={() => void save()} loading={saving}>
                {saved ? (
                  <Check className="size-4" />
                ) : (
                  <Save className="size-4" />
                )}
                {saved ? "Saved" : "Save name and timezone"}
              </Button>
            </div>
          </Surface>

          <Surface className="p-5 sm:p-7">
            <SectionHeading
              title="Sign-in security"
              description="Authentication methods are managed by the provider used for this account."
            />
            <div className="mt-5 divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              <div className="flex min-h-16 items-center gap-3 py-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                  <Mail className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Account email</p>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">
                    {profile.email || "Unavailable"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!profile.email}
                  onClick={() => void requestPasswordReset()}
                >
                  <KeyRound className="size-3.5" />
                  Request password reset
                </Button>
              </div>
              <div className="flex min-h-16 items-center gap-3 py-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                  <Laptop className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">
                      Current browser session
                    </p>
                    <StatusBadge tone="success">Active</StatusBadge>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    Revoke every application session if a device or sign-in may
                    be compromised.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={revokingSessions}
                  onClick={() => void revokeAllSessions()}
                >
                  Sign out everywhere
                </Button>
              </div>
            </div>
          </Surface>

          <Surface className="border-amber-200 p-5 sm:p-7 dark:border-amber-900">
            <SectionHeading
              title="DPDP data-processing consent"
              description="Withdraw the consent used for account access and requested Athreix features. This immediately revokes application sessions and opens an audited restriction request. Records required for security, disputes, billing, or law may still be retained."
            />
            <Button
              className="mt-5"
              variant="secondary"
              loading={withdrawingConsent}
              onClick={() => void withdrawDataProcessingConsent()}
            >
              <UserX className="size-4" />
              Withdraw consent and sign out
            </Button>
          </Surface>

          <Surface className="border-red-200 p-5 sm:p-7 dark:border-red-900">
            <SectionHeading
              title="Delete account and workspace data"
              description="Submit a verified deletion request covering account data, prospect records, exports, and retained provider artifacts. Active subscriptions must be resolved before final deletion."
            />
            <div className="mt-5 max-w-xl">
              <Field
                label="Confirm your account email"
                type="email"
                value={deletionConfirmation}
                onChange={(event) =>
                  setDeletionConfirmation(event.target.value.trim())
                }
                placeholder={profile.email}
                hint="This creates an auditable request; it does not silently remove billing records that must be retained by law."
              />
              <Button
                className="mt-4"
                variant="danger"
                loading={deletionRequesting}
                disabled={
                  !profile.email || deletionConfirmation !== profile.email
                }
                onClick={() => void requestAccountDeletion()}
              >
                <Trash2 className="size-4" />
                Request account deletion
              </Button>
            </div>
          </Surface>
        </div>

        <aside className="space-y-4">
          <Surface className="p-5">
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">
              Workspace access
            </h2>
            <dl className="mt-4 space-y-4 text-xs">
              <div>
                <dt className="text-zinc-500">Role</dt>
                <dd className="mt-1 font-medium">{profile.role}</dd>
              </div>
              {profile.createdAt ? (
                <div>
                  <dt className="text-zinc-500">Account created</dt>
                  <dd className="mt-1 font-medium">
                    {new Date(profile.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </dd>
                </div>
              ) : null}
            </dl>
          </Surface>
          <InlineNotice
            title="Account protection"
            icon={<ShieldCheck className="size-4" />}
          >
            <p>
              Never share passwords, reset links, one-time codes, or provider
              credentials. Sign out before leaving a shared device.
            </p>
          </InlineNotice>
        </aside>
      </div>
    </div>
  );
}
