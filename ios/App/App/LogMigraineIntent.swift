import AppIntents
import Foundation

/// "Hey Siri, log a migraine".
///
/// The intent cannot write an attack itself: attacks live in `localStorage`
/// inside the WebView, which native code has no access to. So it does what the
/// user-built Shortcut did — capture what was said and hand it to the web layer
/// — except it needs no setup from the user and is spoken to Siri directly.
///
/// The handoff goes through `UserDefaults`, which is exactly where
/// `@capacitor/preferences` reads and writes (`UserDefaults.standard`, keys
/// prefixed `CapacitorStorage.`), so the web side picks it up with a plain
/// `Preferences.get` and no custom bridge. Keep `pendingVoiceEntry` in step with
/// `PENDING_VOICE_KEY` in `src/App.tsx`.
///
/// App Intents need iOS 16; the app's deployment target is 15, hence the
/// availability gate. On iOS 15 the app simply has no Siri support.
@available(iOS 16.0, *)
struct LogMigraineIntent: AppIntent {
    static var title: LocalizedStringResource = "Log a migraine"
    static var description = IntentDescription(
        "Start logging a migraine, describing how it feels out loud."
    )

    /// Opens the app so the logging wizard can be reviewed and confirmed —
    /// nothing is ever saved without the user seeing it.
    static var openAppWhenRun: Bool = true

    @Parameter(title: "How it feels")
    var note: String?

    func perform() async throws -> some IntentResult {
        // Optional parameters are not prompted for automatically, so ask when
        // the phrase carried no description ("Hey Siri, log a migraine"). If
        // the request fails or is dismissed, fall through and just open the
        // app — an unprefilled wizard is still a usable outcome.
        var spoken = note
        if spoken?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true {
            spoken = try? await $note.requestValue("How does it feel?")
        }

        if let spoken, !spoken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            UserDefaults.standard.set(spoken, forKey: "CapacitorStorage.pendingVoiceEntry")
        }

        return .result()
    }
}

/// Registers the phrase with Siri and the Shortcuts app at install time, so
/// there is nothing for the user to configure. Every phrase has to contain
/// `\(.applicationName)`.
@available(iOS 16.0, *)
struct MigraineAppShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: LogMigraineIntent(),
            phrases: [
                "Log a migraine in \(.applicationName)",
                "Log a headache in \(.applicationName)",
                "Start a migraine in \(.applicationName)",
                "Track a migraine in \(.applicationName)"
            ],
            shortTitle: "Log a migraine",
            systemImageName: "brain.head.profile"
        )
    }
}
