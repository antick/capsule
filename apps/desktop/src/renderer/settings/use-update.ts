import type { UpdateState } from "@capsule/config";
import { useEffect, useState } from "react";

/** How the update stands, kept in step with the main process that owns it. */
export function useUpdateState(): UpdateState | null {
  const [state, setState] = useState<UpdateState | null>(null);

  useEffect(() => window.capsule?.onUpdate(setState), []);

  return state;
}
