import ExpoModulesCore
import HealthKit

/// A live Traditional Strength Training workout on the iPhone itself (HKWorkoutSession on iPhone needs iOS 26).
/// Ending it writes the workout to Apple Health with the real start and end. Every entry point fails soft (returns
/// false) on older iOS.
@available(iOS 26.0, *)
private final class StrengthSession {
  let session: HKWorkoutSession
  let builder: HKLiveWorkoutBuilder

  init(store: HKHealthStore, startedAt: Date) async throws {
    let config = HKWorkoutConfiguration()
    config.activityType = .traditionalStrengthTraining
    config.locationType = .indoor
    session = try HKWorkoutSession(healthStore: store, configuration: config)
    builder = session.associatedWorkoutBuilder()
    builder.dataSource = HKLiveWorkoutDataSource(healthStore: store, workoutConfiguration: config)
    session.startActivity(with: startedAt)
    try await builder.beginCollection(at: startedAt)
  }

  /// Saves the workout to Health with [start, endedAt]. False if Health refused it.
  func finish(endedAt: Date) async -> Bool {
    session.end()
    do {
      try await builder.endCollection(at: endedAt)
      return try await builder.finishWorkout() != nil
    } catch {
      builder.discardWorkout()
      return false
    }
  }

  func discard() {
    session.end()
    builder.discardWorkout()
  }
}

public final class CompoundWorkoutSessionModule: Module {
  private let store = HKHealthStore()
  private let lock = NSLock()
  private var current: Any?

  private func swap(_ next: Any?) -> Any? {
    lock.lock()
    defer { lock.unlock() }
    let old = current
    current = next
    return old
  }

  private func drop(_ old: Any?) {
    if #available(iOS 26.0, *), let s = old as? StrengthSession { s.discard() }
  }

  public func definition() -> ModuleDefinition {
    Name("CompoundWorkoutSession")

    /// Starts the session at `startedAtMs` (epoch ms). Returns whether a live session is now running.
    AsyncFunction("start") { (startedAtMs: Double) async -> Bool in
      guard #available(iOS 26.0, *), HKHealthStore.isHealthDataAvailable() else { return false }
      self.drop(self.swap(nil)) // never leave a stale session running
      do {
        let s = try await StrengthSession(store: self.store, startedAt: Date(timeIntervalSince1970: startedAtMs / 1000))
        self.drop(self.swap(s))
        return true
      } catch {
        return false
      }
    }

    /// Ends the running session and saves it to Health. False when there was none (e.g. the app was killed
    /// mid-workout) or Health refused it, so the caller can fall back to writing the workout itself.
    AsyncFunction("finish") { (endedAtMs: Double) async -> Bool in
      guard #available(iOS 26.0, *), let s = self.swap(nil) as? StrengthSession else { return false }
      return await s.finish(endedAt: Date(timeIntervalSince1970: endedAtMs / 1000))
    }

    /// Ends the running session without saving anything.
    AsyncFunction("discard") { () -> Void in
      self.drop(self.swap(nil))
    }
  }
}
