"use client";

import Link from "next/link";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { PRIVACY_CONSENT_DATA } from "@/lib/privacy-consent";

export function DataProcessingConsent({
  id,
  checked,
  noticeVersion,
  error,
  onCheckedChange,
}: {
  id: string;
  checked: boolean;
  noticeVersion: string;
  error?: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;

  return (
    <fieldset className="mb-4 rounded-xl border bg-muted/35 p-3.5">
      <legend className="sr-only">Data-processing consent</legend>
      <div className="flex items-start gap-3">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          aria-invalid={Boolean(error)}
          aria-describedby={`${descriptionId}${error ? ` ${errorId}` : ""}`}
        />
        <Label htmlFor={id} className="text-xs leading-5 text-muted-foreground">
          I consent to Athreix processing account and requested-service data,
          plus Paddle billing references if I buy a plan, to provide and secure
          the features I use, as described in the{" "}
          <Link
            href="/privacy"
            target="_blank"
            className="font-semibold text-foreground underline underline-offset-3"
          >
            Privacy Notice
          </Link>
          .
        </Label>
      </div>
      <p id={descriptionId} className="sr-only">
        You may withdraw consent from Profile or by emailing tech@athreix.com.
        Required processing will stop and account access may end. Notice version{" "}
        {noticeVersion}.
      </p>
      <details className="group mt-2 pl-7 text-[0.6875rem] leading-4 text-muted-foreground">
        <summary className="cursor-pointer font-semibold text-foreground underline decoration-border underline-offset-3">
          What data Athreix processes
        </summary>
        <p className="mt-2 border-t pt-2">
          You may withdraw consent from Profile or by emailing tech@athreix.com.
          Required processing will stop and account access may end. Notice
          version {noticeVersion}.
        </p>
        <ul className="mt-2 space-y-1.5">
          {PRIVACY_CONSENT_DATA.map((item) => (
            <li key={item.id}>
              <strong className="font-semibold text-foreground">
                {item.label}:
              </strong>{" "}
              {item.description}.
            </li>
          ))}
        </ul>
      </details>
      {error ? (
        <p
          id={errorId}
          className="mt-2 pl-7 text-xs font-medium text-destructive"
        >
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
