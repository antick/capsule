import type { CapsuleBridge } from "./index.ts";

declare global {
  interface Window {
    capsule: CapsuleBridge;
  }
}
