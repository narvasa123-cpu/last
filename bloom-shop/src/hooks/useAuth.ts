import {
  useCallback,
  createElement,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';

import { MOCK_USERS, ROLE_ROUTES } from '../lib/constants';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { Role, UserProfile } from '../lib/types';
import { getRoleFromProfile } from '../lib/utils';

const DEMO_STORAGE_KEY = 'bloom-demo-auth';
const PROFILE_SELECT = 'id, role_id, full_name, phone, address, avatar_url, points, tier, is_active, created_at, updated_at, roles(name)';

function getProfileCacheKey(userId: string) {
  return `bloom-profile-cache:${userId}`;
}

function readCachedProfile(userId?: string | null): UserProfile | null {
  if (!userId) {
    return null;
  }

  const raw = localStorage.getItem(getProfileCacheKey(userId));

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

function writeCachedProfile(profile: UserProfile) {
  localStorage.setItem(getProfileCacheKey(profile.id), JSON.stringify(profile));
}

interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  address?: string;
  role?: Role;
}

type ProfileRow = UserProfile & {
  roles?: { name?: Role }[] | { name?: Role } | null;
};

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  role: Role;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (payload: RegisterPayload) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: (userId?: string) => Promise<void>;
  saveProfile: (payload: Partial<UserProfile>) => Promise<{ error: string | null }>;
  updateDemoRole: (role: Role) => void;
  demoCredentials: Array<{ label: string; email: string; password: string; role: Role; route: string }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const demoCredentials = [
  { label: 'Customer Demo', email: 'customer@bloom.shop', password: 'Password123!', role: 'customer' as const },
  { label: 'Admin Demo', email: 'admin@bloom.shop', password: 'Password123!', role: 'admin' as const },
  { label: 'Rider Demo', email: 'rider@bloom.shop', password: 'Password123!', role: 'rider' as const },
  { label: 'Cashier Demo', email: 'cashier@bloom.shop', password: 'Password123!', role: 'cashier' as const },
].map((item) => ({ ...item, route: ROLE_ROUTES[item.role] }));

function buildDemoUser(role: Role, email: string): { user: User; profile: UserProfile } {
  const profile = MOCK_USERS.find((entry) => entry.role === role) ?? MOCK_USERS[0];
  const now = new Date().toISOString();

  return {
    user: {
      id: profile.id,
      app_metadata: { provider: 'email' },
      user_metadata: { full_name: profile.full_name, role },
      aud: 'authenticated',
      created_at: now,
      email,
    } as User,
    profile: { ...profile, role },
  };
}

function resolveRoleFromEmail(email: string): Role {
  const normalized = email.toLowerCase();
  if (normalized.includes('admin')) return 'admin';
  if (normalized.includes('rider')) return 'rider';
  if (normalized.includes('cashier')) return 'cashier';
  return 'customer';
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const profileRequests = useRef(new Map<string, Promise<UserProfile | null>>());
  const bootstrapped = useRef(false);

  const role = useMemo<Role>(() => {
    if (profile) {
      return getRoleFromProfile(profile);
    }
    const metadataRole = user?.user_metadata?.role;
    if (metadataRole && ['admin', 'customer', 'rider', 'cashier'].includes(metadataRole)) {
      return metadataRole as Role;
    }
    return 'customer';
  }, [profile, user]);

  const refreshProfile = useCallback(async (userId?: string) => {
    const targetId = userId ?? user?.id;
    if (!targetId) return;

    if (!isSupabaseConfigured) {
      const stored = localStorage.getItem(DEMO_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as { user: User; profile: UserProfile };
        setProfile(parsed.profile);
      }
      return;
    }

    const cachedRequest = profileRequests.current.get(targetId);
    const request =
      cachedRequest ??
      Promise.resolve(
        supabase
          .from('users')
          .select(PROFILE_SELECT)
          .eq('id', targetId)
          .maybeSingle(),
      ).then(({ data }) => {
          const row = data as ProfileRow | null;

          if (!row) {
            return null;
          }

          const resolvedRole = Array.isArray(row.roles) ? row.roles[0]?.name : row.roles?.name;

          const mappedProfile: UserProfile = {
            ...row,
            role: resolvedRole ?? getRoleFromProfile(row),
          };

          writeCachedProfile(mappedProfile);
          return mappedProfile;
        })
        .finally(() => {
          profileRequests.current.delete(targetId);
        });

    if (!cachedRequest) {
      profileRequests.current.set(targetId, request);
    }

    const nextProfile = await request;

    if (nextProfile) {
      setProfile(nextProfile);
    }
  }, [user?.id]);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      if (!isSupabaseConfigured) {
        const stored = localStorage.getItem(DEMO_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as { user: User; profile: UserProfile };
          if (mounted) {
            setUser(parsed.user);
            setProfile(parsed.profile);
          }
        }
        if (mounted) setLoading(false);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) {
        return;
      }

      if (session?.user) {
        setUser(session.user);

        const cachedProfile = readCachedProfile(session.user.id);
        if (cachedProfile) {
          setProfile(cachedProfile);
          setLoading(false);
        }

        void refreshProfile(session.user.id).finally(() => {
          if (mounted) {
            setLoading(false);
          }
        });
      } else {
        setLoading(false);
      }

      bootstrapped.current = true;
    }

    void bootstrap();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session: Session | null) => {
      if (!mounted) return;

      if (event === 'INITIAL_SESSION' && bootstrapped.current) {
        return;
      }

      setUser(session?.user ?? null);

      if (session?.user) {
        const cachedProfile = readCachedProfile(session.user.id);
        if (cachedProfile) {
          setProfile(cachedProfile);
          setLoading(false);
        } else {
          setLoading(true);
        }

        void refreshProfile(session.user.id).finally(() => {
          if (mounted) {
            setLoading(false);
          }
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [refreshProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      const role = resolveRoleFromEmail(email);
      const demoAuth = buildDemoUser(role, email);
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(demoAuth));
      setUser(demoAuth.user);
      setProfile(demoAuth.profile);
      setLoading(false);
      return { error: null };
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(async ({ fullName, email, password, phone, address, role = 'customer' }: RegisterPayload) => {
    if (!isSupabaseConfigured) {
      const seed = buildDemoUser(role, email);
      const profile: UserProfile = {
        ...seed.profile,
        full_name: fullName,
        phone: phone ?? seed.profile.phone,
        address: address ?? seed.profile.address,
        role,
      };
      const demoAuth = { user: seed.user, profile };
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(demoAuth));
      setUser(seed.user);
      setProfile(profile);
      setLoading(false);
      return { error: null };
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone,
          address,
          role,
        },
      },
    });

    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) {
      localStorage.removeItem(DEMO_STORAGE_KEY);
      setUser(null);
      setProfile(null);
      return;
    }
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, []);

  const saveProfile = useCallback(async (payload: Partial<UserProfile>) => {
    if (!profile || !user) {
      return { error: 'No active profile found.' };
    }

    const nextProfile = { ...profile, ...payload };

    if (!isSupabaseConfigured) {
      const demoAuth = { user, profile: nextProfile };
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(demoAuth));
      setProfile(nextProfile);
      return { error: null };
    }

    const { error } = await supabase
      .from('users')
      .update({
        full_name: nextProfile.full_name,
        phone: nextProfile.phone,
        address: nextProfile.address,
        avatar_url: nextProfile.avatar_url,
      })
      .eq('id', user.id);

    if (!error) {
      setProfile(nextProfile);
      writeCachedProfile(nextProfile);
    }

    return { error: error?.message ?? null };
  }, [profile, user]);

  const updateDemoRole = useCallback((nextRole: Role) => {
    if (isSupabaseConfigured || !user) return;
    const demoAuth = buildDemoUser(nextRole, user.email ?? `${nextRole}@bloom.shop`);
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(demoAuth));
    setUser(demoAuth.user);
    setProfile(demoAuth.profile);
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      role,
      loading,
      signIn,
      signUp,
      signOut,
      refreshProfile,
      saveProfile,
      updateDemoRole,
      demoCredentials,
    }),
    [loading, profile, role, user],
  );

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
