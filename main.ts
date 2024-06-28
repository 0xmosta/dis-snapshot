import { main } from "./snapshot.ts";

Deno.cron("DIS-SNAPSHOT", { minute: { every: 10 } }, async () => {
  await main()
})