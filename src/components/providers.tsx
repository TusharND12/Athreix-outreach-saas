"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";

import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TooltipProvider delayDuration={350}>
        {children}
        <Toaster
          closeButton
          richColors
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast: "font-sans",
              title: "font-medium",
              description: "text-muted-foreground",
            },
          }}
        />
      </TooltipProvider>
    </SessionProvider>
  );
}
