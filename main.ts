import { main } from "./snapshot.ts";

Deno.cron("DIS-SNAPSHOT", { hour: { every: 12 } }, async () => {
  await main()
})