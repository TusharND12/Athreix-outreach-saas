"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  Activity,
  BadgeCheck,
  Ban,
  Check,
  CircleDollarSign,
  Clock3,
  FileLock2,
  RefreshCw,
  Search,
  ShieldAlert,
  UsersRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Button,
  Field,
  InlineNotice,
  PageHeader,
  SelectField,
  StatusBadge,
  Surface,
  TextAreaField,
} from "@/components/product/ui";

type Envelope<T> = {
  data: T;
  meta?: { demo?: boolean; pagination?: { total: number; pages: number } };
  error?: { message?: string };
};

type Summary = {
  users: number;
  pendingAccounts: number;
  workspaces: number;
  searches: number;
  failedJobs: number;
  prospects: number;
  exports: number;
  creditsConsumed: number;
};

type WorkspaceSummary = {
  id: string;
  name: string;
  role: string;
  creditBalance: number;
  plan: string | null;
  subscriptionStatus: string | null;
};

type AdminUser = {
  id: string;
  name: string | null;
  email: string | null;
  emailVerified: string | null;
  isPlatformAdmin: boolean;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  approvalSource?: "explicit" | "legacy";
  approvalNote?: string | null;
  suspendedAt: string | null;
  createdAt: string;
  searchCount: number;
  workspaces: WorkspaceSummary[];
};

type Health = Record<string, string | boolean | string[]> & {
  configurationIssues?: string[];
};

type Job = {
  id: string;
  status: string;
  stage: string;
  attempt: number;
  errorCode?: string | null;
  createdAt: string;
  search?: { name?: string | null; workspaceId?: string };
};

type ErrorFeed = {
  jobs: Array<{
    id: string;
    searchId: string;
    errorCode?: string | null;
    errorMessage?: string | null;
    attempt: number;
    completedAt?: string | null;
  }>;
  searches: Array<{
    id: string;
    workspaceId: string;
    errorCode?: string | null;
    errorMessage?: string | null;
    updatedAt: string;
  }>;
};

type AuditEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId?: string | null;
  workspaceId: string;
  createdAt: string;
};

type PrivacyRequest = {
  id: string;
  workspaceId: string;
  type: string;
  status: string;
  dueAt: string;
  completedAt?: string | null;
  createdAt: string;
  workspace?: { name?: string | null };
  requestPayload?: { identity?: string; details?: string };
  resolutionPayload?: {
    summary?: string;
    evidenceReference?: string;
  } | null;
};

type AccountAction = "APPROVE" | "REJECT" | "SUSPEND" | "RESTORE";
type Tab = "customers" | "operations" | "privacy" | "audit";

const defaultSummary: Summary = {
  users: 0,
  pendingAccounts: 0,
  workspaces: 0,
  searches: 0,
  failedJobs: 0,
  prospects: 0,
  exports: 0,
  creditsConsumed: 0,
};

async function requestData<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const payload = (await response
    .json()
    .catch(() => null)) as Envelope<T> | null;
  if (!response.ok || !payload) {
    throw new Error(
      payload?.error?.message ??
        "The admin service did not complete the request.",
    );
  }
  return payload;
}

function displayDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function accountState(user: AdminUser) {
  return user.suspendedAt ? "SUSPENDED" : user.approvalStatus;
}

function toneForState(state: string) {
  if (
    ["APPROVED", "ACTIVE", "COMPLETE", "up", "ready", "configured"].includes(
      state,
    )
  )
    return "success" as const;
  if (
    ["REJECTED", "SUSPENDED", "FAILED", "down", "not_configured"].includes(
      state,
    )
  )
    return "danger" as const;
  if (
    [
      "PENDING",
      "QUEUED",
      "RUNNING",
      "RETRYING",
      "VERIFYING",
      "IN_PROGRESS",
      "not_ready",
    ].includes(state)
  )
    return "warning" as const;
  return "neutral" as const;
}

function DialogFrame({
  title,
  description,
  children,
  open,
  onOpenChange,
}: {
  title: string;
  description: string;
  children: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[60] w-[calc(100vw_-_2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl outline-none dark:border-slate-700 dark:bg-slate-900">
          <div className="pr-10">
            <Dialog.Title className="text-xl font-semibold text-slate-950 dark:text-white">
              {title}
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
              {description}
            </Dialog.Description>
          </div>
          <Dialog.Close className="absolute right-4 top-4 grid size-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </Dialog.Close>
          <div className="mt-6">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function AdminConsole() {
  const [tab, setTab] = useState<Tab>("customers");
  const [summary, setSummary] = useState(defaultSummary);
  const [health, setHealth] = useState<Health>({});
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [filter, setFilter] = useState("PENDING");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [isDemo, setIsDemo] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [errors, setErrors] = useState<ErrorFeed>({ jobs: [], searches: [] });
  const [operationsLoaded, setOperationsLoaded] = useState(false);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [auditLoaded, setAuditLoaded] = useState(false);
  const [privacyRequests, setPrivacyRequests] = useState<PrivacyRequest[]>([]);
  const [privacyLoaded, setPrivacyLoaded] = useState(false);
  const [privacyDialog, setPrivacyDialog] = useState<PrivacyRequest | null>(
    null,
  );
  const [privacyStatus, setPrivacyStatus] = useState("IN_PROGRESS");
  const [privacyResolution, setPrivacyResolution] = useState("");
  const [privacyEvidence, setPrivacyEvidence] = useState("");
  const [privacySaving, setPrivacySaving] = useState(false);
  const [privacyValidationAttempted, setPrivacyValidationAttempted] =
    useState(false);
  const [accountDialog, setAccountDialog] = useState<{
    user: AdminUser;
    action: AccountAction;
  } | null>(null);
  const [accountNote, setAccountNote] = useState("");
  const [accountSaving, setAccountSaving] = useState(false);
  const [creditWorkspace, setCreditWorkspace] =
    useState<WorkspaceSummary | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [creditIdempotencyKey, setCreditIdempotencyKey] = useState("");
  const [creditSaving, setCreditSaving] = useState(false);
  const [creditValidationAttempted, setCreditValidationAttempted] =
    useState(false);
  const [creditDialogError, setCreditDialogError] = useState("");

  const loadUsers = useCallback(async () => {
    const params = new URLSearchParams({ status: filter, pageSize: "100" });
    if (query.trim()) params.set("query", query.trim());
    const response = await requestData<AdminUser[]>(
      `/api/admin/users?${params}`,
    );
    setUsers(response.data);
    setUserTotal(response.meta?.pagination?.total ?? response.data.length);
  }, [filter, query]);

  const loadCore = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const [summaryResponse, healthResponse] = await Promise.all([
        requestData<Summary>("/api/admin"),
        requestData<Health>("/api/admin/health"),
      ]);
      setSummary(summaryResponse.data);
      setHealth(healthResponse.data);
      setIsDemo(Boolean(summaryResponse.meta?.demo));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Admin data is unavailable.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadOperations = useCallback(async () => {
    setError("");
    try {
      const [jobResponse, errorResponse] = await Promise.all([
        requestData<Job[]>("/api/admin/jobs"),
        requestData<ErrorFeed>("/api/admin/errors"),
      ]);
      setJobs(jobResponse.data);
      setErrors(errorResponse.data);
      setOperationsLoaded(true);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Operations data is unavailable.",
      );
    }
  }, []);

  const loadAudit = useCallback(async () => {
    setError("");
    try {
      const response = await requestData<AuditEntry[]>("/api/admin/logs");
      setAudit(response.data);
      setAuditLoaded(true);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Audit data is unavailable.",
      );
    }
  }, []);

  const loadPrivacy = useCallback(async () => {
    setError("");
    try {
      const response =
        await requestData<PrivacyRequest[]>("/api/admin/privacy");
      setPrivacyRequests(response.data);
      setPrivacyLoaded(true);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Privacy operations are unavailable.",
      );
    }
  }, []);

  useEffect(() => {
    void loadCore();
  }, [loadCore]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadUsers().catch((caught: unknown) => {
        setError(
          caught instanceof Error
            ? caught.message
            : "Customer data is unavailable.",
        );
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  useEffect(() => {
    if (tab === "operations" && !operationsLoaded) void loadOperations();
    if (tab === "privacy" && !privacyLoaded) void loadPrivacy();
    if (tab === "audit" && !auditLoaded) void loadAudit();
  }, [
    auditLoaded,
    loadAudit,
    loadOperations,
    loadPrivacy,
    operationsLoaded,
    privacyLoaded,
    tab,
  ]);

  const submitAccountAction = async () => {
    if (!accountDialog) return;
    if (
      ["REJECT", "SUSPEND"].includes(accountDialog.action) &&
      accountNote.trim().length < 5
    ) {
      setError("Add an internal reason of at least five characters.");
      return;
    }
    setAccountSaving(true);
    setError("");
    try {
      await requestData("/api/admin/users", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId: accountDialog.user.id,
          action: accountDialog.action,
          note: accountNote.trim() || undefined,
        }),
      });
      setAccountDialog(null);
      setAccountNote("");
      await Promise.all([loadCore(true), loadUsers()]);
      if (auditLoaded) await loadAudit();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The account was not changed.",
      );
    } finally {
      setAccountSaving(false);
    }
  };

  const submitCreditAdjustment = async () => {
    if (!creditWorkspace) return;
    const amount = Number(creditAmount);
    setCreditValidationAttempted(true);
    if (
      !Number.isInteger(amount) ||
      amount === 0 ||
      creditReason.trim().length < 5
    ) {
      setCreditDialogError("Correct the highlighted fields before applying.");
      return;
    }
    setCreditSaving(true);
    setCreditDialogError("");
    try {
      await requestData("/api/admin/credits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId: creditWorkspace.id,
          amount,
          reason: creditReason.trim(),
          idempotencyKey: creditIdempotencyKey,
        }),
      });
      setCreditWorkspace(null);
      setCreditAmount("");
      setCreditReason("");
      setCreditIdempotencyKey("");
      setCreditValidationAttempted(false);
      await Promise.all([loadCore(true), loadUsers()]);
      if (auditLoaded) await loadAudit();
    } catch (caught) {
      setCreditDialogError(
        caught instanceof Error ? caught.message : "Credits were not changed.",
      );
    } finally {
      setCreditSaving(false);
    }
  };

  const openAccountAction = (user: AdminUser, action: AccountAction) => {
    setError("");
    setAccountNote("");
    setAccountDialog({ user, action });
  };

  const openCreditAdjustment = (workspace: WorkspaceSummary) => {
    setError("");
    setCreditAmount("");
    setCreditReason("");
    setCreditIdempotencyKey(crypto.randomUUID());
    setCreditValidationAttempted(false);
    setCreditDialogError("");
    setCreditWorkspace(workspace);
  };

  const openPrivacyRequest = async (item: PrivacyRequest) => {
    setError("");
    try {
      const response = await requestData<PrivacyRequest>(
        `/api/admin/privacy?id=${encodeURIComponent(item.id)}`,
      );
      setPrivacyDialog(response.data);
      setPrivacyStatus(
        ["COMPLETE", "REJECTED"].includes(response.data.status)
          ? response.data.status
          : "IN_PROGRESS",
      );
      setPrivacyResolution(response.data.resolutionPayload?.summary ?? "");
      setPrivacyEvidence(
        response.data.resolutionPayload?.evidenceReference ?? "",
      );
      setPrivacyValidationAttempted(false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The privacy request could not be opened.",
      );
    }
  };

  const submitPrivacyResolution = async () => {
    setPrivacyValidationAttempted(true);
    if (!privacyDialog || privacyResolution.trim().length < 10) return;
    if (privacyStatus === "COMPLETE" && privacyEvidence.trim().length < 8)
      return;
    setPrivacySaving(true);
    setError("");
    try {
      await requestData("/api/admin/privacy", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: privacyDialog.id,
          status: privacyStatus,
          resolution: privacyResolution.trim(),
          evidenceReference: privacyEvidence.trim() || undefined,
        }),
      });
      setPrivacyDialog(null);
      setPrivacyValidationAttempted(false);
      await loadPrivacy();
      if (auditLoaded) await loadAudit();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The privacy request was not updated.",
      );
    } finally {
      setPrivacySaving(false);
    }
  };

  const healthEntries = Object.entries(health).filter(
    ([key, value]) =>
      key !== "configurationIssues" &&
      key !== "timestamp" &&
      !Array.isArray(value),
  );

  return (
    <div className="space-y-7 pt-10 lg:pt-0">
      <PageHeader
        title="Admin operations"
        description="Approve customers, protect access, manage workspace credits, and inspect live platform health from one restricted control center."
        meta={<StatusBadge tone="info">Platform admin only</StatusBadge>}
        action={
          <Button
            variant="secondary"
            loading={refreshing}
            onClick={() => void loadCore(true)}
          >
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        }
      />

      {error ? (
        <InlineNotice title="Admin action needs attention" tone="danger">
          <p>{error}</p>
        </InlineNotice>
      ) : null}
      {health.configurationIssues?.length ? (
        <InlineNotice title="Launch configuration is incomplete" tone="warning">
          <p>{health.configurationIssues.join(" · ")}</p>
        </InlineNotice>
      ) : null}

      <section
        aria-label="Platform summary"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {[
          {
            label: "Pending approvals",
            value: summary.pendingAccounts,
            icon: Clock3,
            tone: "text-amber-700 dark:text-amber-300",
          },
          {
            label: "Customers",
            value: summary.users,
            icon: UsersRound,
            tone: "text-blue-700 dark:text-blue-300",
          },
          {
            label: "Workspaces",
            value: summary.workspaces,
            icon: BadgeCheck,
            tone: "text-emerald-700 dark:text-emerald-300",
          },
          {
            label: "Failed jobs",
            value: summary.failedJobs,
            icon: ShieldAlert,
            tone: "text-red-700 dark:text-red-300",
          },
        ].map(({ label, value, icon: Icon, tone }) => (
          <Surface key={label} className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-500">{label}</p>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-950 dark:text-white">
                  {Number(value ?? 0).toLocaleString("en-IN")}
                </p>
              </div>
              <span
                className={`grid size-11 place-items-center rounded-2xl bg-slate-100 dark:bg-slate-800 ${tone}`}
              >
                <Icon className="size-5" />
              </span>
            </div>
          </Surface>
        ))}
      </section>

      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white/70 p-1.5 dark:border-slate-800 dark:bg-slate-900/70">
        {(
          [
            ["customers", "Customers & approvals"],
            ["operations", "Operations & failures"],
            ["privacy", "Privacy requests"],
            ["audit", "Audit trail"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`min-h-10 whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition-colors ${tab === value ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "customers" ? (
        <Surface className="overflow-hidden">
          <div className="grid gap-4 border-b border-slate-200 p-5 sm:grid-cols-[minmax(0,1fr)_15rem] dark:border-slate-800">
            <Field
              label="Search customers"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name or work email"
            />
            <SelectField
              label="Access state"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="PENDING">Pending approval</option>
              <option value="ALL">All customers</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="SUSPENDED">Suspended</option>
            </SelectField>
          </div>
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 text-xs text-slate-500 dark:border-slate-800">
            <span>{userTotal.toLocaleString("en-IN")} matching accounts</span>
            <span>
              {loading
                ? "Loading…"
                : isDemo
                  ? "Preview records"
                  : "Live Firestore records"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1050px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-[0.08em] text-slate-500 dark:bg-slate-950/60">
                <tr>
                  <th className="px-5 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Access</th>
                  <th className="px-4 py-3 font-semibold">Workspace</th>
                  <th className="px-4 py-3 font-semibold">Activity</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                  <th className="px-5 py-3 text-right font-semibold">
                    Controls
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {users.map((user) => {
                  const state = accountState(user);
                  const workspace = user.workspaces[0];
                  return (
                    <tr
                      key={user.id}
                      className="align-top hover:bg-slate-50/60 dark:hover:bg-slate-800/25"
                    >
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-950 dark:text-white">
                          {user.name ?? "Unnamed customer"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {user.email ?? "No email"}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          {user.emailVerified
                            ? "Email verified"
                            : "Email not verified"}
                          {user.approvalSource === "legacy"
                            ? " · grandfathered"
                            : ""}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge tone={toneForState(state)}>
                          {state}
                        </StatusBadge>
                        {user.isPlatformAdmin ? (
                          <p className="mt-2 text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                            Platform admin
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-medium text-slate-800 dark:text-slate-200">
                          {workspace?.name ?? "No workspace"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {workspace
                            ? `${workspace.plan ?? "No plan"} · ${workspace.creditBalance.toLocaleString("en-IN")} credits`
                            : "—"}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                        {user.searchCount.toLocaleString("en-IN")} searches
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-500">
                        {displayDate(user.createdAt)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          {!user.isPlatformAdmin &&
                          !user.suspendedAt &&
                          user.approvalStatus !== "APPROVED" ? (
                            <Button
                              size="sm"
                              onClick={() => openAccountAction(user, "APPROVE")}
                              disabled={!user.emailVerified}
                            >
                              <Check className="size-3.5" /> Approve
                            </Button>
                          ) : null}
                          {!user.isPlatformAdmin &&
                          !user.suspendedAt &&
                          user.approvalStatus === "PENDING" ? (
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => openAccountAction(user, "REJECT")}
                            >
                              Reject
                            </Button>
                          ) : null}
                          {!user.isPlatformAdmin &&
                          !user.suspendedAt &&
                          user.approvalStatus === "APPROVED" ? (
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => openAccountAction(user, "SUSPEND")}
                            >
                              <Ban className="size-3.5" /> Suspend
                            </Button>
                          ) : null}
                          {!user.isPlatformAdmin && state === "SUSPENDED" ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => openAccountAction(user, "RESTORE")}
                            >
                              Restore
                            </Button>
                          ) : null}
                          {workspace ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => openCreditAdjustment(workspace)}
                            >
                              <CircleDollarSign className="size-3.5" /> Credits
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!loading && !users.length ? (
              <div className="grid min-h-44 place-items-center px-5 text-center text-sm text-slate-500">
                <div>
                  <Search className="mx-auto mb-3 size-5" />
                  <p>No customers match this view.</p>
                </div>
              </div>
            ) : null}
          </div>
        </Surface>
      ) : null}

      {tab === "operations" ? (
        <div className="space-y-5">
          <section
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            aria-label="Service health"
          >
            {healthEntries.map(([name, value]) => (
              <Surface key={name} className="p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  {name.replaceAll(/([A-Z])/g, " $1")}
                </p>
                <div className="mt-3">
                  <StatusBadge tone={toneForState(String(value))}>
                    {String(value).replaceAll("_", " ")}
                  </StatusBadge>
                </div>
              </Surface>
            ))}
          </section>
          <Surface className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-slate-800">
              <div>
                <h2 className="font-semibold text-slate-950 dark:text-white">
                  Recent jobs
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Latest worker activity and retries.
                </p>
              </div>
              <Activity className="size-5 text-blue-600" />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-[0.08em] text-slate-500 dark:bg-slate-950/60">
                  <tr>
                    <th className="px-5 py-3">Search</th>
                    <th className="px-4 py-3">State</th>
                    <th className="px-4 py-3">Stage</th>
                    <th className="px-4 py-3">Attempt</th>
                    <th className="px-5 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {jobs.slice(0, 50).map((job) => (
                    <tr key={job.id}>
                      <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">
                        {job.search?.name ?? job.id}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={toneForState(job.status)}>
                          {job.status}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {job.stage}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-300">
                        {job.attempt}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500">
                        {displayDate(job.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {operationsLoaded && !jobs.length ? (
                <p className="p-8 text-center text-sm text-slate-500">
                  No jobs have been recorded.
                </p>
              ) : null}
            </div>
          </Surface>
          <Surface className="overflow-hidden">
            <div className="border-b border-slate-200 p-5 dark:border-slate-800">
              <h2 className="font-semibold text-slate-950 dark:text-white">
                Failure feed
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Most recent failed jobs and searches; error messages are
                restricted to platform admins.
              </p>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {[
                ...errors.jobs.map((item) => ({
                  ...item,
                  kind: "Job",
                  date: item.completedAt,
                })),
                ...errors.searches.map((item) => ({
                  ...item,
                  kind: "Search",
                  date: item.updatedAt,
                })),
              ]
                .slice(0, 50)
                .map((item) => (
                  <div
                    key={`${item.kind}-${item.id}`}
                    className="grid gap-2 px-5 py-4 sm:grid-cols-[7rem_12rem_minmax(0,1fr)_11rem] sm:items-center"
                  >
                    <StatusBadge tone="danger">{item.kind}</StatusBadge>
                    <code className="truncate text-xs text-slate-500">
                      {item.errorCode ?? "UNKNOWN"}
                    </code>
                    <p className="truncate text-sm text-slate-700 dark:text-slate-300">
                      {item.errorMessage ?? "No error message captured."}
                    </p>
                    <p className="text-xs text-slate-500">
                      {displayDate(item.date)}
                    </p>
                  </div>
                ))}
              {operationsLoaded &&
              !errors.jobs.length &&
              !errors.searches.length ? (
                <p className="p-8 text-center text-sm text-slate-500">
                  No failures recorded.
                </p>
              ) : null}
            </div>
          </Surface>
        </div>
      ) : null}

      {tab === "privacy" ? (
        <Surface className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-slate-800">
            <div>
              <h2 className="font-semibold text-slate-950 dark:text-white">
                Privacy request queue
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Identity details are decrypted only when an administrator opens
                a request, and every reveal and resolution is audited.
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void loadPrivacy()}
            >
              <RefreshCw className="size-3.5" />
              Refresh
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[820px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-[0.08em] text-slate-500 dark:bg-slate-950/60">
                <tr>
                  <th className="px-5 py-3">Request</th>
                  <th className="px-4 py-3">Workspace</th>
                  <th className="px-4 py-3">State</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-5 py-3 text-right">Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {privacyRequests.map((item) => {
                  const closed = ["COMPLETE", "REJECTED"].includes(item.status);
                  const overdue = !closed && new Date(item.dueAt) < new Date();
                  return (
                    <tr key={item.id}>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-950 dark:text-white">
                          {item.type.replaceAll("_", " ")}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Received {displayDate(item.createdAt)}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-slate-700 dark:text-slate-300">
                        {item.workspace?.name ?? item.workspaceId}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge tone={toneForState(item.status)}>
                          {item.status.replaceAll("_", " ")}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-4">
                        <p
                          className={
                            overdue
                              ? "font-semibold text-red-700 dark:text-red-300"
                              : "text-slate-600 dark:text-slate-300"
                          }
                        >
                          {displayDate(item.dueAt)}
                        </p>
                        {overdue ? (
                          <p className="mt-1 text-[11px] font-semibold text-red-700 dark:text-red-300">
                            Overdue
                          </p>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => void openPrivacyRequest(item)}
                        >
                          <FileLock2 className="size-3.5" /> Review
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {privacyLoaded && !privacyRequests.length ? (
              <p className="p-8 text-center text-sm text-slate-500">
                No privacy requests are waiting for review.
              </p>
            ) : null}
          </div>
        </Surface>
      ) : null}

      {tab === "audit" ? (
        <Surface className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-slate-800">
            <div>
              <h2 className="font-semibold text-slate-950 dark:text-white">
                Immutable action history
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Account, credit, billing, legal, and operational events.
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void loadAudit()}
            >
              <RefreshCw className="size-3.5" />
              Refresh
            </Button>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {audit.map((entry) => (
              <div
                key={entry.id}
                className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_10rem_13rem] sm:items-center"
              >
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {entry.action}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {entry.entityType} · {entry.entityId}
                  </p>
                </div>
                <code className="truncate text-xs text-slate-500">
                  {entry.actorId ?? "system"}
                </code>
                <p className="text-xs text-slate-500 sm:text-right">
                  {displayDate(entry.createdAt)}
                </p>
              </div>
            ))}
            {auditLoaded && !audit.length ? (
              <p className="p-8 text-center text-sm text-slate-500">
                No audit entries recorded.
              </p>
            ) : null}
          </div>
        </Surface>
      ) : null}

      <DialogFrame
        open={Boolean(accountDialog)}
        onOpenChange={(open) => {
          if (!open && !accountSaving) setAccountDialog(null);
        }}
        title={`${accountDialog?.action.toLowerCase() ?? "Change"} account`}
        description={`${accountDialog?.user.name ?? accountDialog?.user.email ?? "This customer"} will have their access state changed immediately. Session changes are enforced on the next authenticated request.`}
      >
        <TextAreaField
          label="Internal reason"
          value={accountNote}
          onChange={(event) => setAccountNote(event.target.value)}
          rows={4}
          placeholder={
            accountDialog?.action === "APPROVE"
              ? "Optional approval note"
              : "Required for rejection or suspension"
          }
        />
        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="secondary"
            disabled={accountSaving}
            onClick={() => setAccountDialog(null)}
          >
            Cancel
          </Button>
          <Button
            variant={
              accountDialog?.action === "REJECT" ||
              accountDialog?.action === "SUSPEND"
                ? "danger"
                : "primary"
            }
            loading={accountSaving}
            onClick={() => void submitAccountAction()}
          >
            Confirm {accountDialog?.action.toLowerCase()}
          </Button>
        </div>
      </DialogFrame>

      <DialogFrame
        open={Boolean(privacyDialog)}
        onOpenChange={(open) => {
          if (!open && !privacySaving) {
            setPrivacyDialog(null);
            setPrivacyValidationAttempted(false);
          }
        }}
        title={`Review ${privacyDialog?.type.toLowerCase().replaceAll("_", " ") ?? "privacy"} request`}
        description={`${privacyDialog?.workspace?.name ?? "This workspace"} submitted this request on ${displayDate(privacyDialog?.createdAt)}. Complete the underlying operator workflow before marking it complete.`}
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-950/50">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              Verified request details
            </p>
            <p className="mt-3 break-words font-medium text-slate-900 dark:text-white">
              {privacyDialog?.requestPayload?.identity ??
                "No identity value recorded."}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-slate-600 dark:text-slate-300">
              {privacyDialog?.requestPayload?.details ??
                "No additional details supplied."}
            </p>
          </div>
          <SelectField
            label="Request state"
            value={privacyStatus}
            onChange={(event) => setPrivacyStatus(event.target.value)}
          >
            <option value="VERIFYING">Verifying</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="COMPLETE">Complete</option>
            <option value="REJECTED">Rejected</option>
          </SelectField>
          <TextAreaField
            label="Internal resolution"
            value={privacyResolution}
            onChange={(event) => setPrivacyResolution(event.target.value)}
            rows={4}
            placeholder="Record what was verified, exported, erased, or rejected."
            hint="Encrypted at rest and available only to platform administrators."
            error={
              privacyValidationAttempted && privacyResolution.trim().length < 10
                ? "Enter at least ten characters."
                : undefined
            }
          />
          <Field
            label="Evidence reference"
            value={privacyEvidence}
            onChange={(event) => setPrivacyEvidence(event.target.value)}
            placeholder="Ticket, object path, or provider erasure receipt"
            hint={
              privacyStatus === "COMPLETE"
                ? "Required before completion; do not paste secrets or raw personal data."
                : "Optional until the request is complete."
            }
            error={
              privacyValidationAttempted &&
              privacyStatus === "COMPLETE" &&
              privacyEvidence.trim().length < 8
                ? "Add an evidence reference of at least eight characters."
                : undefined
            }
          />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="secondary"
            disabled={privacySaving}
            onClick={() => {
              setPrivacyDialog(null);
              setPrivacyValidationAttempted(false);
            }}
          >
            Cancel
          </Button>
          <Button
            loading={privacySaving}
            onClick={() => void submitPrivacyResolution()}
          >
            Save request
          </Button>
        </div>
      </DialogFrame>

      <DialogFrame
        open={Boolean(creditWorkspace)}
        onOpenChange={(open) => {
          if (!open && !creditSaving) {
            setCreditWorkspace(null);
            setCreditDialogError("");
            setCreditValidationAttempted(false);
          }
        }}
        title="Adjust workspace credits"
        description={`${creditWorkspace?.name ?? "Workspace"} currently has ${creditWorkspace?.creditBalance.toLocaleString("en-IN") ?? 0} credits. Negative adjustments cannot make the balance fall below zero.`}
      >
        <div className="space-y-4">
          {creditDialogError ? (
            <InlineNotice title="Credits were not adjusted" tone="danger">
              <p>{creditDialogError}</p>
            </InlineNotice>
          ) : null}
          <Field
            label="Credit amount"
            type="number"
            step="1"
            min="-100000"
            max="100000"
            value={creditAmount}
            onChange={(event) => setCreditAmount(event.target.value)}
            placeholder="250 or -100"
            hint="Positive numbers add credits; negative numbers remove them."
            error={
              creditValidationAttempted &&
              (!Number.isInteger(Number(creditAmount)) ||
                Number(creditAmount) === 0)
                ? "Enter a non-zero whole number."
                : undefined
            }
          />
          <TextAreaField
            label="Audit reason"
            value={creditReason}
            onChange={(event) => setCreditReason(event.target.value)}
            rows={3}
            placeholder="Why is this adjustment required?"
            hint="Required for the audit trail (minimum 5 characters)."
            error={
              creditValidationAttempted && creditReason.trim().length < 5
                ? "Enter at least five characters."
                : undefined
            }
          />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="secondary"
            disabled={creditSaving}
            onClick={() => {
              setCreditWorkspace(null);
              setCreditDialogError("");
              setCreditValidationAttempted(false);
            }}
          >
            Cancel
          </Button>
          <Button
            loading={creditSaving}
            onClick={() => void submitCreditAdjustment()}
          >
            Apply adjustment
          </Button>
        </div>
      </DialogFrame>
    </div>
  );
}
