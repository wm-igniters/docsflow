export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("instrumentation: initializing data sync...");
    try {
      // We use a dynamic import to ensure this runs only on the server
      const { default: runIntegritySync } = await import(
        "./scripts/sync-github.mjs"
      );
      await runIntegritySync();
      console.log("instrumentation: data sync completed.");
    } catch (err) {
      console.error("instrumentation: data sync failed", err);
    }
  }
}
