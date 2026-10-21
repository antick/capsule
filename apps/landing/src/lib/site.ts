import plist from "../../../../Support/CapsuleApp/Info.plist?raw";

// The app's version lives only in its Info.plist (see scripts/version.sh).
// The page is deployed from a release tag, so the download link below
// always names files that release published.
const version = plist.match(
  /<key>CFBundleShortVersionString<\/key>\s*<string>(\d+\.\d+\.\d+)<\/string>/,
)?.[1];
if (!version) throw new Error("No CFBundleShortVersionString in Info.plist");

const repository = "https://github.com/antick/capsule";

export const site = {
  name: "Capsule",
  url: "https://capsule.potion.sh",
  title: "Capsule — Your AI coding limits, at the edge of your screen",
  description:
    "A small macOS dock for Claude, Codex, Grok, Cursor and more: every session and weekly limit, its pace and its reset, where your eyes already go.",
  version,
  repository,
  releases: `${repository}/releases`,
  changelog: `${repository}/blob/main/CHANGELOG.md`,
  license: `${repository}/blob/main/LICENSE`,
  security: `${repository}/security/policy`,
  build: `${repository}#build-it-yourself`,
  download: `${repository}/releases/download/v${version}/Capsule-${version}-arm64.dmg`,
  brew: "brew install --cask antick/tap/capsule",
  potion: "https://potion.sh",
};

export const navigation = [
  { label: "Features", href: "#features" },
  { label: "Themes", href: "#themes" },
  { label: "Providers", href: "#providers" },
  { label: "Privacy", href: "#privacy" },
];

export const features = [
  {
    title: "Session and week at a glance",
    description:
      "Two rings per provider, or a gauge that drains as you use it. Each turns amber, then red, as a limit gets close.",
  },
  {
    title: "Pace, not just percent",
    description:
      "Every window shows whether you're ahead of an even pace, and when it runs out at your current rate.",
  },
  {
    title: "Agent activity",
    description:
      "See when Claude Code, Codex or Grok sessions are working, waiting on you, or done, with quiet notices that never steal focus.",
  },
  {
    title: "Tokens and spend",
    description:
      "Today's and the last 30 days' tokens, with an estimated cost at list price from local logs.",
  },
  {
    title: "Every account",
    description:
      "Add as many Claude Code and Codex accounts as you use, found automatically or by folder, each named the way you like.",
  },
  {
    title: "Heads-up alerts",
    description:
      "A notification when a window crosses 50% or 20% left, or your own thresholds, and a small celebration when the week resets.",
  },
  {
    title: "Provider status",
    description: "An incident on a provider's status page puts a dot on its ring.",
  },
  {
    title: "Easy on the battery",
    description:
      "Reads more often while agents work and less while you're away, and backs off on Low Power Mode.",
  },
  {
    title: "Scriptable",
    description: "capsule --pretty prints the same limits as JSON for scripts and agents.",
  },
];

export const providers = [
  { name: "Claude", reads: "Session, week, activity, tokens", signIn: "Claude Code's login" },
  { name: "Codex", reads: "Session, week, activity, tokens", signIn: "Codex's login" },
  { name: "Grok", reads: "Usage, activity, tokens", signIn: "Grok CLI's login" },
  { name: "Cursor", reads: "Usage and spend", signIn: "Cursor's login" },
  { name: "Antigravity", reads: "Usage", signIn: "The running app, or its saved login" },
  { name: "Devin", reads: "Usage", signIn: "Devin's app login, or a pasted key" },
  { name: "OpenRouter", reads: "Balance and spend", signIn: "A pasted API key" },
  { name: "DeepSeek", reads: "Balance", signIn: "A pasted API key" },
];

export const questions = [
  {
    question: "Do I need a new account?",
    answer:
      "No. Capsule reads the logins your tools already keep on this Mac. There is no Capsule account and no extra sign-in.",
  },
  {
    question: "What leaves my Mac?",
    answer:
      "Only each provider's own usage request, sent to that provider, and a daily update check to GitHub. Your credentials and readings never go anywhere else.",
  },
  {
    question: "Does it control my agents?",
    answer:
      "No. Activity notices are passive: Capsule installs no hooks, sends no prompts, approves nothing and never drives an agent.",
  },
  {
    question: "Which Macs does it run on?",
    answer:
      "macOS 14 Sonoma or newer, on Apple silicon. Releases are signed with Developer ID, notarized by Apple, and update themselves from signed releases.",
  },
  {
    question: "What happens when a provider changes something?",
    answer:
      "The dock keeps the last good reading and marks it stale rather than guessing. A tool may show as unavailable until Capsule catches up.",
  },
];
