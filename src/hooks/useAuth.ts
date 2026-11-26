import { useState, useEffect, useCallback, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

// Auth is entirely optional — sync-related hooks check `session` and no-op
// against localStorage when it's null (signed out, or Supabase isn't
// configured at all). No one is forced to create an account to use the app.
// "Signed out on this phone" (2026-11-26): set when a session ends without
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
      hadSession.current = !!data.session;
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'SIGNED_OUT' && hadSession.current && !ownSignOut.current) {
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

  const signOut = useCallback(async () => {
    if (!supabase) return;
    ownSignOut.current = true;
    await supabase.auth.signOut();
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
      return !Object.keys(localStorage).some((k) => k.startsWith('sb-'));
    } catch {
      return false;
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
