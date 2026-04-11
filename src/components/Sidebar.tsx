import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  Clock, 
  LogOut,
  Building2,
  Menu,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useUser } from '../contexts/UserContext';
import { UserRole, Permission } from '../types';

const navItems: { icon: any, label: string, path: string, roles: UserRole[], permission?: Permission }[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/', roles: ['Admin', 'Manager', 'Employee', 'Finance'] },
  { icon: Users, label: 'Employee Directory', path: '/employees', roles: ['Admin', 'Manager'], permission: 'Manage_Users' },
  { icon: CreditCard, label: 'Payroll', path: '/payroll', roles: ['Admin', 'Finance'], permission: 'View_Salary' },
  { icon: Clock, label: 'Attendance', path: '/attendance', roles: ['Admin', 'Manager', 'Employee'] },
];

export function Sidebar() {
  const { user, logout, hasPermission } = useUser();
  const [isOpen, setIsOpen] = React.useState(false);

  const filteredNavItems = navItems.filter(item => {
    if (!user) return false;
    if (item.permission) return hasPermission(item.permission);
    return item.roles.includes(user.role);
  });

  return (
    <>
      {/* Mobile Menu Toggle - Floating */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-[#1e40af] text-white rounded-xl shadow-xl active:scale-95 transition-transform"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-gray-900/60 z-40 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside className={cn(
        "w-64 bg-[#1e40af] text-white flex flex-col h-screen transition-transform duration-300 ease-in-out z-40",
        "fixed inset-y-0 left-0 lg:sticky lg:top-0", // Mobile: Fixed/Floating, Desktop: Sticky/In-flow
        !isOpen && "-translate-x-full lg:translate-x-0" // Hidden on mobile, shown on desktop
      )}>
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
              onClick={() => setIsOpen(false)}
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
    </>
  );
}
