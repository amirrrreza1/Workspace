import type { NotificationChannel } from "@reminder/domain";

export class NotFoundError extends Error {}

export class ConflictError extends Error {}

export class ProviderUnavailableError extends Error {
  constructor(readonly channel: NotificationChannel) {
    super(`${channel} is not configured by the server.`);
  }
}

export class StaleWriteError extends Error {
  constructor(
    readonly current?: unknown,
    message = "The resource has changed since it was loaded.",
  ) {
    super(message);
  }
}
