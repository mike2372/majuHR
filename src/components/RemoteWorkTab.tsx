import React, { useState, useEffect } from 'react';
import { 
  Globe, 
  Calendar, 
  Plus, 
  Check, 
  X, 
  Clock, 
  User,
  ShieldCheck,
  MoreVertical,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useUser } from '../contexts/UserContext';
import { RemoteWorkRequest, Employee } from '../types';
import { format } from 'date-fns';
import { cn } from '../lib/utils';

export function RemoteWorkTab() {
  const { user } = useUser();
  const isAdmin = user?.role === 'Admin' || user?.role === 'HR Admin';
  
  const [requests, setRequests] = useState<RemoteWorkRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);
  
  // Form States
  const [formData, setFormData] = useState({
    employeeId: user?.employeeId || '',
    date: format(new Date(), 'yyyy-MM-dd'),
    reason: ''
  });

  useEffect(() => {
    fetchRequests();
    if (isAdmin) fetchEmployees();
  }, [user, isAdmin]);

  const fetchRequests = async () => {
    setLoading(true);
    let query = supabase.from('remote_work_requests').select('*');
    
    if (!isAdmin) {
      query = query.eq('employee_id', user?.employeeId);
    }
    
    const { data, error } = await query.order('date', { ascending: false });
    if (error) console.error('Error fetching requests:', error);
    else setRequests(data.map(d => ({ ...d, employeeId: d.employee_id, createdAt: d.created_at })) as RemoteWorkRequest[]);
    setLoading(false);
  };

  const fetchEmployees = async () => {
    const { data } = await supabase.from('employees').select('*');
    if (data) setEmployees(data as Employee[]);
  };

  const handleSubmitRequest = async (e: React.FormEvent, status: 'Pending' | 'Approved' = 'Pending') => {
    e.preventDefault();
    if (!formData.employeeId || !formData.date) return;

    const { error } = await supabase.from('remote_work_requests').insert({
      employee_id: formData.employeeId,
      date: formData.date,
      reason: formData.reason,
      status: status,
      resolved_by: status === 'Approved' ? user?.id : null
    });

    if (error) {
      alert(error.message);
    } else {
      setShowRequestForm(false);
      setShowAssignForm(false);
      fetchRequests();
      setFormData({ ...formData, reason: '' });
    }
  };

  const handleAction = async (requestId: string, status: 'Approved' | 'Rejected') => {
    const { error } = await supabase
      .from('remote_work_requests')
      .update({ status, resolved_by: user?.id })
      .eq('id', requestId);

    if (error) alert(error.message);
    else fetchRequests();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Globe className="w-6 h-6 text-blue-600" />
            Remote Work Authorizations
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {isAdmin 
              ? 'Manage and approve employee requests for remote clock-in privileges.' 
              : 'Request and track your remote work authorizations.'}
          </p>
        </div>
        <div className="flex gap-3">
          {isAdmin ? (
            <button 
              onClick={() => setShowAssignForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
            >
              <Plus className="w-4 h-4" />
              Assign Remote Work
            </button>
          ) : (
            <button 
              onClick={() => setShowRequestForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
            >
              <Plus className="w-4 h-4" />
              New Request
            </button>
          )}
        </div>
      </div>

      {(showRequestForm || showAssignForm) && (
        <div className="bg-white p-8 rounded-2xl border-2 border-blue-100 shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex justify-between items-center mb-6">
            <h4 className="text-lg font-bold text-gray-900">
              {showAssignForm ? 'Assign Remote Work Privileges' : 'Request Remote Clock-In'}
            </h4>
            <button onClick={() => { setShowRequestForm(false); setShowAssignForm(false); }} className="p-2 hover:bg-gray-100 rounded-full">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          
          <form onSubmit={(e) => handleSubmitRequest(e, showAssignForm ? 'Approved' : 'Pending')} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {showAssignForm && (
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Select Employee</label>
                <select 
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none"
                  value={formData.employeeId}
                  onChange={(e) => setFormData({...formData, employeeId: e.target.value})}
                  required
                >
                  <option value="">Choose an employee...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.id})</option>
                  ))}
                </select>
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">Date</label>
              <input 
                type="date" 
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none"
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
                required
              />
            </div>
            
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-bold text-gray-700">Reason / Description</label>
              <textarea 
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none min-h-[100px]"
                placeholder="Work from home, business trip, etc."
                value={formData.reason}
                onChange={(e) => setFormData({...formData, reason: e.target.value})}
                required
              />
            </div>
            
            <div className="md:col-span-2 flex justify-end gap-3 mt-4">
              <button 
                type="button"
                onClick={() => { setShowRequestForm(false); setShowAssignForm(false); }}
                className="px-6 py-2.5 text-gray-600 font-bold hover:bg-gray-50 rounded-xl transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="px-8 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center gap-2"
                disabled={loading}
              >
                {loading ? 'Processing...' : showAssignForm ? 'Grant Authorization' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                {isAdmin && <th className="px-6 py-4">Employee</th>}
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Reason</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} className="px-6 py-12 text-center text-gray-400 italic">
                    Loading records...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <Calendar className="w-8 h-8 opacity-20" />
                      <p>No remote work records found.</p>
                    </div>
                  </td>
                </tr>
              ) : requests.map((req) => {
                const emp = employees.find(e => e.id === req.employeeId);
                return (
                  <tr key={req.id} className="hover:bg-gray-50/50 transition-colors">
                    {isAdmin && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                            {emp?.name[0] || '?'}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{emp?.name || 'Unknown'}</p>
                            <p className="text-[10px] text-gray-500">{req.employeeId}</p>
                          </div>
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-700 font-medium">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {req.date}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600 max-w-xs truncate" title={req.reason}>
                        {req.reason}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ring-1 ring-inset",
                        req.status === 'Approved' ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20" :
                        req.status === 'Rejected' ? "bg-red-50 text-red-700 ring-red-600/20" :
                        "bg-amber-50 text-amber-700 ring-amber-600/20"
                      )}>
                        {req.status === 'Approved' ? <Check className="w-3 h-3" /> : 
                         req.status === 'Pending' ? <Clock className="w-3 h-3" /> : 
                         <X className="w-3 h-3" />}
                        {req.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {isAdmin && req.status === 'Pending' ? (
                          <>
                            <button 
                              onClick={() => handleAction(req.id, 'Approved')}
                              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Approve"
                            >
                              <Check className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => handleAction(req.id, 'Rejected')}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Reject"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </>
                        ) : (
                          <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Help Section */}
      {!isAdmin && (
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-3 items-start">
          <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-bold mb-1">About Remote Clock-In</p>
            <p>You can only clock in from outside the office if you have an **Approved** request for today. Submit a request at least 24 hours in advance to ensure admin approval.</p>
          </div>
        </div>
      )}
    </div>
  );
}
