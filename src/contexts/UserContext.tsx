import React, { createContext, useContext, useState, ReactNode } from 'react';
import { User, UserRole } from '../types';

interface UserContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  switchRole: (role: UserRole) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const MOCK_USERS: Record<UserRole, User> = {
  'HR Admin': { id: 'U1', name: 'John Doe', email: 'john.doe@majuhr.com', role: 'HR Admin' },
  'Manager': { id: 'U2', name: 'Siti Aminah', email: 'siti.a@majuhr.com', role: 'Manager', employeeId: 'EMP002' },
  'Employee': { id: 'U3', name: 'Ahmad Zulkifli', email: 'ahmad.z@majuhr.com', role: 'Employee', employeeId: 'EMP001' },
};

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(MOCK_USERS['HR Admin']);

  const switchRole = (role: UserRole) => {
    setUser(MOCK_USERS[role]);
  };

  return (
    <UserContext.Provider value={{ user, setUser, switchRole }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
