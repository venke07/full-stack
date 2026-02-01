import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient.js';

const API_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
  (typeof process !== 'undefined' && (process.env?.VITE_API_URL || process.env?.API_URL)) ||
  'http://localhost:4000';

const AuthContext = createContext({
  session: null,
  user: null,
  loading: true,
  signIn: async () => ({ error: 'Supabase not configured.' }),
  signUp: async () => ({ error: 'Supabase not configured.' }),
  signOut: async () => {},
});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const disableAuthFlag =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DISABLE_AUTH === 'true') ||
    (typeof process !== 'undefined' && process.env?.VITE_DISABLE_AUTH === 'true');
  const bypassAuth = disableAuthFlag || !supabase;
  const fallbackSession = useMemo(
    () => ({ user: { id: 'dev-preview-user', email: 'preview@local.dev' } }),
    [],
  );

  useEffect(() => {
    if (bypassAuth) {
      setSession(fallbackSession);
      setLoading(false);
      return;
    }

    let ignore = false;

    supabase.auth.getSession().then(({ data, error }) => {
      if (ignore) return;
      if (!error) {
        setSession(data.session ?? null);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!ignore) {
        setSession(newSession);
      }
    });

    return () => {
      ignore = true;
      subscription.unsubscribe();
    };
  }, [bypassAuth, fallbackSession]);

  const handlerFactory = (fn) => async (...args) => {
    if (bypassAuth) {
      return { data: null, error: null };
    }
    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured. Add VITE_SUPABASE_ANON_KEY.') };
    }
    return fn(...args);
  };

  const performSignup = useCallback(
    async (email, password, metadata = {}) => {
      if (bypassAuth) {
        return { data: null, error: null };
      }
      if (!supabase) {
        return { data: null, error: new Error('Supabase not configured. Add VITE_SUPABASE_ANON_KEY.') };
      }

      try {
        const response = await fetch(`${API_URL}/api/auth/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, metadata }),
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok || !payload.success) {
          throw new Error(payload?.error || 'Profile creation failed.');
        }
      } catch (error) {
        return {
          data: null,
          error: error instanceof Error ? error : new Error('Profile creation failed.'),
        };
      }

      return supabase.auth.signInWithPassword({ email, password });
    },
    [bypassAuth],
  );

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signIn: handlerFactory(async (email, password) =>
        supabase.auth.signInWithPassword({ email, password }),
      ),
      signUp: performSignup,
      signOut: handlerFactory(async () => {
        if (bypassAuth) {
          setSession(fallbackSession);
          return { data: null, error: null };
        }
        await supabase.auth.signOut();
      }),
    }),
    [session, loading, bypassAuth, fallbackSession, performSignup],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
