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
    <fieldset className="mb-5 rounded-xl border bg-muted/35 p-4">
      <legend className="px-1 text-sm font-semibold text-foreground">
        DPDP data-processing consent
      </legend>
      <div id={descriptionId} className="space-y-3 text-xs leading-5">
        <p className="text-muted-foreground">
          To create or access your account and provide the features you request,
          Athreix processes:
        </p>
        <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
          {PRIVACY_CONSENT_DATA.map((item) => (
            <li key={item.id}>
              <strong className="font-semibold text-foreground">
                {item.label}:
              </strong>{" "}
              {item.description}.
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground">
          We use this data to authenticate and secure your workspace, deliver
          requested research, list and export features, and manage credits,
          subscriptions and support. Read the{" "}
          <Link
            href="/privacy"
            target="_blank"
            className="font-semibold text-foreground underline underline-offset-3"
          >
            Privacy Notice
          </Link>
          . You may withdraw consent through your Profile privacy controls or by
          emailing{" "}
          <a
            href="mailto:tech@athreix.com"
            className="font-semibold text-foreground underline underline-offset-3"
          >
            tech@athreix.com
          </a>
          ; withdrawing processing needed for the Service may end account
          access. Notice version {noticeVersion}.
        </p>
      </div>
      <div className="mt-4 flex items-start gap-3 border-t pt-4">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          aria-invalid={Boolean(error)}
          aria-describedby={`${descriptionId}${error ? ` ${errorId}` : ""}`}
        />
        <Label htmlFor={id} className="text-xs leading-5 text-muted-foreground">
          I freely give this specific consent for the data and purposes listed
          above.
        </Label>
      </div>
      {error ? (
        <p id={errorId} className="mt-2 text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
