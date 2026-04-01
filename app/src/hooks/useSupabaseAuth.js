import { useEffect, useState } from 'react';
import { hasSupabaseConfig, supabase } from '../services/supabaseClient';

/**
 * Formats a Supabase auth error into a human-readable string.
 * @param {object|null} err - The error object from Supabase.
 * @param {string} fallback - Default message if no error detail is available.
 * @returns {string}
 */
const formatAuthError = (err, fallback = 'Auth error') => {
  if (!err) return fallback;
  const parts = [];
  if (err.status) parts.push(`status=${err.status}`);
  if (err.code) parts.push(`code=${err.code}`);
  if (err.name) parts.push(`name=${err.name}`);
  if (err.message) parts.push(`message=${err.message}`);
  return parts.length ? parts.join(' | ') : fallback;
};

/**
 * Manages Supabase authentication state and exposes login/logout actions.
 *
 * Supports three authentication methods:
 * - Email + password (`signInWithPassword`)
 * - Magic link OTP (`signInWithMagicLink`)
 * - Password reset flow (`resetPasswordForEmail` → `updatePassword`)
 *
 * In test mode (`MODE === 'test'`) all async operations are no-ops and
 * `isAuthenticated` is always true.
 *
 * @returns {{
 *   isReady: boolean,
 *   isAuthenticated: boolean,
 *   isPasswordRecovery: boolean,
 *   user: object|null,
 *   error: string|null,
 *   signInWithPassword: (opts: {email: string, password: string}) => Promise<{ok: boolean, error: string|null}>,
 *   signInWithMagicLink: (opts: {email: string}) => Promise<{ok: boolean, error: string|null}>,
 *   resetPasswordForEmail: (email: string) => Promise<{ok: boolean, error: string|null}>,
 *   updatePassword: (newPassword: string) => Promise<{ok: boolean, error: string|null}>,
 *   signOut: () => Promise<{ok: boolean, error: string|null}>,
 * }}
 */
export const useSupabaseAuth = () => {
  const isTest = import.meta.env.MODE === 'test';
  const hasConfig = hasSupabaseConfig && Boolean(supabase);

  const [isReady, setIsReady] = useState(isTest || !hasConfig);
  const [user, setUser] = useState(isTest ? { email: 'test@example.com' } : null);
  const [error, setError] = useState(
    isTest || hasConfig ? null : 'Falta configurar VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY',
  );
  // True when the user arrives via a password-reset email link.
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    if (isTest) return;
    if (!hasConfig) return;

    let active = true;
    const bootstrap = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!active) return;
      setUser(session?.user ?? null);
      setIsReady(true);
    };
    bootstrap();

    const { data: authSubscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        // User clicked the password-reset link in their email.
        // Keep them "logged in" for the updateUser call but show the set-password form.
        setIsPasswordRecovery(true);
        setUser(session?.user ?? null);
        setIsReady(true);
        return;
      }
      if (event === 'USER_UPDATED') {
        setIsPasswordRecovery(false);
      }
      setUser(session?.user ?? null);
      setIsReady(true);
    });

    return () => {
      active = false;
      authSubscription.subscription.unsubscribe();
    };
  }, [isTest, hasConfig]);

  /** Sign in with email and password. */
  const signInWithPassword = async ({ email, password }) => {
    if (isTest) return { ok: true, error: null };
    if (!supabase) return { ok: false, error: 'Supabase no inicializado' };
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      return { ok: false, error: formatAuthError(signInError, 'No se pudo iniciar sesion') };
    }
    setError(null);
    return { ok: true, error: null };
  };

  /**
   * Send a magic-link OTP email. The link redirects back to the app's base URL
   * so the Supabase client can exchange the token automatically.
   */
  const signInWithMagicLink = async ({ email }) => {
    if (isTest) return { ok: true, error: null };
    if (!supabase) return { ok: false, error: 'Supabase no inicializado' };
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
      },
    });
    if (otpError) {
      return { ok: false, error: formatAuthError(otpError, 'No se pudo enviar el magic link') };
    }
    setError(null);
    return { ok: true, error: null };
  };

  /**
   * Send a password-reset email. The link redirects back to the app, which
   * detects the PASSWORD_RECOVERY event and shows the set-password form.
   * @param {string} email
   */
  const resetPasswordForEmail = async (email) => {
    if (isTest) return { ok: true, error: null };
    if (!supabase) return { ok: false, error: 'Supabase no inicializado' };
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
    });
    if (resetError) {
      return { ok: false, error: formatAuthError(resetError, 'No se pudo enviar el email de restablecimiento') };
    }
    return { ok: true, error: null };
  };

  /**
   * Set a new password for the currently authenticated user.
   * Only valid after a PASSWORD_RECOVERY flow.
   * @param {string} newPassword
   */
  const updatePassword = async (newPassword) => {
    if (isTest) return { ok: true, error: null };
    if (!supabase) return { ok: false, error: 'Supabase no inicializado' };
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      return { ok: false, error: formatAuthError(updateError, 'No se pudo actualizar la contraseña') };
    }
    setIsPasswordRecovery(false);
    return { ok: true, error: null };
  };

  /** Sign out the current user. */
  const signOut = async () => {
    if (isTest) return { ok: true, error: null };
    if (!supabase) return { ok: false, error: 'Supabase no inicializado' };
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      return { ok: false, error: formatAuthError(signOutError, 'No se pudo cerrar sesion') };
    }
    return { ok: true, error: null };
  };

  return {
    isReady,
    isAuthenticated: Boolean(user),
    isPasswordRecovery,
    user,
    error,
    signInWithPassword,
    signInWithMagicLink,
    resetPasswordForEmail,
    updatePassword,
    signOut,
  };
};
