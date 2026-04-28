/**
 * Roda uma vez no boot do servidor Next.js. Documentacao:
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startWorkers } = await import("./lib/queue");
    startWorkers();
  }
}
