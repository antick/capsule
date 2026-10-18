import Darwin

/// Hands memory that has been freed back to the system. Scanning the agents'
/// logs parses megabytes of JSON a minute; once it is done, the allocator
/// would otherwise keep those pages for good, half the app's footprint.
public func releaseFreedMemory() {
  malloc_zone_pressure_relief(nil, 0)
}
