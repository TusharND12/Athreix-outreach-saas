import { initializePaddle, type Paddle } from "@paddle/paddle-js";

let paddlePromise: Promise<Paddle | undefined> | undefined;

export function getPaddleClient() {
  if (typeof window === "undefined") return Promise.resolve(undefined);
  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  const environment = process.env.NEXT_PUBLIC_PADDLE_ENV;
  const credentialsMatchEnvironment =
    (environment === "sandbox" && /^test_[A-Za-z\d]{27}$/.test(token ?? "")) ||
    (environment === "production" && /^live_[A-Za-z\d]{27}$/.test(token ?? ""));
  if (!token || !credentialsMatchEnvironment) return Promise.resolve(undefined);
  paddlePromise ??= initializePaddle({ token, environment }).catch(
    (error: unknown) => {
      paddlePromise = undefined;
      throw error;
    },
  );
  return paddlePromise;
}
