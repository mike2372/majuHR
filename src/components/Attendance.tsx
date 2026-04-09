import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  UserCheck, 
  UserX, 
  MoreHorizontal,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Globe,
  LayoutList
} from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { AttendanceRecord, Employee } from '../types';
import { RemoteWorkTab } from './RemoteWorkTab';

export function Attendance() {
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().slice(0, 10)); // Current date string
  const [searchTerm, setSearchTerm] = useState('');
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activeTab, setActiveTab] = useState<'log' | 'remote'>('log');

  // Supabase Subscriptions
  useEffect(() => {
    const fetchEmployees = async () => {
      const { data } = await supabase.from('employees').select('*');
      if (data) setEmployees(data as Employee[]);
    };
    fetchEmployees();

    const channel = supabase
      .channel('attendance-employees')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, () => fetchEmployees())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const fetchAttendance = async () => {
      const { data } = await supabase.from('attendance').select('*');
      if (data) setAttendanceRecords(data as AttendanceRecord[]);
    };
    fetchAttendance();

    const channel = supabase
      .channel('attendance-records')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => fetchAttendance())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const dailyRecords = attendanceRecords.filter(record => record.date === currentDate);
  
  const filteredRecords = dailyRecords.filter(record => {
    const emp = employees.find(e => e.id === record.employeeId);
    return emp?.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
           emp?.id.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const stats = {
    present: dailyRecords.filter(r => r.status === 'Present').length,
    late: dailyRecords.filter(r => r.status === 'Late').length,
    absent: dailyRecords.filter(r => r.status === 'Absent').length,
    onLeave: dailyRecords.filter(r => r.status === 'On Leave').length,
  };

  const handlePrevDay = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 1);
    setCurrentDate(d.toISOString().slice(0, 10));
  };
  
  const handleNextDay = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 1);
    setCurrentDate(d.toISOString().slice(0, 10));
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Attendance Log</h2>
          <p className="text-gray-500">Track employee daily check-ins, check-outs, and status.</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
          <button 
            onClick={handlePrevDay}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <span className="text-sm font-semibold px-4 text-gray-700 min-w-[140px] text-center">
            {format(currentDate, 'dd MMMM yyyy')}
          </span>
          <button 
            onClick={handleNextDay}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        <button 
          onClick={() => setActiveTab('log')}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all",
            activeTab === 'log' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
          )}
        >
          <LayoutList className="w-4 h-4" />
          Attendance Log
        </button>
        <button 
          onClick={() => setActiveTab('remote')}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all",
            activeTab === 'remote' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
          )}
        >
          <Globe className="w-4 h-4" />
          Remote Work
        </button>
      </div>

      {activeTab === 'log' ? (
        <>
          {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <AttendanceStat label="Present" value={stats.present.toString()} color="text-green-600" bg="bg-green-50" icon={UserCheck} />
        <AttendanceStat label="Late" value={stats.late.toString()} color="text-amber-600" bg="bg-amber-50" icon={Clock} />
        <AttendanceStat label="Absent" value={stats.absent.toString()} color="text-red-600" bg="bg-red-50" icon={UserX} />
        <AttendanceStat label="On Leave" value={stats.onLeave.toString()} color="text-blue-600" bg="bg-blue-50" icon={CalendarIcon} />
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="relative flex-1 w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search employee..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button className="px-4 py-2 border border-gray-200 rounded-lg flex items-center gap-2 hover:bg-gray-50 transition-colors text-gray-600">
              <Filter className="w-4 h-4" />
              Filter Status
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Check In</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Check Out</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Work Hours</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {filteredRecords.map((record) => {
                  const emp = employees.find(e => e.id === record.employeeId);
                return (
                  <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                          {emp?.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{emp?.name}</p>
                          <p className="text-xs text-gray-500">{emp?.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="w-4 h-4 text-gray-400" />
                        {record.checkIn}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="w-4 h-4 text-gray-400" />
                        {record.checkOut}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {record.checkIn !== '-' ? '9h 10m' : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-medium",
                        record.status === 'Present' ? "bg-green-100 text-green-700" :
                        record.status === 'Late' ? "bg-amber-100 text-amber-700" :
                        record.status === 'On Leave' ? "bg-blue-100 text-blue-700" :
                        "bg-red-100 text-red-700"
                      )}>
                        {record.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {record.checkInLat ? (
                        <div className="flex items-center gap-1 text-xs text-blue-600 font-medium">
                          <MapPin className="w-3.5 h-3.5" />
                          <span title={`Lat: ${record.checkInLat}, Lng: ${record.checkInLng}`}>Captured</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 hover:bg-gray-200 rounded-lg transition-colors text-gray-400 hover:text-gray-600">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredRecords.length === 0 && (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 text-gray-400 mb-4">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <p className="text-gray-500">No attendance records found for this date.</p>
          </div>
        )}
      </div>
        </>
      ) : (
        <RemoteWorkTab />
      )}
    </div>
  );
}

function AttendanceStat({ label, value, color, bg, icon: Icon }: any) {
  return (
    <div className={cn("p-4 rounded-xl border border-transparent flex items-center gap-4", bg)}>
      <div className={cn("p-2 rounded-lg bg-white shadow-sm", color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
        <p className={cn("text-xl font-bold", color)}>{value}</p>
      </div>
    </div>
  );
}
