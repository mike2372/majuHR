import React from 'react';
import { 
  Users, 
  UserCheck, 
  TrendingUp,
  Clock,
  MapPin,
  Globe
} from 'lucide-react';
import { AttendanceWidget } from './AttendanceWidget';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { useUser } from '../contexts/UserContext';
import { supabase } from '../lib/supabase';

const data = [
  { name: 'Jan', payroll: 45000 },
  { name: 'Feb', payroll: 46200 },
  { name: 'Mar', payroll: 48000 },
  { name: 'Apr', payroll: 47500 },
  { name: 'May', payroll: 49000 },
  { name: 'Jun', payroll: 51000 },
];

const attendanceData = [
  { day: 'Mon', present: 95 },
  { day: 'Tue', present: 98 },
  { day: 'Wed', present: 92 },
  { day: 'Thu', present: 96 },
  { day: 'Fri', present: 90 },
];

export function Dashboard() {
  const { user, seed, hasPermission } = useUser();
  const [employeeCount, setEmployeeCount] = React.useState(0);
  const [activeCount, setActiveCount] = React.useState(0);
  const [totalPayroll, setTotalPayroll] = React.useState(0);
  const [isSeeding, setIsSeeding] = React.useState(false);
  const [isRemoteAuthorized, setIsRemoteAuthorized] = React.useState(false);
  
  const canViewPayroll = hasPermission('View_Salary');
  const canManageUsers = hasPermission('Manage_Users');
  const isAdmin = user?.role === 'Admin';
  const isManager = user?.role === 'Manager';

  // Employees subscription
  React.useEffect(() => {
    const fetchEmployees = async () => {
      const { data } = await supabase.from('employees').select('*');
      if (data) {
        setEmployeeCount(data.length);
        setActiveCount(data.filter((e: any) => e.status === 'Active').length);
      }
    };
    fetchEmployees();

    const channel = supabase
      .channel('dashboard-employees')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, () => fetchEmployees())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Remote authorization check
  React.useEffect(() => {
    if (!user?.employeeId) return;
    
    const checkRemoteAuth = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from('remote_work_requests')
        .select('status')
        .eq('employee_id', user.employeeId)
        .eq('date', today)
        .eq('status', 'Approved')
        .maybeSingle();
      
      if (data) setIsRemoteAuthorized(true);
    };
    
    checkRemoteAuth();
  }, [user]);

  // Payroll subscription (if permitted)
  React.useEffect(() => {
    if (!canViewPayroll) return;

    const fetchPayroll = async () => {
      const { data } = await supabase.from('payroll').select('*');
      if (data) {
        const total = data.reduce((acc: number, doc: any) => acc + (doc.netSalary || 0), 0);
        setTotalPayroll(total);
      }
    };
    fetchPayroll();

    const channel = supabase
      .channel('dashboard-payroll')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payroll' }, () => fetchPayroll())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [canViewPayroll]);

  const handleSeed = async () => {
    if (window.confirm('Do you want to seed the database with mock staff? This will provide initial data for testing.')) {
      setIsSeeding(true);
      try {
        await seed?.();
        alert('Database seeded successfully!');
      } catch (error) {
        console.error(error);
        alert('Seeding failed.');
      } finally {
        setIsSeeding(false);
      }
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard Overview</h2>
        <p className="text-gray-500">Welcome back, {user?.name}. Here's what's happening today.</p>
      </div>

      {canManageUsers && employeeCount === 0 && (
        <div className="bg-blue-50 border border-blue-200 p-6 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-xl text-blue-600">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-blue-900">Get Started with MajuHR</h3>
              <p className="text-blue-800 text-sm">Welcome to your HR Dashboard! Would you like to seed your database with mock employees for testing?</p>
            </div>
          </div>
          <button 
            onClick={handleSeed}
            disabled={isSeeding}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50"
          >
            {isSeeding ? 'Seeding...' : 'Seed Mock Data'}
          </button>
        </div>
      )}

      {/* Attendance Widget for Current User */}
      {!isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-1">
            <AttendanceWidget />
          </div>
          <div className="lg:col-span-2 bg-gradient-to-br from-blue-600 to-indigo-700 p-6 lg:p-8 rounded-2xl text-white relative overflow-hidden shadow-xl">
            <div className="relative z-10">
              <h3 className="text-xl lg:text-2xl font-bold mb-2">Welcome to your workspace</h3>
              <p className="text-blue-100 mb-6 max-w-md text-sm lg:text-base">Access your payroll, manage leave, and track your attendance with real-time GPS verification.</p>
              <div className="flex flex-wrap gap-3 lg:gap-4">
                <div className="bg-white/10 backdrop-blur-md p-3 lg:p-4 rounded-xl border border-white/20 flex-1 min-w-[120px]">
                  <p className="text-[10px] lg:text-xs font-medium text-blue-200 uppercase tracking-wider mb-1">Office Hours</p>
                  <p className="font-bold text-sm lg:text-base">09:00 - 18:00</p>
                </div>
                <div className="bg-white/10 backdrop-blur-md p-3 lg:p-4 rounded-xl border border-white/20 flex-1 min-w-[120px]">
                  <p className="text-[10px] lg:text-xs font-medium text-blue-200 uppercase tracking-wider mb-1">Your Department</p>
                  <p className="font-bold text-sm lg:text-base">{user?.role === 'Employee' ? 'Operations' : user?.role}</p>
                </div>
                {isRemoteAuthorized && (
                  <div className="bg-emerald-400/20 backdrop-blur-md p-3 lg:p-4 rounded-xl border border-emerald-400/30 flex items-center gap-3 w-full lg:w-auto">
                    <Globe className="w-4 h-4 lg:w-5 lg:h-5 text-emerald-300" />
                    <div>
                      <p className="text-[10px] font-bold text-emerald-200 uppercase tracking-widest leading-none mb-1">Status</p>
                      <p className="font-bold text-xs lg:text-sm text-emerald-100">Remote Work Authorized</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="absolute right-[-20px] bottom-[-20px] opacity-10 hidden lg:block">
              <Clock className="w-64 h-64" />
            </div>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="mb-8">
           <AttendanceWidget />
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <StatCard 
          icon={Users} 
          label="Total Employees" 
          value={employeeCount.toString()} 
          trend="Live from Supabase"
          color="bg-blue-500"
        />
        <StatCard 
          icon={UserCheck} 
          label="Active Employees" 
          value={activeCount.toString()} 
          trend={`${Math.round((activeCount / (employeeCount || 1)) * 100)}% of total`}
          color="bg-green-500"
        />
        <StatCard 
          icon={Clock} 
          label="Today's Attendance" 
          value="95%" 
          trend="Real-time syncing"
          color="bg-amber-500"
        />
        {canViewPayroll && (
          <StatCard 
            icon={TrendingUp} 
            label="Total Payroll" 
            value={`RM ${totalPayroll.toLocaleString()}`} 
            trend="All records"
            color="bg-purple-500"
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Payroll Trend - Only if permitted */}
        {canViewPayroll && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold mb-6">Payroll Expenditure Trend (RM)</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="payroll" fill="#1e40af" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Attendance Rate - For Admin and Manager */}
        {(isAdmin || isManager) && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold mb-6">Weekly Attendance Rate (%)</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={attendanceData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="present" 
                    stroke="#10b981" 
                    strokeWidth={3} 
                    dot={{ r: 4, fill: '#10b981' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Recent Activities */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-lg font-semibold">Recent Activities</h3>
          <button className="text-blue-600 text-sm font-medium hover:underline">View all</button>
        </div>
        <div className="divide-y divide-gray-50">
          <ActivityItem 
            title="Payroll Processed" 
            desc="Payroll for February 2024 has been successfully processed." 
            time="2 hours ago"
            type="payroll"
          />
          <ActivityItem 
            title="New Employee Joined" 
            desc="Tan Wei Keong has been added to the Finance department." 
            time="1 day ago"
            type="employee"
          />
          <ActivityItem 
            title="Leave Approved" 
            desc="Muthu Arumugam's annual leave request has been approved." 
            time="2 days ago"
            type="attendance"
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, trend, color }: any) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start gap-4">
      <div className={`${color} p-3 rounded-lg text-white`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        <p className="text-xs text-gray-400 mt-1">{trend}</p>
      </div>
    </div>
  );
}

function ActivityItem({ title, desc, time, type }: any) {
  return (
    <div className="p-6 flex gap-4 hover:bg-gray-50 transition-colors">
      <div className="mt-1">
        <div className={`w-2.5 h-2.5 rounded-full ${
          type === 'payroll' ? 'bg-purple-500' : 
          type === 'employee' ? 'bg-blue-500' : 'bg-amber-500'
        }`} />
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-start">
          <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
          <span className="text-xs text-gray-400">{time}</span>
        </div>
        <p className="text-sm text-gray-500 mt-1">{desc}</p>
      </div>
    </div>
  );
}
