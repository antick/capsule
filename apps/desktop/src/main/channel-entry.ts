import { startClaudeChannel } from "@capsule/activity";

void startClaudeChannel().catch((error) => {
  console.error("Capsule channel failed:", error);
  process.exitCode = 1;
});
