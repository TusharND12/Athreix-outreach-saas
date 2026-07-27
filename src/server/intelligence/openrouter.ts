import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { env } from "@/lib/server/env";
import { intelligencePrompts } from "@/server/intelligence/prompts";
import {
  intelligenceSchemas,
  type IntelligenceTaskName,
} from "@/server/intelligence/schemas";

let client: OpenAI | null = null;

function openRouterClient() {
  if (!env.OPENROUTER_API_KEY) return null;
  client ??= new OpenAI({
    apiKey: env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": env.NEXT_PUBLIC_APP_URL,
      "X-OpenRouter-Title": env.OPENROUTER_SITE_NAME,
    },
  });
  return client;
}

export type OpenRouterCallKind = "scoring" | "outreach" | "research";

export function openRouterRequestOptions(
  kind: OpenRouterCallKind,
  deadlineAt?: number,
  now = Date.now(),
) {
  const configuredTimeout =
    kind === "scoring"
      ? env.OPENROUTER_SCORING_TIMEOUT_MS
      : kind === "outreach"
        ? env.OPENROUTER_OUTREACH_TIMEOUT_MS
        : env.OPENROUTER_RESEARCH_TIMEOUT_MS;
  const remaining =
    deadlineAt === undefined ? configuredTimeout : deadlineAt - now;
  if (remaining <= 0) return null;
  return {
    timeout: Math.max(1, Math.min(configuredTimeout, remaining)),
    maxRetries:
      kind === "scoring"
        ? env.OPENROUTER_SCORING_MAX_RETRIES
        : kind === "outreach"
          ? env.OPENROUTER_OUTREACH_MAX_RETRIES
          : env.OPENROUTER_RESEARCH_MAX_RETRIES,
  };
}

function modelFor(kind: OpenRouterCallKind) {
  if (kind === "scoring") return env.OPENROUTER_SCORING_MODEL;
  if (kind === "outreach") return env.OPENROUTER_OUTREACH_MODEL;
  return env.OPENROUTER_RESEARCH_MODEL || env.OPENROUTER_MODEL;
}

export type StructuredIntelligenceResult<T> = {
  data: T;
  model: string;
  promptVersion: string;
  tokensInput?: number;
  tokensOutput?: number;
  latencyMs: number;
};

export async function runStructuredIntelligence<
  TTask extends IntelligenceTaskName,
>(
  task: TTask,
  input: unknown,
  options: {
    kind?: OpenRouterCallKind;
    deadlineAt?: number;
    user?: string;
  } = {},
): Promise<StructuredIntelligenceResult<
  z.infer<(typeof intelligenceSchemas)[TTask]>
> | null> {
  const sdk = openRouterClient();
  if (!sdk) return null;
  const kind = options.kind ?? "research";
  const requestOptions = openRouterRequestOptions(kind, options.deadlineAt);
  if (!requestOptions) return null;
  const definition = intelligencePrompts[task];
  const schema = intelligenceSchemas[task];
  const startedAt = Date.now();
  const requestBody = {
    model: modelFor(kind),
    stream: false as const,
    messages: [
      { role: "system" as const, content: definition.instruction },
      {
        role: "user" as const,
        content: JSON.stringify(input),
      },
    ],
    response_format: zodResponseFormat(schema, definition.schemaName),
    temperature: 0.1,
    user: options.user,
    provider: { require_parameters: true },
  };
  const response = await sdk.chat.completions.create(
    requestBody as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
    requestOptions,
  );
  const content = response.choices[0]?.message.content;
  if (!content) return null;
  const parsed = schema.safeParse(JSON.parse(content));
  if (!parsed.success) return null;
  return {
    data: parsed.data as z.infer<(typeof intelligenceSchemas)[TTask]>,
    model: response.model,
    promptVersion: definition.version,
    tokensInput: response.usage?.prompt_tokens,
    tokensOutput: response.usage?.completion_tokens,
    latencyMs: Date.now() - startedAt,
  };
}

export function isOpenRouterConfigured() {
  return Boolean(openRouterClient());
}
