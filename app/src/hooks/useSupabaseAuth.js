import { useEffect, useState } from 'react';
import { hasSupabaseConfig, supabase } from '../services/supabaseClient';

const formatAuthError = (err, fallback = 'Auth error') => {
  if (!err) return fallback;
  const parts = [];
  if (err.status) parts.push(`status=${err.status}`);
  if (err.code) parts.push(`code=${err.code}`);
  if (err.name) parts.push(`name=${err.name}`);
  if (err.message) parts.push(`message=${err.message}`);
  return parts.length ? parts.join(' | ') : fallback;
};

export const useSupabaseAuth = () => {
  const isTest = import.meta.env.MODE === 'test';
  const hasConfig = hasSupabaseConfig && Boolean(supabase);

  const [isReady, setIsReady] = useState(isTest || !hasConfig);
  const [user, setUser] = useState(isTest ? { email: 'test@example.com' } : null);
  const [error, setError] = useState(
    isTest || hasConfig ? null : 'Falta configurar VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY',
  );

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

    const { data: authSubscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsReady(true);
    });

    return () => {
      active = false;
      authSubscription.subscription.unsubscribe();
    };
  }, [isTest, hasConfig]);

  const signInWithPassword = async ({ email, password }) => {
    if (isTest) return { ok: true, error: null };
    if (!supabase) return { ok: false, error: 'Supabase no inicializado' };
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      return {
        ok: false,
        error: formatAuthError(signInError, 'No se pudo iniciar sesion'),
      };
    }
    setError(null);
    return { ok: true, error: null };
  };

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
      return {
        ok: false,
        error: formatAuthError(otpError, 'No se pudo enviar el magic link'),
      };
    }
    setError(null);
    return { ok: true, error: null };
  };

  const signOut = async () => {
    if (isTest) return { ok: true, error: null };
    if (!supabase) return { ok: false, error: 'Supabase no inicializado' };
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      return {
        ok: false,
        error: formatAuthError(signOutError, 'No se pudo cerrar sesion'),
      };
    }
    return { ok: true, error: null };
  };

  return {
    isReady,
    isAuthenticated: Boolean(user),
    user,
    error,
    signInWithPassword,
    signInWithMagicLink,
    signOut,
  };
};
