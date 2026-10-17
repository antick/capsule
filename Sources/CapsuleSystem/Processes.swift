import Darwin
import Foundation

/// Whether a process with this pid exists, whoever owns it: a refusal to
/// signal it means it is there and belongs to someone else.
public func isProcessAlive(_ pid: Int) -> Bool {
  // Signal 0 to pid 0 or below would address a whole process group.
  guard pid > 0, pid <= Int(Int32.max) else { return false }
  return kill(pid_t(pid), 0) == 0 || errno == EPERM
}

/// When a process started, from the kernel's own process table, or nil.
/// Asked of `sysctl` rather than `ps`, so no subprocess is spawned for it.
public func processStartTime(_ pid: Int) -> Date? {
  guard pid > 0, pid <= Int(Int32.max) else { return nil }
  var info = kinfo_proc()
  var size = MemoryLayout<kinfo_proc>.stride
  var mib: [Int32] = [CTL_KERN, KERN_PROC, KERN_PROC_PID, Int32(pid)]
  // A pid nobody holds still "succeeds", with nothing written.
  guard sysctl(&mib, UInt32(mib.count), &info, &size, nil, 0) == 0, size == MemoryLayout<kinfo_proc>.stride
  else { return nil }
  let started = info.kp_proc.p_un.__p_starttime
  guard started.tv_sec > 0 else { return nil }
  return Date(timeIntervalSince1970: Double(started.tv_sec) + Double(started.tv_usec) / 1_000_000)
}
