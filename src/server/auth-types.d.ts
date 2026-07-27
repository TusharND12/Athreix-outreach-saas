import type { DefaultSession } from "next-auth";
import type { AppRole } from "@/server/auth-context";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      workspaceId?: string;
      role?: AppRole;
      isPlatformAdmin?: boolean;
    };
  }

  interface User {
    workspaceId?: string;
    role?: AppRole;
    isPlatformAdmin?: boolean;
    sessionVersion?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    workspaceId?: string;
    role?: AppRole;
    isPlatformAdmin?: boolean;
    sessionVersion?: number;
    authInvalid?: boolean;
  }
}
