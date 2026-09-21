/**
 * Rider authentication state. Persists JWT in safe storage and keeps the API
 * client token in sync.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { api, setAuthToken } from '@/api/client';
import type { ApprovalStatus, Role, Token } from '@/api/types';
import { safeGetItem, safeRemoveItem, safeSetItem } from '@/lib/safe-storage';

const TOKEN_KEY = 'digimess.token';
const ROLE_KEY = 'digimess.role';
const ROLES_KEY = 'digimess.roles';

interface AuthState {
  token: string | null;
  role: Role | null;
  roles: Role[];
  loading: boolean;
  approvalStatus: ApprovalStatus | null;
  approvalLoading: boolean;
}

interface AuthContextValue extends AuthState {
  isApproved: boolean;
  refreshSession: () => Promise<void>;
  loginRider: (email: string, password: string) => Promise<void>;
  loginRiderOtp: (phone: string, code: string) => Promise<void>;
  requestRiderOtp: (phone: string) => Promise<string | null>;
  registerRider: (body: {
    email: string;
    password: string;
    full_name: string;
    phone?: string;
    emergency_contact?: string;
    vehicle_type: string;
    vehicle_number: string;
    license_number: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    role: null,
    roles: [],
    loading: true,
    approvalStatus: null,
    approvalLoading: false,
  });

  useEffect(() => {
    (async () => {
      try {
        const [token, role, rolesRaw] = await Promise.all([
          safeGetItem(TOKEN_KEY),
          safeGetItem(ROLE_KEY),
          safeGetItem(ROLES_KEY),
        ]);
        if (token) setAuthToken(token);
        const parsedRole = role === 'rider' ? 'rider' : null;
        setState({
          token: token ?? null,
          role: parsedRole,
          roles: rolesRaw ? (JSON.parse(rolesRaw) as Role[]).filter((r) => r === 'rider') : [],
          loading: false,
          approvalStatus: null,
          approvalLoading: !!token,
        });
      } catch {
        setState({ token: null, role: null, roles: [], loading: false, approvalStatus: null, approvalLoading: false });
      }
    })();
  }, []);


  const refreshSession = useCallback(async (tokenOverride?: string | null) => {
    const activeToken = tokenOverride ?? state.token;
    if (!activeToken) {
      setState((s) => ({ ...s, approvalStatus: null, approvalLoading: false }));
      return;
    }
    setState((s) => ({ ...s, approvalLoading: true }));
    try {
      const me = await Promise.race([
        api.me(),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Session check timed out')), 6000);
        }),
      ]);
      setState((s) => ({
        ...s,
        approvalStatus: me.rider_profile?.approval_status ?? null,
        approvalLoading: false,
      }));
    } catch {
      setAuthToken(null);
      await Promise.all([
        safeRemoveItem(TOKEN_KEY),
        safeRemoveItem(ROLE_KEY),
        safeRemoveItem(ROLES_KEY),
      ]);
      setState({
        token: null,
        role: null,
        roles: [],
        loading: false,
        approvalStatus: null,
        approvalLoading: false,
      });
    }
  }, [state.token]);

  useEffect(() => {
    if (state.token && state.role === 'rider' && state.approvalStatus === null && state.approvalLoading) {
      void refreshSession(state.token);
    }
  }, [state.token, state.role, state.approvalStatus, state.approvalLoading, refreshSession]);

  const persist = useCallback(async (t: Token) => {
    setAuthToken(t.access_token);
    await Promise.all([
      safeSetItem(TOKEN_KEY, t.access_token),
      safeSetItem(ROLE_KEY, t.role),
      safeSetItem(ROLES_KEY, JSON.stringify(t.roles)),
    ]);
    setState({
      token: t.access_token,
      role: t.role,
      roles: t.roles,
      loading: false,
      approvalStatus: null,
      approvalLoading: true,
    });
    try {
      const me = await api.me();
      setState({
        token: t.access_token,
        role: t.role,
        roles: t.roles,
        loading: false,
        approvalStatus: me.rider_profile?.approval_status ?? null,
        approvalLoading: false,
      });
    } catch {
      setAuthToken(null);
      await Promise.all([
        safeRemoveItem(TOKEN_KEY),
        safeRemoveItem(ROLE_KEY),
        safeRemoveItem(ROLES_KEY),
      ]);
      setState({ token: null, role: null, roles: [], loading: false, approvalStatus: null, approvalLoading: false });
    }
  }, []);

  const loginRider = useCallback(
    async (email: string, password: string) => persist(await api.loginRider(email, password)),
    [persist]
  );

  const requestRiderOtp = useCallback(async (phone: string) => {
    const resp = await api.requestRiderOtp(phone);
    return resp.dev_code ?? null;
  }, []);

  const loginRiderOtp = useCallback(
    async (phone: string, code: string) => persist(await api.verifyRiderOtp(phone, code)),
    [persist]
  );

  const registerRider = useCallback(
    async (body: Parameters<typeof api.registerRider>[0]) => persist(await api.registerRider(body)),
    [persist]
  );

  const logout = useCallback(async () => {
    setAuthToken(null);
    await Promise.all([
      safeRemoveItem(TOKEN_KEY),
      safeRemoveItem(ROLE_KEY),
      safeRemoveItem(ROLES_KEY),
    ]);
    setState({ token: null, role: null, roles: [], loading: false, approvalStatus: null, approvalLoading: false });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      isApproved: state.approvalStatus === 'approved',
      refreshSession,
      loginRider,
      loginRiderOtp,
      requestRiderOtp,
      registerRider,
      logout,
    }),
    [state, refreshSession, loginRider, loginRiderOtp, requestRiderOtp, registerRider, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
