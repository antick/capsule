import { NOTICE_IPC } from "@capsule/config";
import { expect, it, vi } from "vitest";
import type { CapsuleBridge } from "./index.ts";

const io = vi.hoisted(() => ({
  expose: vi.fn(),
  invoke: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  send: vi.fn(),
}));
vi.mock("electron", () => ({
  contextBridge: { exposeInMainWorld: io.expose },
  ipcRenderer: { invoke: io.invoke, on: io.on, off: io.off, send: io.send },
}));
it("does not replace a live notice update with an older initial snapshot", async () => {
  await import("./index.ts");
  const bridge = io.expose.mock.calls[0]?.[1] as CapsuleBridge;
  let finish: (value: unknown[]) => void = () => {};
  io.invoke.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const receive = vi.fn();
  const stop = bridge.onActivityNotices(receive);
  const handler = io.on.mock.calls.find(
    ([channel]) => channel === NOTICE_IPC.changed,
  )?.[1];
  handler({}, [{ id: "new" }]);
  finish([{ id: "old" }]);
  await Promise.resolve();
  expect(receive.mock.calls).toEqual([[[{ id: "new" }]]]);
  bridge.readActivityNotices(["new"]);
  expect(io.send).toHaveBeenCalledWith(NOTICE_IPC.read, ["new"]);
  stop();
  expect(io.off).toHaveBeenCalledWith(NOTICE_IPC.changed, handler);
});
