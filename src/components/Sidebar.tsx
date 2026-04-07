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
  const { user, logout } = useUser();
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
        <div className="mb-4">
          <div className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-left">
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center font-bold text-white flex-shrink-0">
              {(user?.name || 'User').split(' ').map(n => n[0]).join('')}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-sm font-semibold truncate">{user?.name}</p>
              <p className="text-xs text-blue-200 truncate">{user?.role}</p>
            </div>
          </div>
        </div>
        <button 
          onClick={logout}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-blue-100 hover:bg-white/10 hover:text-white transition-all text-left"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </button>
        
        <div className="mt-4 px-4 py-2 bg-white/5 rounded-lg border border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest text-blue-300 font-bold">Status</span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Production</span>
            </span>
          </div>
          <p className="text-[10px] text-blue-300/60 mt-1">v1.0.0 • Powered by Supabase</p>
        </div>
      </div>
    </aside>
  );
}
