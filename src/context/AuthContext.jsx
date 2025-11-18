import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

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

  useEffect(() => {
    if (!supabase) {
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
  }, []);

  const handlerFactory = (fn) => async (...args) => {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured. Add VITE_SUPABASE_ANON_KEY.') };
    }
    return fn(...args);
  };

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signIn: handlerFactory(async (email, password) =>
        supabase.auth.signInWithPassword({ email, password }),
      ),
      signUp: handlerFactory(async (email, password, metadata = {}) =>
        supabase.auth.signUp({ email, password, options: { data: metadata } }),
      ),
      signOut: handlerFactory(async () => {
        await supabase.auth.signOut();
      }),
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
