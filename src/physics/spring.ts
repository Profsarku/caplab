// Spring physics — event-driven, no fixed durations
// Receives impulses, decays naturally. Works at any frame rate.
// Usage: excite on event → stepSpring in useFrame → reads spring.position

export interface Spring {
  position: number
  velocity: number
  stiffness: number   // k — spring pull-back force
  damping: number     // d — energy loss per frame
}

export function createSpring(stiffness = 35, damping = 9): Spring {
  return { position: 0, velocity: 0, stiffness, damping }
}

// Fire an impulse into the spring (call on event: snap, error, etc.)
export function excite(spring: Spring, impulse: number) {
  spring.velocity += impulse
}

// Advance spring by delta seconds — call every frame
export function stepSpring(spring: Spring, delta: number): number {
  const clampedDelta = Math.min(delta, 0.05) // guard against large spikes
  const force = -spring.stiffness * spring.position - spring.damping * spring.velocity
  spring.velocity += force * clampedDelta
  spring.position += spring.velocity * clampedDelta
  return spring.position
}

// Settle immediately (on disconnect, reset, etc.)
export function settleSpring(spring: Spring) {
  spring.position = 0
  spring.velocity = 0
}

export function isAtRest(spring: Spring, threshold = 0.0005): boolean {
  return Math.abs(spring.position) < threshold && Math.abs(spring.velocity) < threshold
}
