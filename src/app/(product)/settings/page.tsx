"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Building2,
  Check,
  LockKeyhole,
  Save,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import {
  Button,
  Field,
  InlineNotice,
  PageHeader,
  SelectField,
  Surface,
  TextAreaField,
  cx,
} from "@/components/product/ui";
import { requestOrFallback } from "@/lib/demo/client";

type Section = "workspace" | "defaults" | "privacy";

const sections = [
  { id: "workspace", label: "Workspace", icon: Building2 },
  { id: "defaults", label: "Search and AI", icon: SlidersHorizontal },
  { id: "privacy", label: "Privacy and data", icon: ShieldCheck },
] as const;

export default function SettingsPage() {
  const { data: session } = useSession();
  const [section, setSection] = useState<Section>("workspace");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [workspace, setWorkspace] = useState({
    name: "",
    timezone: "Asia/Kolkata",
    signature: "",
  });
  const [defaults, setDefaults] = useState({
    tone: "Professional",
    mode: "B2B",
    score: "65",
    limit: "100",
    location: "India",
  });
  const [retention, setRetention] = useState("30");
  const canManageWorkspace =
    session?.user?.role === "OWNER" || session?.user?.role === "ADMIN";

  useEffect(() => {
    let active = true;
    requestOrFallback<{
      data?: {
        companyName?: string | null;
        name?: string | null;
        timezone?: string;
        emailSignature?: string | null;
        defaultTone?: string;
        defaultFilters?: {
          mode?: string;
          score?: number;
          limit?: number;
          location?: string;
        } | null;
        retentionDays?: number;
      };
    }>("/api/settings", { data: {} })
      .then(({ data }) => {
        if (!active || !data.data) return;
        const value = data.data;
        setWorkspace((current) => ({
          ...current,
          name: value.companyName ?? value.name ?? current.name,
          timezone: value.timezone ?? current.timezone,
          signature: value.emailSignature ?? current.signature,
        }));
        setDefaults((current) => ({
          ...current,
          tone: value.defaultTone
            ? `${value.defaultTone.charAt(0).toUpperCase()}${value.defaultTone.slice(1)}`
            : current.tone,
          mode: value.defaultFilters?.mode ?? current.mode,
          score: value.defaultFilters?.score?.toString() ?? current.score,
          limit: value.defaultFilters?.limit?.toString() ?? current.limit,
          location: value.defaultFilters?.location ?? current.location,
        }));
        if (value.retentionDays) setRetention(String(value.retentionDays));
      })
      .catch(() => {
        if (active) setError("Workspace settings could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, []);

  const change = () => {
    setDirty(true);
    setSaved(false);
  };
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await requestOrFallback(
        "/api/settings",
        { data: { ok: true } },
        {
          method: "PATCH",
          body: JSON.stringify({
            companyName: workspace.name,
            timezone: workspace.timezone,
            emailSignature: workspace.signature,
            defaultTone: defaults.tone.toLowerCase(),
            defaultFilters: {
              mode: defaults.mode,
              score: Number(defaults.score),
              limit: Number(defaults.limit),
              location: defaults.location,
            },
            retentionDays: Number(retention),
          }),
        },
      );
      setDirty(false);
      setSaved(true);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Workspace settings could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure workspace identity, research defaults, and supported data controls."
        action={
          <Button
            onClick={() => void save()}
            loading={saving}
            disabled={!dirty || !canManageWorkspace}
          >
            {saved ? <Check className="size-4" /> : <Save className="size-4" />}
            {saved ? "Saved" : "Save changes"}
          </Button>
        }
      />
      {!canManageWorkspace ? (
        <InlineNotice
          title="Workspace settings are read-only"
          icon={<LockKeyhole className="size-4" />}
        >
          <p>
            An Owner or Admin can change workspace defaults and governance
            controls. Your personal profile remains editable from Profile.
          </p>
        </InlineNotice>
      ) : null}
      {error ? (
        <InlineNotice title="Settings action failed" tone="danger">
          <p>{error}</p>
        </InlineNotice>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav
          aria-label="Settings sections"
          className="flex gap-1 overflow-x-auto lg:block lg:space-y-1"
        >
          {sections.map((item) => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              aria-current={section === item.id ? "page" : undefined}
              className={cx(
                "flex min-h-11 shrink-0 items-center gap-3 rounded-lg px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400 lg:w-full",
                section === item.id
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </button>
          ))}
        </nav>
        <fieldset
          disabled={!canManageWorkspace}
          className="min-w-0 disabled:opacity-70"
        >
          {section === "workspace" ? (
            <Surface className="p-5 sm:p-7">
              <h2 className="text-base font-semibold text-zinc-950 dark:text-white">
                Workspace profile
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Stored on the workspace record. Company name and signature are
                not automatically inserted into current exports or drafts yet.
              </p>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <Field
                  label="Company name"
                  value={workspace.name}
                  onChange={(event) => {
                    setWorkspace({ ...workspace, name: event.target.value });
                    change();
                  }}
                />
                <SelectField
                  label="Timezone"
                  value={workspace.timezone}
                  onChange={(event) => {
                    setWorkspace({
                      ...workspace,
                      timezone: event.target.value,
                    });
                    change();
                  }}
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="Europe/London">Europe/London (GMT)</option>
                  <option value="America/New_York">
                    America/New_York (ET)
                  </option>
                  <option value="America/Los_Angeles">
                    America/Los_Angeles (PT)
                  </option>
                </SelectField>
                <div className="sm:col-span-2">
                  <TextAreaField
                    label="Stored email signature"
                    hint="Automatic insertion into outreach drafts is pending integration."
                    rows={4}
                    value={workspace.signature}
                    onChange={(event) => {
                      setWorkspace({
                        ...workspace,
                        signature: event.target.value,
                      });
                      change();
                    }}
                  />
                </div>
              </div>
            </Surface>
          ) : null}

          {section === "defaults" ? (
            <Surface className="p-5 sm:p-7">
              <h2 className="text-base font-semibold text-zinc-950 dark:text-white">
                Stored search and AI preferences
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                These values are retained for a future prefill integration. The
                current search composer and outreach generator require an
                explicit choice and do not consume them automatically.
              </p>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <SelectField
                  label="Default research mode"
                  value={defaults.mode}
                  onChange={(event) => {
                    setDefaults({ ...defaults, mode: event.target.value });
                    change();
                  }}
                >
                  <option>B2B</option>
                  <option>B2C</option>
                </SelectField>
                <SelectField
                  label="AI outreach tone"
                  value={defaults.tone}
                  onChange={(event) => {
                    setDefaults({ ...defaults, tone: event.target.value });
                    change();
                  }}
                >
                  <option>Professional</option>
                  <option>Friendly</option>
                  <option>Direct</option>
                  <option>Premium</option>
                </SelectField>
                <SelectField
                  label="Minimum score"
                  value={defaults.score}
                  onChange={(event) => {
                    setDefaults({ ...defaults, score: event.target.value });
                    change();
                  }}
                >
                  <option value="0">No minimum</option>
                  <option value="50">50+</option>
                  <option value="65">65+</option>
                  <option value="80">80+</option>
                </SelectField>
                <SelectField
                  label="Result limit"
                  value={defaults.limit}
                  onChange={(event) => {
                    setDefaults({ ...defaults, limit: event.target.value });
                    change();
                  }}
                >
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="250">250</option>
                  <option value="500">500</option>
                </SelectField>
                <Field
                  label="Default location"
                  value={defaults.location}
                  onChange={(event) => {
                    setDefaults({ ...defaults, location: event.target.value });
                    change();
                  }}
                />
              </div>
              <InlineNotice
                title="Consumer searches always require a fresh check"
                icon={<LockKeyhole className="size-4" />}
              >
                <p>
                  Purpose, lawful basis, sensitive-data boundaries, suppression
                  status, and manual outreach acknowledgement are never
                  pre-approved by a workspace default.
                </p>
              </InlineNotice>
            </Surface>
          ) : null}

          {section === "privacy" ? (
            <Surface className="p-5 sm:p-7">
              <h2 className="text-base font-semibold text-zinc-950 dark:text-white">
                Data governance defaults
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                The server applies provenance, retention, suppression, and
                permission checks to searches and exports.
              </p>
              <div className="mt-6 max-w-sm">
                <SelectField
                  label="Default business-record retention"
                  value={retention}
                  onChange={(event) => {
                    setRetention(event.target.value);
                    change();
                  }}
                  hint="Consumer searches require an explicit period of 7–90 days and may use a shorter limit than this workspace default."
                >
                  <option value="30">30 days</option>
                  <option value="60">60 days</option>
                  <option value="90">90 days</option>
                  <option value="180">180 days</option>
                  <option value="365">365 days</option>
                </SelectField>
              </div>
              <div className="mt-6">
                <InlineNotice
                  title="Purpose limitation is enforced"
                  icon={<ShieldCheck className="size-4" />}
                >
                  <p>
                    Consumer records retain their declared source, source
                    reference, jurisdiction, permission, purpose, suppression
                    check, and deletion date through lists and exports.
                    Sensitive-trait and minor targeting is blocked.
                  </p>
                </InlineNotice>
              </div>
              <p className="mt-5 text-xs leading-5 text-zinc-500">
                Bulk suppression upload, audit-file download, data inventory,
                and workspace-deletion workflows are not exposed in this
                interface until their authenticated server operations are
                available. Individual privacy and suppression requests remain
                protected API operations.
              </p>
            </Surface>
          ) : null}
        </fieldset>
      </div>
    </div>
  );
}
