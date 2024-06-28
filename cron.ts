import { main } from "./snapshot.ts";

Deno.cron("DIS-SNAPSHOT", { hour: { every: 6 } }, async () => {
  await main()
})