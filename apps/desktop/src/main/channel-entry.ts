import { AGENT_COPY } from "@capsule/config";

// Keep old setup commands inert too. Re-enabling requires a reviewed code change.
console.error(AGENT_COPY.disabled);
process.exitCode = 1;
