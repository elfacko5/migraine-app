// TEMPORARY. A readout of the numbers that decide where the keyboard leaves the
// page, for the phone check in docs/decisions.md, "Option A failed on the phone".
// Off unless the bundle is built with VITE_VIEWPORT_PROBE=1, so a normal build
// does not contain it (main.tsx imports it only behind that flag). Remove with
// `git revert` of the commit that added it. Never to main.
//
// Three lines at the top of the screen, never inside the app frame:
//   rest: the numbers before any field was focused
//   kb:   the numbers about a second after the last focus (keyboard up)
//   now:  live
// Each line: innerHeight, visualViewport height / offsetTop / scale, the 100dvh
// probe, the frame's height and its --app-frame-height and transform, and the
// plugin's own keyboardHeight and resize mode.
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

const r = (n: number) => Math.round(n * 10) / 10;

export function startViewportProbe(): void {
  const box = document.createElement('pre');
  box.setAttribute('aria-hidden', 'true');
  box.style.cssText =
    'position:fixed;top:0;left:0;right:0;z-index:2147483647;margin:0;padding:calc(env(safe-area-inset-top) + 2px) 4px 2px;' +
    'font:10px/1.25 ui-monospace,Menlo,monospace;color:#fff;background:rgba(0,0,0,.85);white-space:pre-wrap;pointer-events:none';
  document.body.appendChild(box);

  let mode = '?';
  let kbH = 0;
  let rest = '(not yet)';
  let kb = '(no focus yet)';
  let focused = false;
  let timer: number | undefined;

  const read = () => {
    const vv = window.visualViewport;
    const frame = document.querySelector<HTMLElement>('[data-app-root]');
    const probe = frame?.firstElementChild as HTMLElement | null;
    return (
      `iH ${window.innerHeight} vv ${vv ? r(vv.height) : '-'}/${vv ? r(vv.offsetTop) : '-'}/x${vv ? r(vv.scale) : '-'} ` +
      `dvh ${probe ? probe.offsetHeight : '-'} frame ${frame ? r(frame.getBoundingClientRect().height) : '-'} ` +
      `var ${frame?.style.getPropertyValue('--app-frame-height') || 'unset'} tf ${frame?.style.transform || 'none'} ` +
      `plugin ${mode} kbH ${kbH}`
    );
  };
  const draw = () => {
    box.textContent = `rest: ${rest}\nkb:   ${kb}\nnow:  ${read()}`;
  };

  if (Capacitor.isNativePlatform()) {
    Keyboard.getResizeMode().then((m) => (mode = m.mode)).catch(() => {});
    Keyboard.addListener('keyboardWillShow', (i) => {
      kbH = i.keyboardHeight;
    });
    Keyboard.addListener('keyboardDidHide', () => {
      kbH = 0;
    });
  }

  document.addEventListener(
    'focusin',
    (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement)) return;
      if (!focused) rest = read();
      focused = true;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        kb = read();
        draw();
      }, 1200);
    },
    true,
  );
  document.addEventListener('focusout', () => {
    focused = false;
  }, true);

  window.setTimeout(() => {
    rest = read();
    draw();
  }, 1500);
  window.setInterval(draw, 250);
}
