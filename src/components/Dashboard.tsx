import React from 'react';
import { 
  Users, 
  UserCheck, 
  TrendingUp,
  Clock
} from 'lucide-react';
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
import { MOCK_EMPLOYEES } from '../mockData';
import { useUser } from '../contexts/UserContext';

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
  const { user } = useUser();
  const isHRAdmin = user?.role === 'HR Admin';
  const isManager = user?.role === 'Manager';

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard Overview</h2>
        <p className="text-gray-500">Welcome back, {user?.name}. Here's what's happening today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          icon={Users} 
          label="Total Employees" 
          value={MOCK_EMPLOYEES.length.toString()} 
          trend="+2 this month"
          color="bg-blue-500"
        />
        <StatCard 
          icon={UserCheck} 
          label="Active Employees" 
          value="4" 
          trend="100% of total"
          color="bg-green-500"
        />
        <StatCard 
          icon={Clock} 
          label="Today's Attendance" 
          value="75%" 
          trend="3 on leave"
          color="bg-amber-500"
        />
        {isHRAdmin && (
          <StatCard 
            icon={TrendingUp} 
            label="Total Payroll (Feb)" 
            value="RM 7,578" 
            trend="+5.2% vs Jan"
            color="bg-purple-500"
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Payroll Trend - Only for HR Admin */}
        {isHRAdmin && (
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

        {/* Attendance Rate - For HR Admin and Manager */}
        {(isHRAdmin || isManager) && (
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
