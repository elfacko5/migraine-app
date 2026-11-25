import { useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

// Auth is entirely optional — sync-related hooks check `session` and no-op
// against localStorage when it's null (signed out, or Supabase isn't
// configured at all). No one is forced to create an account to use the app.
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!!supabase);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => listener.subscription.unsubscribe();
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
   *   with auto-refresh stopped first so it can't write them back.
   *
   * Resolves `true` only when no session is left in storage.
   */
  const signOutThisDevice = useCallback(async (): Promise<boolean> => {
    if (!supabase) return true;
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) console.error('Sign-out reached no server; clearing locally:', error);
    } catch (e) {
      console.error('Sign-out failed; clearing locally:', e);
    }
    try {
      await supabase.auth.stopAutoRefresh();
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
  };
}
