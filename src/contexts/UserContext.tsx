import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { User, UserRole } from '../types';

interface UserContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  signUp: (email: string, pass: string, name: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  seed?: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) console.error('Error getting session:', error);

        if (session?.user && mounted) {
          await loadUserProfile(session.user.id);
        }
      } catch (err) {
        console.error('Unexpected error during session init:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          if (event === 'SIGNED_OUT') {
            setUser(null);
            return;
          }

          if (session?.user) {
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
    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (userData) {
      setUser({
        id: userId,
        name: userData.name,
        email: userData.email,
        role: userData.role as UserRole,
        employeeId: userData.employeeId,
      });
    }
    // If no profile yet, don't change user state - it will be set after signUp creates the profile
  };

  const login = async (email: string, pass: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });
    if (error) throw error;
    if (data.user) {
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
      preassignedRole = 'HR Admin';
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
        preassignedRole = 'HR Admin';
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
  };

  const seed = async () => {
    const { seedDatabase } = await import('../lib/seedDatabase');
    await seedDatabase();
  };

  return (
    <UserContext.Provider value={{ user, loading, login, signUp, loginWithGoogle, logout, seed }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within a UserProvider');
  return context;
}
