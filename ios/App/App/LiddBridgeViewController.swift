import UIKit
import Capacitor

/// Registers the app's own Capacitor plugins.
///
/// Capacitor auto-registers only what it finds in `packageClassList` inside
/// the generated `capacitor.config.json` — which lists installed npm packages
/// and nothing else. A plugin that lives in this target is therefore invisible
/// to it, and every call comes back `UNIMPLEMENTED` with no other symptom:
/// the bridge is up, the call crosses, and the web side just gets a rejection.
///
/// Adding the class name to `capacitor.config.json` would work until the next
/// `cap copy` regenerated the file — and that file is gitignored, so the
/// breakage would arrive on a fresh clone with nothing in the diff to explain
/// it. Registering here is the documented route and survives both.
///
/// **The storyboard points at this class, not `CAPBridgeViewController`.** If
/// `Main.storyboard` is ever regenerated from the Capacitor template, that
/// reference goes back to the base class and the widget stops updating.
class LiddBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        // **`registerPluginInstance`, not `registerPluginType`.** The type
        // variant returns immediately whenever `autoRegisterPlugins` is on,
        // which it is by default — so it compiles, runs, registers nothing,
        // and every call still comes back `UNIMPLEMENTED`. Cost an hour.
        bridge?.registerPluginInstance(LiddWidgetPlugin())
    }
}
