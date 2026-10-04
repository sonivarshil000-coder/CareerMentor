import "server-only";
import { Queue } from "bullmq";
import IORedis from "ioredis";

let connection: IORedis | undefined;
let queue: Queue<{ userId: string; resumeId: string }> | undefined;

export function getResumeQueue() {
  if (!connection) {
    connection = new IORedis(
      process.env.REDIS_URL ?? "redis://localhost:6379",
      { maxRetriesPerRequest: null, enableReadyCheck: true },
    );
  }
  if (!queue) {
    queue = new Queue<{ userId: string; resumeId: string }>("resume-processing", {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2_000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 1_000 },
      },
    });
  }
  return queue;
}
