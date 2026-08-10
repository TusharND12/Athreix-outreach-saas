import { initializePaddle, type Paddle } from "@paddle/paddle-js";

let paddlePromise: Promise<Paddle | undefined> | undefined;

export function getPaddleClient() {
  if (typeof window === "undefined") return Promise.resolve(undefined);
  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  const environment = process.env.NEXT_PUBLIC_PADDLE_ENV;
  if (
    !token ||
    !/^test_[A-Za-z\d]{27}$/.test(token) ||
    environment !== "sandbox"
  )
    return Promise.resolve(undefined);
  paddlePromise ??= initializePaddle({ token, environment: "sandbox" }).catch(
    (error: unknown) => {
      paddlePromise = undefined;
      throw error;
    },
  );
  return paddlePromise;
}
