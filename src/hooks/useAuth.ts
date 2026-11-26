import { useState, useEffect, useCallback, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

// Auth is entirely optional — sync-related hooks check `session` and no-op
// against localStorage when it's null (signed out, or Supabase isn't
// configured at all). No one is forced to create an account to use the app.
// "Signed out on this device" (2026-11-26): set when a session ends without
// this app asking — signed out everywhere from another device, or a refresh
// token that stopped working. Kept until the next sign-in or until it's
// dismissed, so it survives the reload that often follows. Not `hd_`: it is
// about this phone's session, not diary data, so export and Delete all data
// leave it alone.
const SIGNED_OUT_NOTICE_KEY = 'lidd_signed_out_notice';
const readNotice = () => { try { return localStorage.getItem(SIGNED_OUT_NOTICE_KEY) === '1'; } catch { return false; } };
const writeNotice = (on: boolean) => {
  try { if (on) localStorage.setItem(SIGNED_OUT_NOTICE_KEY, '1'); else localStorage.removeItem(SIGNED_OUT_NOTICE_KEY); } catch { /* best effort */ }
};

// Whether this device held a stored session when the app started, read
// synchronously as the module loads. supabase-js recovers the stored session
// asynchronously (it needs the network to refresh it), so this read always
// comes first. If the server has since revoked it (signed out everywhere, or
// a refresh token that died while the app was closed), the recovery removes
// the session before our listener is attached, and the only sign of that is
// a session that was stored and isn't there now. bootDelete clears `sb-` keys
// earlier still, so Delete all data never reads as a remote sign-out.
const storedSessionAtLaunch = (() => {
  try { return Object.keys(localStorage).some((k) => k.startsWith('sb-') && k.endsWith('-auth-token')); } catch { return false; }
})();

// The app's own sign-outs, marked in shared storage so another open tab that
// hears the same SIGNED_OUT (supabase-js broadcasts it between tabs) knows it
// was asked for, not imposed. A stamp, not a flag: it only counts briefly.
const OWN_SIGN_OUT_KEY = 'lidd_own_sign_out_at';
const markOwnSignOut = () => { try { localStorage.setItem(OWN_SIGN_OUT_KEY, String(Date.now())); } catch { /* best effort */ } };
const clearOwnSignOut = () => { try { localStorage.removeItem(OWN_SIGN_OUT_KEY); } catch { /* best effort */ } };
const ownSignOutRecently = () => {
  try { return Date.now() - Number(localStorage.getItem(OWN_SIGN_OUT_KEY) ?? 0) < 30_000; } catch { return false; }
};

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!!supabase);
  const [signedOutElsewhere, setSignedOutElsewhere] = useState(readNotice);
  // Set just before this app signs out itself, so its own SIGNED_OUT event
  // isn't mistaken for one from elsewhere.
  const ownSignOut = useRef(false);
  const hadSession = useRef(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      // getSession waits for the recovery, so a stored session that's gone
      // by now was ended somewhere else (see storedSessionAtLaunch). Gone
      // means gone *from storage*. Offline (or on a server fault) with an
      // expired token, supabase-js returns no session but keeps the stored
      // one: still signed in, no notice. A revoked token is removed — and
      // that also comes back with an error, so the error can't be the test.
      const tokenStillStored = (() => {
        try { return Object.keys(localStorage).some((k) => k.startsWith('sb-') && k.endsWith('-auth-token')); } catch { return true; }
      })();
      if (storedSessionAtLaunch && !data.session && !tokenStillStored && !ownSignOutRecently()) {
        writeNotice(true);
        setSignedOutElsewhere(true);
      }
      hadSession.current = !!data.session;
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'SIGNED_OUT' && hadSession.current && !ownSignOut.current && !ownSignOutRecently()) {
        writeNotice(true);
        setSignedOutElsewhere(true);
      }
      if (event === 'SIGNED_OUT') ownSignOut.current = false;
      if (next) { writeNotice(false); setSignedOutElsewhere(false); }
      hadSession.current = !!next;
      setSession(next);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const dismissSignedOutNotice = useCallback(() => {
    writeNotice(false);
    setSignedOutElsewhere(false);
  }, []);

  const signInWithEmail = useCallback(async (email: string) => {
    if (!supabase) throw new Error('Sync is not configured');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw error;
  }, []);

  // Tapping the emailed link always opens Safari on iOS, never a standalone
  // home-screen app (a hard platform limitation, not fixable client-side) —
  // typing the 6-digit code from the same email completes sign-in without
  // ever leaving the app.
  const verifyEmailCode = useCallback(async (email: string, token: string) => {
    if (!supabase) throw new Error('Sync is not configured');
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (error) throw error;
  }, []);

  // Resolves whether the sign-out went through. supabase-js *returns* an
  // error offline or on a server fault rather than throwing, keeps the
  // session, and sends no SIGNED_OUT — so the own-sign-out flag is reset in
  // `finally`, never left set to swallow a later real one, and the caller
  // says so instead of leaving someone signed in without a word.
  const signOut = useCallback(async (): Promise<boolean> => {
    if (!supabase) return true;
    ownSignOut.current = true;
    markOwnSignOut();
    try {
      const { error } = await supabase.auth.signOut();
      if (error) { console.error('Sign-out failed:', error); clearOwnSignOut(); }
      return !error;
    } catch (e) {
      console.error('Sign-out failed:', e);
      clearOwnSignOut();
      return false;
    } finally {
      ownSignOut.current = false;
    }
  }, []);

  /**
   * Signs out **this device only**, and is sure of it — for Delete all data.
   *
   * - `scope: 'local'`: the default `'global'` revokes every refresh token,
   *   signing the account out on every other phone and laptop too.
   * - Offline (or an expired token that can't refresh), supabase-js *returns*
   *   an error instead of throwing and keeps the stored session — so a reload
   *   would still be signed in and sync the deleted diary straight back. The
   *   stored `sb-` keys are therefore cleared here whatever the server said,
   *   with auto-refresh stopped first so it can't write them back. A late
   *   refresh inside a timed-out signOut could still save one: the reload
   *   that follows ends that page, and boot clears `sb-` keys again
   *   (`runPendingDelete`).
   *
   * Resolves `true` only when no session is left in storage.
   */
  const signOutThisDevice = useCallback(async (): Promise<boolean> => {
    if (!supabase) return true;
    ownSignOut.current = true;
    markOwnSignOut();
    try {
      // Stopped first: nothing may refresh and re-save a session from here on.
      await supabase.auth.stopAutoRefresh();
    } catch { /* clearing below is what counts */ }
    // **Time-boxed.** With an expired token offline, supabase-js retries the
    // refresh with backoff for ~30 s before signOut returns — the dialog sat
    // locked on "Deleting…" all that time. The server call is a courtesy;
    // clearing the stored keys below is what makes it certain.
    const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 3000));
    try {
      const res = await Promise.race([supabase.auth.signOut({ scope: 'local' }), timeout]);
      if (res === 'timeout') console.error('Sign-out timed out; clearing locally');
      else if (res.error) console.error('Sign-out reached no server; clearing locally:', res.error);
    } catch (e) {
      console.error('Sign-out failed; clearing locally:', e);
    }
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith('sb-')) localStorage.removeItem(k);
      const cleared = !Object.keys(localStorage).some((k) => k.startsWith('sb-'));
      // A sign-out that didn't happen mustn't mute a real one for 30 s.
      if (!cleared) clearOwnSignOut();
      return cleared;
    } catch {
      clearOwnSignOut();
      return false;
    } finally {
      // Clearing the keys by hand sends no SIGNED_OUT, and a timed-out
      // signOut may never send one: reset here, not in the listener.
      ownSignOut.current = false;
    }
  }, []);

  return {
    enabled: !!supabase,
    session,
    user: session?.user ?? null,
    loading,
    signInWithEmail,
    verifyEmailCode,
    signOut,
    signOutThisDevice,
    signedOutElsewhere,
    dismissSignedOutNotice,
  };
}
