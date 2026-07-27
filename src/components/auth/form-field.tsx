"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function FormField({
  label,
  error,
  hint,
  className,
  ...props
}: React.ComponentProps<typeof Input> & {
  label: string;
  error?: string;
  hint?: string;
}) {
  const generatedId = React.useId();
  const id = props.id ?? generatedId;
  const messageId = `${id}-message`;

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error || hint ? messageId : undefined}
        {...props}
      />
      {error ? (
        <p id={messageId} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-xs leading-5 text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const PasswordField = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<typeof Input>, "type"> & {
    label: string;
    error?: string;
    hint?: string;
  }
>(({ label, error, hint, className, id: providedId, ...props }, ref) => {
  const [visible, setVisible] = React.useState(false);
  const generatedId = React.useId();
  const id = providedId ?? generatedId;
  const messageId = `${id}-message`;

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          ref={ref}
          id={id}
          type={visible ? "text" : "password"}
          className="pr-12"
          aria-invalid={Boolean(error)}
          aria-describedby={error || hint ? messageId : undefined}
          {...props}
        />
        <button
          type="button"
          className="absolute right-0 top-0 inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? (
            <EyeOff aria-hidden="true" className="size-4" />
          ) : (
            <Eye aria-hidden="true" className="size-4" />
          )}
        </button>
      </div>
      {error ? (
        <p id={messageId} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-xs leading-5 text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
PasswordField.displayName = "PasswordField";
