let lastSeenAt = 0

export function markDisputesSeen() {
  lastSeenAt = Date.now()
}

export function getDisputesLastSeenAt() {
  return lastSeenAt
}
