import Foundation
import Capacitor
import UIKit

/// Presents a real `UIDatePicker` and hands the chosen value back to the web
/// layer, so `DateTimeField` can stop using a native `<input type="time">`.
///
/// **Why this exists.** WebKit draws its own chrome above a date/time input's
/// picker — a "Reset" button and a large blue checkmark — and nothing in the
/// page or in the WKWebView API reaches it. `@capacitor/keyboard`'s
/// `setAccessoryBarVisible` was tried first (2026-09-02) on the theory that it
/// was the keyboard's input accessory bar; it is not, the swizzle had no
/// effect on it, and the dependency was removed again. The only way to a bare
/// wheel is not to use a native input at all.
///
/// The picker itself is the system one. What is ours is the container: a
/// dimmed backdrop and a card at the bottom of the screen, dismissed by
/// tapping outside it, which is what was asked for.
///
/// **Presented over a custom container rather than a `UISheetPresentationController`.**
/// The deployment target is iOS 15, where sheets exist but custom detents do
/// not (iOS 16) — so a sheet would have to be `.medium()`, half the screen for
/// a 216pt wheel. A plain `.overFullScreen` controller gives the exact height
/// on both, with the same tap-outside-to-dismiss behaviour.
///
/// **Spinning the wheel and tapping away commits.** That matches what the
/// WebKit control did (its value tracked the wheel live) and what "tap outside
/// to close" means everywhere else on iOS. There is no Cancel: the field it
/// came from is still there to correct.
@objc(LiddDatePickerPlugin)
public class LiddDatePickerPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiddDatePickerPlugin"
    public let jsName = "LiddDatePicker"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "present", returnType: CAPPluginReturnPromise)
    ]

    /// The web layer's own local-input format — `isoToLocalInput`'s output,
    /// wall-clock in the device's zone. Kept in this shape rather than ISO so
    /// nothing has to convert on either side, and `en_US_POSIX` so a user's
    /// locale can't reinterpret the pattern.
    private static let format: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd'T'HH:mm"
        return f
    }()

    @objc func present(_ call: CAPPluginCall) {
        let mode = call.getString("mode") ?? "time"
        guard let value = call.getString("value"),
              let date = LiddDatePickerPlugin.format.date(from: value) else {
            call.reject("Must provide a value as yyyy-MM-ddTHH:mm")
            return
        }
        let min = call.getString("min").flatMap { LiddDatePickerPlugin.format.date(from: $0) }
        let max = call.getString("max").flatMap { LiddDatePickerPlugin.format.date(from: $0) }

        DispatchQueue.main.async { [weak self] in
            guard let host = self?.bridge?.viewController else {
                call.reject("No view controller to present from")
                return
            }
            let picker = LiddDatePickerViewController(
                mode: mode == "datetime" ? .dateAndTime : .time,
                date: date, min: min, max: max
            ) { picked in
                call.resolve(["value": LiddDatePickerPlugin.format.string(from: picked)])
            }
            host.present(picker, animated: true)
        }
    }
}

private final class LiddDatePickerViewController: UIViewController {
    private let picker = UIDatePicker()
    private let card = UIView()
    private let onDone: (Date) -> Void

    init(mode: UIDatePicker.Mode, date: Date, min: Date?, max: Date?, onDone: @escaping (Date) -> Void) {
        self.onDone = onDone
        super.init(nibName: nil, bundle: nil)
        picker.datePickerMode = mode
        // The wheel, not the compact/inline styles — a compact picker would
        // present WebKit's problem again in a different costume, and the wheel
        // is what "a regular iOS time picker" means.
        picker.preferredDatePickerStyle = .wheels
        picker.date = date
        picker.minimumDate = min
        picker.maximumDate = max
        modalPresentationStyle = .overFullScreen
        modalTransitionStyle = .crossDissolve
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        // The app is dark-only (`color-scheme: dark` globally), and a system
        // picker following a light device would be the brightest thing on a
        // screen the palette works to keep quiet.
        overrideUserInterfaceStyle = .dark
        view.backgroundColor = UIColor(white: 0, alpha: 0.45)

        // Tapping the backdrop is the only way out, by design. `cancelsTouchesInView`
        // stays true so a tap that lands on the card itself never reaches this.
        let tap = UITapGestureRecognizer(target: self, action: #selector(dismissSelf))
        tap.delegate = self
        view.addGestureRecognizer(tap)

        // Mirrors --color-bg-surface (#262421). The palette is copied by hand
        // here for the same reason the widget copies it: this is not the web
        // build and cannot read a CSS variable.
        card.backgroundColor = UIColor(red: 0x26 / 255, green: 0x24 / 255, blue: 0x21 / 255, alpha: 1)
        card.layer.cornerRadius = 16
        card.layer.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]
        card.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(card)

        picker.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(picker)

        NSLayoutConstraint.activate([
            card.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            card.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            card.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            picker.topAnchor.constraint(equalTo: card.topAnchor, constant: 8),
            picker.leadingAnchor.constraint(equalTo: card.leadingAnchor),
            picker.trailingAnchor.constraint(equalTo: card.trailingAnchor),
            // The home indicator, so the wheel's bottom row isn't sitting on it.
            picker.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -8),
        ])
    }

    @objc private func dismissSelf() {
        onDone(picker.date)
        dismiss(animated: true)
    }
}

extension LiddDatePickerViewController: UIGestureRecognizerDelegate {
    func gestureRecognizer(_ g: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
        // Only a touch outside the card counts as "tap outside" — without this
        // every spin of the wheel would dismiss the thing being spun.
        !card.frame.contains(touch.location(in: view))
    }
}
