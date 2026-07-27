"use client";

import React from "react";
import { useEffect, useMemo, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { Check, Clipboard, RefreshCw, ShieldAlert } from "lucide-react";
import type { Prospect } from "@/lib/demo/types";
import {
  ApiRequestError,
  isLocalDemoFallbackAllowed,
  requestOrFallback,
} from "@/lib/demo/client";
import { Button, InlineNotice, SelectField } from "./ui";

const channelLabels = {
  email: "Cold email",
  linkedin: "LinkedIn",
  connection: "Connection",
  followup: "Follow-up",
  whatsapp: "WhatsApp",
} as const;

type Channel = keyof typeof channelLabels;
type Tone = "Professional" | "Friendly" | "Direct" | "Premium";

function draftFor(
  prospect: Prospect,
  channel: Channel,
  tone: Tone,
  revision: number,
) {
  const greeting =
    channel === "email" || channel === "followup"
      ? `Hi ${prospect.name.split(" ")[0]},`
      : `Hi ${prospect.name.split(" ")[0]} —`;
  if (prospect.mode === "b2c") {
    const context =
      revision % 2 === 0
        ? `You previously opted in to ${prospect.consumer?.purpose.toLowerCase()}.`
        : `We’re inviting a small group of ${prospect.consumer?.relationship.toLowerCase()}s to optional product research.`;
    const permission =
      "Participation is voluntary, and you can decline or opt out of future invitations at any time.";
    const close =
      tone === "Direct"
        ? "Would you like the short study details?"
        : "Would you be open to receiving the short study details?";
    if (channel === "connection") return `${greeting} ${context} ${close}`;
    if (channel === "followup")
      return `${greeting}\n\nOne final follow-up on our optional research invitation. ${permission}\n\n${close}\n\n— Aryan, Athreix`;
    return `${channel === "email" ? "Subject: Optional product research invitation\n\n" : ""}${greeting}\n\n${context} ${permission}\n\n${close}\n\n— Aryan, Athreix`;
  }
  const signal =
    revision % 2 === 0
      ? `I noticed ${prospect.company} is growing its revenue and customer-success team.`
      : `Your recent go-to-market hiring at ${prospect.company} caught my attention.`;
  const value = `We help ${prospect.industry.toLowerCase()} teams turn account research into a focused, measurable pipeline without adding another manual workflow.`;
  const close =
    tone === "Direct"
      ? "Worth a focused 15-minute conversation next week?"
      : tone === "Friendly"
        ? "Would it be useful to compare notes for 15 minutes next week?"
        : tone === "Premium"
          ? "If this is timely, I would be glad to prepare a concise opportunity brief for your review."
          : "Would a short conversation next week be useful?";
  if (channel === "connection")
    return `${greeting} ${signal} I work with growth teams on evidence-led prospecting and would value connecting.`;
  if (channel === "linkedin")
    return `${greeting}\n\n${signal} ${value}\n\n${close}`;
  if (channel === "whatsapp")
    return `${greeting}\n\n${signal} ${value}\n\n${close}\n\n— Aryan, Athreix`;
  if (channel === "followup")
    return `${greeting}\n\nFollowing up once on my note about ${prospect.company}. ${value}\n\n${close}\n\nBest,\nAryan`;
  return `Subject: A focused growth idea for ${prospect.company}\n\n${greeting}\n\n${signal} ${value}\n\n${close}\n\nBest,\nAryan\nAthreix`;
}

export function OutreachGenerator({ prospect }: { prospect: Prospect }) {
  const permittedChannels = useMemo<Channel[]>(() => {
    if (prospect.mode === "b2b")
      return ["email", "linkedin", "connection", "followup", "whatsapp"];
    const allowed = prospect.consumer?.allowedChannels ?? [];
    return [
      ...(allowed.includes("Email")
        ? (["email", "followup"] as Channel[])
        : []),
      ...(allowed.includes("LinkedIn")
        ? (["linkedin", "connection"] as Channel[])
        : []),
      ...(allowed.includes("WhatsApp") ? (["whatsapp"] as Channel[]) : []),
    ];
  }, [prospect]);
  const [channel, setChannel] = useState<Channel>(
    permittedChannels[0] ?? "email",
  );
  const [tone, setTone] = useState<Tone>("Professional");
  const [revision, setRevision] = useState(0);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [storage, setStorage] = useState<"none" | "server" | "preview">("none");
  const [generating, setGenerating] = useState(false);
  const [remoteDraft, setRemoteDraft] = useState("");
  const output = remoteDraft;
  const [generationError, setGenerationError] = useState("");
  const permissionExpired =
    prospect.mode === "b2c" &&
    Boolean(
      prospect.consumer?.permissionExpires &&
      !Number.isNaN(new Date(prospect.consumer.permissionExpires).getTime()) &&
      new Date(prospect.consumer.permissionExpires).getTime() < Date.now(),
    );
  const blocked =
    prospect.status === "Limited" ||
    (prospect.mode === "b2c" &&
      (prospect.consumer?.consentStatus !== "Confirmed" ||
        permissionExpired ||
        permittedChannels.length === 0));

  useEffect(() => {
    setRemoteDraft("");
    setStorage("none");
    setGenerationError("");
  }, [channel, prospect.id, tone]);

  useEffect(() => {
    if (!permittedChannels.includes(channel) && permittedChannels[0])
      setChannel(permittedChannels[0]);
  }, [channel, permittedChannels]);

  const copy = async () => {
    await navigator.clipboard.writeText(output);
    setCopyState("copied");
    window.setTimeout(() => setCopyState("idle"), 1800);
  };
  const regenerate = async () => {
    if (blocked) return;
    setGenerating(true);
    setGenerationError("");
    const nextRevision = revision + 1;
    const fallbackBody = draftFor(prospect, channel, tone, nextRevision);
    const types: Record<Channel, string> = {
      email: "COLD_EMAIL",
      linkedin: "LINKEDIN_MESSAGE",
      connection: "LINKEDIN_CONNECTION",
      followup: "FOLLOW_UP",
      whatsapp: "WHATSAPP",
    };
    const localFixture = /^(prospect|consumer)-\d+$/.test(prospect.id);
    if (localFixture && isLocalDemoFallbackAllowed()) {
      setRevision(nextRevision);
      setRemoteDraft(fallbackBody);
      setGenerating(false);
      setStorage("preview");
      return;
    }
    try {
      const { data } = await requestOrFallback<{
        data?: { subject?: string; body?: string };
      }>(
        "/api/outreach",
        { data: { body: fallbackBody } },
        {
          method: "POST",
          body: JSON.stringify({
            resultId: prospect.id,
            type: types[channel],
            tone: tone.toLowerCase(),
            manualIntent: true,
          }),
        },
      );
      const generated = data.data;
      setRevision(nextRevision);
      setRemoteDraft(
        generated?.body
          ? `${generated.subject ? `Subject: ${generated.subject}\n\n` : ""}${generated.body}`
          : fallbackBody,
      );
      setStorage("server");
    } catch (error) {
      setRemoteDraft("");
      setGenerationError(
        error instanceof ApiRequestError
          ? error.message
          : "The draft could not be generated. Recheck permission and try again.",
      );
    } finally {
      setGenerating(false);
    }
  };

  if (blocked) {
    return (
      <InlineNotice
        title="Outreach drafting is blocked"
        tone="warning"
        icon={<ShieldAlert className="size-4" />}
      >
        <p>
          {prospect.status === "Limited"
            ? "This record is suppressed or otherwise restricted."
            : permissionExpired
              ? "The recorded channel permission has expired."
              : prospect.consumer?.consentStatus !== "Confirmed"
                ? "Consent or other channel permission requires review."
                : "No text outreach channel is proven by the detailed consent record."}{" "}
          Review the source record and obtain current, channel-specific
          permission before drafting.
        </p>
      </InlineNotice>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">
            Outreach draft
          </h3>
          <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
            Personalized from source-supported role, company, and activity
            evidence.
          </p>
        </div>
        <SelectField
          label="Tone"
          value={tone}
          onChange={(event) => setTone(event.target.value as Tone)}
          className="w-full sm:w-40"
        >
          <option>Professional</option>
          <option>Friendly</option>
          <option>Direct</option>
          <option>Premium</option>
        </SelectField>
      </div>
      <Tabs.Root
        value={channel}
        onValueChange={(value) => setChannel(value as Channel)}
      >
        <Tabs.List
          aria-label="Outreach channel"
          className="flex gap-1 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800"
        >
          {(Object.entries(channelLabels) as Array<[Channel, string]>)
            .filter(([value]) => permittedChannels.includes(value))
            .map(([value, label]) => (
              <Tabs.Trigger
                key={value}
                value={value}
                className="min-h-11 shrink-0 border-b-2 border-transparent px-3 text-xs font-medium text-zinc-600 outline-none transition-colors hover:text-zinc-950 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-950 data-[state=active]:border-zinc-950 data-[state=active]:text-zinc-950 dark:text-zinc-400 dark:hover:text-white dark:focus-visible:ring-zinc-100 dark:data-[state=active]:border-white dark:data-[state=active]:text-white"
              >
                {label}
              </Tabs.Trigger>
            ))}
        </Tabs.List>
        {(Object.keys(channelLabels) as Channel[])
          .filter((value) => permittedChannels.includes(value))
          .map((value) => (
            <Tabs.Content key={value} value={value} className="outline-none">
              <label className="sr-only" htmlFor={`draft-${value}`}>
                {channelLabels[value]} draft
              </label>
              <textarea
                id={`draft-${value}`}
                value={output}
                readOnly
                rows={value === "email" ? 12 : 8}
                className="mt-4 w-full resize-y rounded-lg border border-zinc-300 bg-zinc-50 p-4 text-sm leading-6 text-zinc-800 outline-none focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              />
            </Tabs.Content>
          ))}
      </Tabs.Root>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={copy} disabled={!output}>
          {copyState === "copied" ? (
            <Check className="size-3.5" />
          ) : (
            <Clipboard className="size-3.5" />
          )}
          {copyState === "copied" ? "Copied" : "Copy draft"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          loading={generating}
          onClick={regenerate}
        >
          <RefreshCw className="size-3.5" />
          {output ? "Regenerate" : "Generate reviewed draft"}
        </Button>
      </div>
      {output ? (
        <p className="mt-2 text-[11px] text-zinc-500">
          {storage === "server"
            ? "This server-generated draft was recorded automatically in outreach history."
            : "This fixture draft exists only in the local preview and is not in outreach history."}
        </p>
      ) : null}
      {generationError ? (
        <div className="mt-4">
          <InlineNotice
            title="Draft not generated"
            tone="danger"
            icon={<ShieldAlert className="size-4" />}
          >
            <p>{generationError}</p>
          </InlineNotice>
        </div>
      ) : null}
      <div className="mt-4">
        <InlineNotice
          title="Draft only — sending is your responsibility"
          tone={channel === "whatsapp" ? "warning" : "neutral"}
          icon={<ShieldAlert className="size-4" />}
        >
          <p>
            Athreix does not send messages or support unsolicited mass
            messaging. Confirm your lawful basis, honor opt-outs and suppression
            lists, and review this draft for accuracy before any individual
            outreach.
          </p>
        </InlineNotice>
      </div>
      <p className="sr-only" aria-live="polite">
        {copyState === "copied" ? "Draft copied to clipboard" : ""}
      </p>
    </div>
  );
}
