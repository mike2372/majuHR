import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  Clock, 
  LogOut,
  Building2,
  ChevronDown
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useUser } from '../contexts/UserContext';
import { UserRole } from '../types';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/', roles: ['HR Admin', 'Manager', 'Employee'] },
  { icon: Users, label: 'Employee Directory', path: '/employees', roles: ['HR Admin', 'Manager'] },
  { icon: CreditCard, label: 'Payroll', path: '/payroll', roles: ['HR Admin'] },
  { icon: Clock, label: 'Attendance', path: '/attendance', roles: ['HR Admin', 'Manager', 'Employee'] },
];

export function Sidebar() {
  const { user, switchRole } = useUser();
  const [showRoleSwitcher, setShowRoleSwitcher] = React.useState(false);

  const filteredNavItems = navItems.filter(item => 
    user && item.roles.includes(user.role)
  );

  return (
    <aside className="w-64 bg-[#1e40af] text-white flex flex-col h-screen sticky top-0">
      <div className="p-6 flex items-center gap-3">
        <div className="bg-white/10 p-2 rounded-lg">
          <Building2 className="w-8 h-8 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-xl leading-tight">MajuHR</h1>
          <p className="text-xs text-blue-200">Enterprise Edition</p>
        </div>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1">
        {filteredNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group",
                isActive 
                  ? "bg-white/15 text-white shadow-sm" 
                  : "text-blue-100 hover:bg-white/10 hover:text-white"
              )
            }
          >
            <item.icon className="w-5 h-5 opacity-80 group-hover:opacity-100" />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-white/10">
        <div className="relative mb-4">
          <button 
            onClick={() => setShowRoleSwitcher(!showRoleSwitcher)}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-lg hover:bg-white/10 transition-all text-left"
          >
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center font-bold text-white flex-shrink-0">
              {user?.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-sm font-semibold truncate">{user?.name}</p>
              <p className="text-xs text-blue-200 truncate">{user?.role}</p>
            </div>
            <ChevronDown className={cn("w-4 h-4 text-blue-200 transition-transform", showRoleSwitcher && "rotate-180")} />
          </button>

          {showRoleSwitcher && (
            <div className="absolute bottom-full left-0 w-full mb-2 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50">
              <div className="p-2 text-xs font-bold text-gray-400 uppercase tracking-wider bg-gray-50">Switch Role (Demo)</div>
              {(['HR Admin', 'Manager', 'Employee'] as UserRole[]).map((role) => (
                <button
                  key={role}
                  onClick={() => {
                    switchRole(role);
                    setShowRoleSwitcher(false);
                  }}
                  className={cn(
                    "w-full text-left px-4 py-2 text-sm hover:bg-blue-50 transition-colors",
                    user?.role === role ? "text-blue-600 font-bold bg-blue-50/50" : "text-gray-700"
                  )}
                >
                  {role}
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-blue-100 hover:bg-white/10 hover:text-white transition-all">
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
}
