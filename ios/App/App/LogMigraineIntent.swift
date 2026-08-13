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

    /// Required, with a prompt, so App Intents asks for it during *parameter
    /// resolution* — before `perform()` runs and before the app opens. It was
    /// optional at first, with a `requestValue` call inside `perform()` as the
    /// fallback: optional parameters are never prompted for automatically, and
    /// the in-perform request didn't prompt either once `openAppWhenRun` was
    /// set, so Siri silently ran with no text and just opened the app.
    ///
    /// Three narrow questions rather than one open one. Siri ends dictation on
    /// its own, so a long rambling answer gets cut off part-way — and since
    /// severity tends to come last, it was what got lost. Each of these fits
    /// inside the window Siri allows, and asking separately means a cut-off
    /// answer costs one field instead of everything after it.
    ///
    /// All three are required, because **optional parameters are never
    /// prompted for automatically** — an optional one is simply skipped, which
    /// is how this intent originally managed to run with no text at all. The
    /// cost is that Siri insists on an answer, so "nothing" is a valid reply
    /// and parses to nothing.
    @Parameter(
        title: "How it feels",
        requestValueDialog: IntentDialog("Where does it hurt, and how bad out of ten?")
    )
    var note: String

    @Parameter(
        title: "When it started",
        requestValueDialog: IntentDialog("When did it start?")
    )
    var started: String

    @Parameter(
        title: "Anything else",
        requestValueDialog: IntentDialog("Anything else? Medication, or what's helping.")
    )
    var extras: String

    func perform() async throws -> some IntentResult {
        // "Nothing"/"no" are how a required parameter gets skipped out loud;
        // treat them as an empty answer rather than as something the user said.
        func clean(_ raw: String) -> String {
            let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            let bare = trimmed.lowercased().trimmingCharacters(in: .punctuationCharacters)
            return ["no", "nothing", "none", "nope", "skip", "no thanks"].contains(bare) ? "" : trimmed
        }

        // Written as JSON because the three answers must stay separate: "an
        // hour ago" is a time, but run through the pain parser its number
        // becomes a severity of one. The web side falls back to treating a
        // non-JSON value as a plain transcript, which is what the Siri Shortcut
        // deep link still sends.
        let payload: [String: String] = [
            "note": clean(note),
            "started": clean(started),
            "extras": clean(extras)
        ]

        if let data = try? JSONSerialization.data(withJSONObject: payload),
           let json = String(data: data, encoding: .utf8) {
            UserDefaults.standard.set(json, forKey: "CapacitorStorage.pendingVoiceEntry")
            // The app may already be running and merely brought forward, in
            // which case nothing else forces the write to disk before the web
            // layer reads it back.
            UserDefaults.standard.synchronize()
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
            // Every word the user might reach for, not just the one the app is
            // named after. A phrase that isn't listed doesn't fail loudly — Siri
            // just opens the app and asks nothing, which looks like the intent
            // is broken. "Attack" is what the rest of the app calls these.
            phrases: [
                "Log a migraine in \(.applicationName)",
                "Log an attack in \(.applicationName)",
                "Log a headache in \(.applicationName)",
                "Start a migraine in \(.applicationName)",
                "Start an attack in \(.applicationName)",
                "Track a migraine in \(.applicationName)",
                "Track an attack in \(.applicationName)",
                "Record an attack in \(.applicationName)",
                "New migraine in \(.applicationName)",
                "New attack in \(.applicationName)"
            ],
            shortTitle: "Log a migraine",
            systemImageName: "brain.head.profile"
        )
    }
}
