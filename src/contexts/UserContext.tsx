import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { User, UserRole, Permission } from '../types';
import { hasPermission as checkPermission, ROLE_PERMISSIONS } from '../lib/rbac';

interface UserContextType {
  user: User | null;
  loading: boolean;
  /** JWT app_metadata claims object — the raw source of truth for permissions. */
  jwtClaims: Record<string, unknown> | null;
  /**
   * Deny-by-Default permission check.
   * Returns true ONLY if the specific permission is found in the user's JWT claims.
   */
  hasPermission: (permission: Permission) => boolean;
  login: (email: string, pass: string) => Promise<void>;
  signUp: (email: string, pass: string, name: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  seed?: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  /** Raw JWT app_metadata claims. Permissions live here — they cannot be spoofed by the user. */
  const [jwtClaims, setJwtClaims] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let mounted = true;

    const initSession = async () => {
      console.log('UserContext: Initializing session...');
      const timeout = setTimeout(() => {
        if (mounted && loading) {
          console.warn('UserContext: Session initialization timed out after 10s. Forcing loading state to false.');
          setLoading(false);
        }
      }, 10000);

      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('UserContext: Error getting session:', error);
        }

        if (session?.user && mounted) {
          console.log('UserContext: Session found for user:', session.user.id);
          // Extract raw JWT app_metadata — this is the trusted claims source
          const claims = session.user.app_metadata as Record<string, unknown>;
          setJwtClaims(claims ?? null);
          await loadUserProfile(session.user.id);
        } else {
          console.log('UserContext: No active session found.');
        }
      } catch (err) {
        console.error('UserContext: Unexpected error during session init:', err);
      } finally {
        clearTimeout(timeout);
        if (mounted) {
          console.log('UserContext: Initialization complete.');
          setLoading(false);
        }
      }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          if (event === 'SIGNED_OUT') {
            setUser(null);
            setJwtClaims(null);
            return;
          }

          if (session?.user) {
            // Refresh JWT claims on every auth state change (e.g. TOKEN_REFRESHED)
            const claims = session.user.app_metadata as Record<string, unknown>;
            setJwtClaims(claims ?? null);
            await loadUserProfile(session.user.id);
          }
        } catch (err) {
          console.error('Unexpected error during auth state change:', err);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const loadUserProfile = async (userId: string) => {
    console.log('UserContext: Loading profile for userId:', userId);
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (userError) {
        console.error('UserContext: Error fetching user profile:', userError);
        return;
      }

      if (userData) {
        console.log('UserContext: User profile found:', userData.name);
        const role = userData.role as UserRole;
        const permissions = ROLE_PERMISSIONS[role] ?? [];
        
        let faceDescriptor = undefined;
        if (userData.employeeId) {
          console.log('UserContext: Fetching face descriptor for employee:', userData.employeeId);
          const { data: empData, error: empError } = await supabase
            .from('employees')
            .select('face_descriptor')
            .eq('id', userData.employeeId)
            .maybeSingle();
          
          if (empError) console.error('UserContext: Error fetching employee data:', empError);
          if (empData) faceDescriptor = empData.face_descriptor;
        }

        setUser({
          id: userId,
          name: userData.name,
          email: userData.email,
          role,
          employeeId: userData.employeeId,
          permissions,
          faceDescriptor,
        });
        console.log('UserContext: User state updated.');
      } else {
        console.warn('UserContext: No profile found in "users" table for Auth user:', userId);
      }
    } catch (err) {
      console.error('UserContext: Unexpected error in loadUserProfile:', err);
    }
  };

  /**
   * Deny-by-Default: Checks the user's JWT app_metadata claims.
   * Returns true ONLY if the specific permission string is explicitly present.
   * Falls back to role-based permissions if JWT claims are not yet populated
   * (e.g. before the database trigger runs for a new user).
   */
  const hasPermission = useCallback(
    (permission: Permission): boolean => {
      // Primary check: use JWT app_metadata (cannot be spoofed by the client)
      if (jwtClaims) {
        return checkPermission(jwtClaims, permission);
      }
      // Fallback: use in-memory permissions derived from role (for first-login edge cases)
      if (user?.permissions) {
        return user.permissions.includes(permission);
      }
      // Deny-by-Default: no claims, no permissions
      return false;
    },
    [jwtClaims, user]
  );

  const login = async (email: string, pass: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });
    if (error) throw error;
    if (data.user && data.session) {
      const claims = data.user.app_metadata as Record<string, unknown>;
      setJwtClaims(claims ?? null);
      await loadUserProfile(data.user.id);
    }
  };

  const signUp = async (email: string, pass: string, name: string) => {
    // 1. Check for bootstrapping (is this the first user?)
    const { data: configData } = await supabase
      .from('system_config')
      .select('*')
      .eq('id', 'config')
      .maybeSingle();

    const isFirstUser = !configData || !configData.isInitialized;

    // 2. Unless it's the first user, check for pre-registration in 'employees'
    let employeeId: string | null = null;
    let preassignedRole: UserRole = 'Employee';

    if (!isFirstUser) {
      const { data: empData } = await supabase
        .from('employees')
        .select('*')
        .eq('email', email);

      if (!empData || empData.length === 0) {
        throw new Error('Your email is not yet registered in our system. Please contact your HR department.');
      }

      employeeId = empData[0].id;
    } else {
      preassignedRole = 'Admin';
    }

    // 3. Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password: pass,
      options: { data: { full_name: name } }
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Failed to create user account.');

    if (!authData.session) {
      throw new Error('Please disable "Confirm email" in Supabase Dashboard → Authentication → Providers → Email, then try again.');
    }

    const userId = authData.user.id;

    try {
      // 4. Initialize user profile
      const { error: profileError } = await supabase.from('users').insert({
        id: userId,
        name,
        email,
        role: preassignedRole,
        employeeId: employeeId,
        createdAt: new Date().toISOString(),
      });

      if (profileError) throw profileError;

      // 5. If linked to an employee, update the employee record with the user ID
      if (employeeId) {
        await supabase
          .from('employees')
          .update({ userId: userId })
          .eq('id', employeeId);
      }

      // 6. If this was the first user, initialize the system config
      if (isFirstUser) {
        await supabase.from('system_config').upsert({
          id: 'config',
          isInitialized: true,
          initializedAt: new Date().toISOString(),
        });
      }

      // 7. Load the profile so the user state is set correctly
      await loadUserProfile(userId);

    } catch (err) {
      await supabase.auth.signOut();
      throw err;
    }
  };

  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    
    if (error) throw error;
  };

  // Handle post-OAuth profile creation for new Google users
  useEffect(() => {
    if (loading) return; // wait until initial session check is done

    const handleOAuthCallback = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const authUser = session.user;

      // Check if user already has a profile
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('id', authUser.id)
        .maybeSingle();

      if (existingUser) return; // Profile already exists

      // Check for first user bootstrapping
      const { data: configData } = await supabase
        .from('system_config')
        .select('*')
        .eq('id', 'config')
        .maybeSingle();

      const isFirstUser = !configData || !configData.isInitialized;
      let employeeId: string | null = null;
      let preassignedRole: UserRole = 'Employee';

      if (!isFirstUser) {
        const { data: empData } = await supabase
          .from('employees')
          .select('*')
          .eq('email', authUser.email);

        if (!empData || empData.length === 0) {
          await supabase.auth.signOut();
          return;
        }
        employeeId = empData[0].id;
      } else {
        preassignedRole = 'Admin';
      }

      await supabase.from('users').insert({
        id: authUser.id,
        name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
        email: authUser.email || '',
        role: preassignedRole,
        employeeId,
        createdAt: new Date().toISOString(),
      });

      if (employeeId) {
        await supabase.from('employees').update({ userId: authUser.id }).eq('id', employeeId);
      }

      if (isFirstUser) {
        await supabase.from('system_config').upsert({
          id: 'config',
          isInitialized: true,
          initializedAt: new Date().toISOString(),
        });
      }

      await loadUserProfile(authUser.id);
    };

    handleOAuthCallback();
  }, [loading]);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setJwtClaims(null);
    navigate('/login');
  };

  const seed = async () => {
    const { seedDatabase } = await import('../lib/seedDatabase');
    await seedDatabase();
  };

  return (
    <UserContext.Provider value={{ user, loading, jwtClaims, hasPermission, login, signUp, loginWithGoogle, logout, seed }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within a UserProvider');
  return context;
}
