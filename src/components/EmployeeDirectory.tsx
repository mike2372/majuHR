import React, { useState, useRef, useEffect } from 'react';
import { Search, Plus, Filter, MoreVertical, X, Mail, Phone, Calendar, Briefcase, Building, CreditCard, ShieldCheck, History, ArrowLeft, Trash2, Upload, AlertCircle, CheckCircle2, Eye, EyeOff, Download, Check, X as XIcon, Clock as ClockIcon, CalendarCheck, CalendarX, UserMinus, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useUser } from '../contexts/UserContext';
import { Employee, EmployeeStatus, LeaveRequest, LeaveStatus, LeaveType, LeaveBalance } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import { differenceInDays, parseISO } from 'date-fns';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { useNotifications } from '../contexts/NotificationContext';
import { supabase } from '../lib/supabase';

export function EmployeeDirectory() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveEntitlements, setLeaveEntitlements] = useState<LeaveBalance[]>([]);
  const { addNotification } = useNotifications();

  // Supabase Subscriptions
  useEffect(() => {
    const fetchEmployees = async () => {
      const { data } = await supabase.from('employees').select('*');
      if (data) setEmployees(data as Employee[]);
    };
    fetchEmployees();
    const channel = supabase.channel('dir-employees')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, () => fetchEmployees())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const fetchLeaves = async () => {
      const { data } = await supabase.from('leaves').select('*');
      if (data) setLeaveRequests(data as LeaveRequest[]);
    };
    fetchLeaves();
    const channel = supabase.channel('dir-leaves')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leaves' }, () => fetchLeaves())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const fetchEntitlements = async () => {
      const { data } = await supabase.from('entitlements').select('*');
      if (data) setLeaveEntitlements(data as LeaveBalance[]);
    };
    fetchEntitlements();
    const channel = supabase.channel('dir-entitlements')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entitlements' }, () => fetchEntitlements())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);
  const [activeTab, setActiveTab] = useState<'directory' | 'leaves'>('directory');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<EmployeeStatus | 'All'>('All');
  const [departmentFilter, setDepartmentFilter] = useState<string>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLeaveRequestModalOpen, setIsLeaveRequestModalOpen] = useState(false);
  const [isEntitlementModalOpen, setIsEntitlementModalOpen] = useState(false);
  const [editingEntitlement, setEditingEntitlement] = useState<any>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [importMessage, setImportMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [isSensitiveVisible, setIsSensitiveVisible] = useState(false);

  // Reset sensitive visibility when closing or changing employee
  React.useEffect(() => {
    setIsSensitiveVisible(false);
  }, [selectedEmployee]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, hasPermission } = useUser();

  const maskValue = (value: string) => {
    if (!value || value === '-') return '-';
    return '•••• •••• ' + value.slice(-4);
  };

  const canSeeSensitive = (emp: Employee | null) => {
    if (!emp) return false;
    // Deny-by-Default: Check for specific permissions in JWT claims
    if (hasPermission('View_Salary') || hasPermission('Edit_Tax_Info')) return true;
    if (user?.employeeId === emp.id) return true; // Own data
    return false;
  };

  const [formData, setFormData] = useState({
    name: '',
    position: '',
    department: 'Technology',
    email: '',
    joinDate: new Date().toISOString().split('T')[0],
    status: 'Active' as EmployeeStatus,
    salary: '',
    epfNo: '',
    socsoNo: '',
    taxNo: '',
    profilePicture: ''
  });

  const [leaveFormData, setLeaveFormData] = useState({
    type: 'Annual' as LeaveType,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    reason: ''
  });

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.department.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'All' || emp.status === statusFilter;
    const matchesDepartment = departmentFilter === 'All' || emp.department === departmentFilter;

    return matchesSearch && matchesStatus && matchesDepartment;
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this employee?')) {
      try {
        await supabase.from('entitlements').delete().eq('employeeId', id);
        await supabase.from('employees').delete().eq('id', id);
      } catch (error) {
        console.error('Error deleting employee:', error);
        alert('Failed to delete employee. Please try again.');
      }
    }
  };

  const generateNextId = (currentEmployees: Employee[]) => {
    const existingIds = currentEmployees.map(emp => parseInt(emp.id.replace('EMP', ''), 10)).sort((a, b) => a - b);
    let nextIdNumber = 1;
    for (const id of existingIds) {
      if (id === nextIdNumber) {
        nextIdNumber++;
      } else if (id > nextIdNumber) {
        break;
      }
    }
    return `EMP${String(nextIdNumber).padStart(3, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const newId = generateNextId(employees);

    const newEmployee = {
      ...formData,
      id: newId,
      salary: parseFloat(formData.salary) || 0,
      epfNo: formData.epfNo || '-',
      socsoNo: formData.socsoNo || '-',
      taxNo: formData.taxNo || '-',
      profilePicture: formData.profilePicture,
      updatedAt: new Date().toISOString()
    };
    
    try {
      const { error: empError } = await supabase.from('employees').insert(newEmployee);
      if (empError) throw empError;
      
      // Initialize default entitlements
      const { error: entError } = await supabase.from('entitlements').insert({
        employeeId: newId,
        annual: 14,
        medical: 14,
        unpaid: 0,
        updatedAt: new Date().toISOString()
      });
      if (entError) throw entError;

      setIsModalOpen(false);
      setFormData({
        name: '',
        position: '',
        department: 'Technology',
        email: '',
        joinDate: new Date().toISOString().split('T')[0],
        status: 'Active',
        salary: '',
        epfNo: '',
        socsoNo: '',
        taxNo: '',
        profilePicture: ''
      });
    } catch (error) {
      console.error('Error adding employee:', error);
      alert('Failed to add employee.');
    }
  };

  const handleProfilePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>, employeeId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      if (employeeId) {
        try {
          await supabase.from('employees').update({ 
            profilePicture: base64String,
            updatedAt: new Date().toISOString()
          }).eq('id', employeeId);
          if (selectedEmployee?.id === employeeId) {
            setSelectedEmployee(prev => prev ? { ...prev, profilePicture: base64String } : null);
          }
        } catch (error) {
          console.error('Error updating profile picture:', error);
        }
      } else {
        setFormData(prev => ({ ...prev, profilePicture: base64String }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.employeeId) {
      alert('You must have an employee ID to request leave.');
      return;
    }

    const newRequestId = `LR${Date.now()}`;
    const newRequest: LeaveRequest = {
      id: newRequestId,
      employeeId: user.employeeId,
      type: leaveFormData.type,
      startDate: leaveFormData.startDate,
      endDate: leaveFormData.endDate,
      reason: leaveFormData.reason,
      status: 'Pending',
      appliedDate: new Date().toISOString().split('T')[0]
    };

    try {
      const { error } = await supabase.from('leaves').insert(newRequest);
      if (error) throw error;
      
      // Add notification for HR Admin
      addNotification({
        type: 'leave_request',
        title: 'New Leave Request',
        message: `${employees.find(e => e.id === user.employeeId)?.name} has submitted a ${leaveFormData.type} leave request.`,
      });

      setIsLeaveRequestModalOpen(false);
      setLeaveFormData({
        type: 'Annual',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        reason: ''
      });
    } catch (error) {
      console.error('Error submitting leave:', error);
      alert('Failed to submit leave request.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const importedData = results.data as any[];
        let count = 0;
        let errorCount = 0;

        let currentList = [...employees];
        const employeesToInsert: any[] = [];
        const entitlementsToInsert: any[] = [];

        importedData.forEach((row) => {
          if (row.name && row.email && row.position && row.department) {
            const nextId = generateNextId([...currentList]);
            const emp = {
              id: nextId,
              name: row.name,
              email: row.email,
              position: row.position,
              department: row.department,
              joinDate: row.joinDate || new Date().toISOString().split('T')[0],
              status: (row.status as EmployeeStatus) || 'Active',
              salary: parseFloat(row.salary) || 0,
              epfNo: row.epfNo || '-',
              socsoNo: row.socsoNo || '-',
              taxNo: row.taxNo || '-',
              updatedAt: new Date().toISOString()
            };
            
            employeesToInsert.push(emp);
            entitlementsToInsert.push({
              employeeId: nextId,
              annual: 14,
              medical: 14,
              unpaid: 0,
              updatedAt: new Date().toISOString()
            });

            currentList.push(emp as Employee);
            count++;
          } else {
            errorCount++;
          }
        });

        if (count > 0) {
          try {
            const { error: empError } = await supabase.from('employees').insert(employeesToInsert);
            if (empError) throw empError;
            const { error: entError } = await supabase.from('entitlements').insert(entitlementsToInsert);
            if (entError) throw entError;
            setImportMessage({
              text: `Successfully imported ${count} employees.${errorCount > 0 ? ` (${errorCount} rows skipped)` : ''}`,
              type: 'success'
            });
          } catch (error) {
            console.error('Error importing:', error);
            setImportMessage({ text: 'Database error during import.', type: 'error' });
          }
        } else {
          setImportMessage({ text: 'No valid data found.', type: 'error' });
        }

        if (fileInputRef.current) fileInputRef.current.value = '';
        setTimeout(() => setImportMessage(null), 5000);
      },
      error: (error) => {
        setImportMessage({ text: `CSV Error: ${error.message}`, type: 'error' });
        setTimeout(() => setImportMessage(null), 5000);
      }
    });
  };

  const handleLeaveAction = async (requestId: string, newStatus: LeaveStatus) => {
    try {
      const { error } = await supabase.from('leaves').update({ status: newStatus }).eq('id', requestId);
      if (error) throw error;
      
      const request = leaveRequests.find(r => r.id === requestId);
      const emp = employees.find(e => e.id === request?.employeeId);
      
      if (request && emp) {
        addNotification({
          type: 'leave_request',
          title: `Leave Request ${newStatus}`,
          message: `Leave request for ${emp.name} (${request.type}) has been ${newStatus.toLowerCase()}.`,
        });
      }
    } catch (error) {
      console.error('Error updating leave status:', error);
    }
  };

  const dynamicBalances = React.useMemo(() => {
    return leaveEntitlements.map(entitlement => {
      const approvedRequests = leaveRequests.filter(
        req => req.employeeId === entitlement.employeeId && req.status === 'Approved'
      );

      let usedAnnual = 0;
      let usedMedical = 0;
      let usedUnpaid = 0;

      approvedRequests.forEach(req => {
        const duration = differenceInDays(parseISO(req.endDate), parseISO(req.startDate)) + 1;
        if (req.type === 'Annual') usedAnnual += duration;
        else if (req.type === 'Medical') usedMedical += duration;
        else if (req.type === 'Unpaid') usedUnpaid += duration;
        else if (req.type === 'Emergency') usedAnnual += duration;
      });

      return {
        ...entitlement,
        annual: Math.max(0, entitlement.annual - usedAnnual),
        medical: Math.max(0, entitlement.medical - usedMedical),
        unpaid: entitlement.unpaid + usedUnpaid,
      };
    });
  }, [leaveRequests, leaveEntitlements]);

  const handleUpdateEntitlement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntitlement) return;
    
    setLeaveEntitlements(prev => prev.map(ent => 
      ent.employeeId === editingEntitlement.employeeId ? editingEntitlement : ent
    ));
    setIsEntitlementModalOpen(false);
    setEditingEntitlement(null);
  };

  const generateEmployeePDF = (emp: Employee) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(22);
    doc.setTextColor(30, 64, 175); // #1e40af
    doc.text('MajuHR', 20, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Employee Profile Document', 20, 27);
    
    doc.setDrawColor(229, 231, 235);
    doc.line(20, 35, pageWidth - 20, 35);

    // Profile Title
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text('EMPLOYEE PROFILE', pageWidth / 2, 45, { align: 'center' });

    // Personal Details
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Personal Details', 20, 60);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    const personalDetails = [
      ['Full Name:', emp.name],
      ['Employee ID:', emp.id],
      ['Email:', emp.email],
      ['Position:', emp.position],
      ['Department:', emp.department],
      ['Join Date:', emp.joinDate],
      ['Status:', emp.status]
    ];

    let yPos = 68;
    personalDetails.forEach(([label, value]) => {
      doc.text(label, 20, yPos);
      doc.text(value, 60, yPos);
      yPos += 7;
    });

    // Statutory Information
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Statutory Information', 20, yPos + 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    yPos += 18;

    const statutoryDetails = [
      ['EPF No:', emp.epfNo],
      ['SOCSO No:', emp.socsoNo],
      ['Tax No:', emp.taxNo]
    ];

    statutoryDetails.forEach(([label, value]) => {
      doc.text(label, 20, yPos);
      doc.text(value, 60, yPos);
      yPos += 7;
    });

    // Employment History
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Employment History', 20, yPos + 10);
    yPos += 18;

    (doc as any).autoTable({
      startY: yPos,
      head: [['Date', 'Event', 'Details']],
      body: [
        ['Current', emp.position, 'Promoted to current role in Jan 2024'],
        [emp.joinDate, 'Joined MajuHR', `Onboarded as Junior ${emp.position.split(' ').pop()}`]
      ],
      theme: 'striped',
      headStyles: { fillStyle: [30, 64, 175] },
      styles: { fontSize: 9 }
    });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('This is a computer-generated document from MajuHR System.', pageWidth / 2, 280, { align: 'center' });
    doc.text(`Generated on: ${new Date().toLocaleString()}`, pageWidth / 2, 285, { align: 'center' });

    doc.save(`Profile_${emp.name.replace(/\s+/g, '_')}_${emp.id}.pdf`);
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Employee Management</h2>
          <p className="text-gray-500">Manage employees, view profiles, and handle leave requests.</p>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === 'directory' && hasPermission('Manage_Users') && (
            <>
              <input 
                type="file" 
                accept=".csv" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg flex items-center gap-2 hover:bg-gray-50 transition-colors shadow-sm bg-white"
              >
                <Upload className="w-4 h-4" />
                Import CSV
              </button>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-[#1e40af] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Add Employee
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button 
          onClick={() => setActiveTab('directory')}
          className={cn(
            "px-6 py-3 text-sm font-bold transition-all border-b-2",
            activeTab === 'directory' ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          Employee Directory
        </button>
        <button 
          onClick={() => setActiveTab('leaves')}
          className={cn(
            "px-6 py-3 text-sm font-bold transition-all border-b-2",
            activeTab === 'leaves' ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          Leave Management
        </button>
      </div>

      {activeTab === 'directory' ? (
        <>
          {/* Import Status Message */}
          <AnimatePresence>
            {importMessage && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={cn(
                  "p-4 rounded-xl flex items-center gap-3 shadow-sm border",
                  importMessage.type === 'success' ? "bg-green-50 text-green-700 border-green-100" : "bg-red-50 text-red-700 border-red-100"
                )}
              >
                {importMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                <span className="text-sm font-medium">{importMessage.text}</span>
                <button onClick={() => setImportMessage(null)} className="ml-auto p-1 hover:bg-black/5 rounded-full transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Filters & Search */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search by name, ID, or department..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Filter By:</span>
              </div>
              <select 
                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-gray-600 bg-white"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
              >
                <option value="All">All Departments</option>
                <option>Technology</option>
                <option>Human Resources</option>
                <option>Finance</option>
                <option>Operations</option>
                <option>Marketing</option>
              </select>
              <select 
                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-gray-600 bg-white"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as EmployeeStatus | 'All')}
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="On Leave">On Leave</option>
                <option value="Resigned">Resigned</option>
              </select>
              {(searchTerm || statusFilter !== 'All' || departmentFilter !== 'All') && (
                <button 
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('All');
                    setDepartmentFilter('All');
                  }}
                  className="px-3 py-2 text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          {/* Employee List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Department</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Position</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Join Date</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredEmployees.map((emp) => (
                    <tr 
                      key={emp.id} 
                      onClick={() => setSelectedEmployee(emp)}
                      className="hover:bg-blue-50/50 transition-colors group cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {emp.profilePicture ? (
                            <img 
                              src={emp.profilePicture} 
                              alt={emp.name} 
                              className="w-10 h-10 rounded-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                              {emp.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">{emp.name}</p>
                            <p className="text-xs text-gray-500">{emp.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{emp.department}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{emp.position}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{emp.joinDate}</td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full text-xs font-medium",
                          emp.status === 'Active' ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                        )}>
                          {emp.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {hasPermission('Manage_Users') && (
                            <button 
                              onClick={(e) => handleDelete(emp.id, e)}
                              className="p-2 hover:bg-red-50 rounded-lg transition-colors text-gray-400 hover:text-red-600"
                              title="Delete Employee"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          <button className="p-2 hover:bg-gray-200 rounded-lg transition-colors text-gray-400 hover:text-gray-600">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredEmployees.length === 0 && (
              <div className="p-12 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 text-gray-400 mb-4">
                  <Search className="w-6 h-6" />
                </div>
                <p className="text-gray-500">No employees found matching your search.</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-8">
          {/* Leave Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
                <ClockIcon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Pending Requests</p>
                <p className="text-2xl font-bold text-gray-900">{leaveRequests.filter(r => r.status === 'Pending').length}</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-green-50 text-green-600 rounded-lg">
                <CalendarCheck className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Approved Today</p>
                <p className="text-2xl font-bold text-gray-900">{leaveRequests.filter(r => r.status === 'Approved').length}</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-red-50 text-red-600 rounded-lg">
                <CalendarX className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Rejected Requests</p>
                <p className="text-2xl font-bold text-gray-900">{leaveRequests.filter(r => r.status === 'Rejected').length}</p>
              </div>
            </div>
          </div>

          {/* Leave Requests Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Leave Requests</h3>
              <button 
                onClick={() => setIsLeaveRequestModalOpen(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors text-sm font-semibold"
              >
                <Plus className="w-4 h-4" />
                Request Leave
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Duration</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Reason</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {leaveRequests.map((req) => {
                    const emp = employees.find(e => e.id === req.employeeId);
                    return (
                      <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                              {emp?.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{emp?.name}</p>
                              <p className="text-[10px] text-gray-500">{emp?.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            req.type === 'Annual' ? "bg-blue-100 text-blue-700" :
                            req.type === 'Medical' ? "bg-green-100 text-green-700" :
                            req.type === 'Emergency' ? "bg-red-100 text-red-700" :
                            "bg-gray-100 text-gray-700"
                          )}>
                            {req.type}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-900">{req.startDate}</p>
                          <p className="text-[10px] text-gray-500">to {req.endDate}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-600 max-w-[200px] truncate" title={req.reason}>{req.reason}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2.5 py-1 rounded-full text-xs font-medium",
                            req.status === 'Approved' ? "bg-green-100 text-green-700" :
                            req.status === 'Rejected' ? "bg-red-100 text-red-700" :
                            "bg-amber-100 text-amber-700"
                          )}>
                            {req.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {req.status === 'Pending' && user?.role === 'HR Admin' && (
                            <div className="flex items-center justify-end gap-2">
                              <button 
                                onClick={() => handleLeaveAction(req.id, 'Approved')}
                                className="p-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                                title="Approve"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleLeaveAction(req.id, 'Rejected')}
                                className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                title="Reject"
                              >
                                <XIcon className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Leave Balances */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Employee Leave Balances</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Annual Leave</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Medical Leave</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Unpaid Leave</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dynamicBalances.map((balance) => {
                    const emp = employees.find(e => e.id === balance.employeeId);
                    const entitlement = leaveEntitlements.find(e => e.employeeId === balance.employeeId);
                    return (
                      <tr key={balance.employeeId} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center font-bold text-xs">
                              {emp?.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{emp?.name}</p>
                              <p className="text-[10px] text-gray-500">{emp?.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-900">{balance.annual}</span>
                            <span className="text-xs text-gray-400">/ {entitlement?.annual} days left</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-900">{balance.medical}</span>
                            <span className="text-xs text-gray-400">/ {entitlement?.medical} days left</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-900">{balance.unpaid}</span>
                            <span className="text-xs text-gray-400">days taken</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {user?.role === 'HR Admin' && (
                            <button 
                              onClick={() => {
                                setEditingEntitlement(entitlement);
                                setIsEntitlementModalOpen(true);
                              }}
                              className="text-blue-600 hover:text-blue-800 text-xs font-bold uppercase tracking-wider"
                            >
                              Edit Entitlement
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Leave Request Modal */}
      {isLeaveRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-bold text-gray-900">Submit Leave Request</h3>
              <button 
                onClick={() => setIsLeaveRequestModalOpen(false)}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleLeaveSubmit} className="p-6 space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Leave Type</label>
                  <select 
                    value={leaveFormData.type}
                    onChange={(e) => setLeaveFormData({ ...leaveFormData, type: e.target.value as LeaveType })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-white"
                  >
                    <option value="Annual">Annual Leave</option>
                    <option value="Medical">Medical Leave</option>
                    <option value="Emergency">Emergency Leave</option>
                    <option value="Unpaid">Unpaid Leave</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Start Date</label>
                    <input 
                      required
                      type="date" 
                      value={leaveFormData.startDate}
                      onChange={(e) => setLeaveFormData({ ...leaveFormData, startDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">End Date</label>
                    <input 
                      required
                      type="date" 
                      value={leaveFormData.endDate}
                      onChange={(e) => setLeaveFormData({ ...leaveFormData, endDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Reason</label>
                  <textarea 
                    required
                    rows={3}
                    value={leaveFormData.reason}
                    onChange={(e) => setLeaveFormData({ ...leaveFormData, reason: e.target.value })}
                    placeholder="Briefly explain the reason for your leave..."
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none"
                  />
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsLeaveRequestModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg font-semibold hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#1e40af] text-white rounded-lg font-semibold hover:bg-blue-700 transition-all shadow-md"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Employee Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-bold text-gray-900">Add New Employee</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="flex items-center gap-4 mb-4">
                <div className="relative group">
                  {formData.profilePicture ? (
                    <img 
                      src={formData.profilePicture} 
                      alt="Preview" 
                      className="w-20 h-20 rounded-2xl object-cover border-2 border-blue-100"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-blue-50 border-2 border-dashed border-blue-200 flex flex-col items-center justify-center text-blue-400 group-hover:bg-blue-100 group-hover:border-blue-300 transition-all">
                      <Upload className="w-6 h-6 mb-1" />
                      <span className="text-[10px] font-bold uppercase">Upload</span>
                    </div>
                  )}
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => handleProfilePictureUpload(e)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Profile Picture</h4>
                  <p className="text-xs text-gray-500">JPG, PNG or GIF. Max 1MB.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
                  <input 
                    required
                    type="text" 
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g. Ahmad bin Zulkifli"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Position</label>
                    <input 
                      required
                      type="text" 
                      name="position"
                      value={formData.position}
                      onChange={handleInputChange}
                      placeholder="e.g. Software Engineer"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Department</label>
                    <select 
                      name="department"
                      value={formData.department}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-white"
                    >
                      <option>Technology</option>
                      <option>Human Resources</option>
                      <option>Finance</option>
                      <option>Operations</option>
                      <option>Marketing</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Email Address</label>
                  <input 
                    required
                    type="email" 
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="e.g. ahmad.z@majuhr.com"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Join Date</label>
                    <input 
                      required
                      type="date" 
                      name="joinDate"
                      value={formData.joinDate}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
                    <select 
                      name="status"
                      value={formData.status}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-white"
                    >
                      <option value="Active">Active</option>
                      <option value="On Leave">On Leave</option>
                      <option value="Resigned">Resigned</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Basic Salary (RM)</label>
                  <input 
                    required
                    type="number" 
                    name="salary"
                    value={formData.salary}
                    onChange={handleInputChange}
                    placeholder="e.g. 5000"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">EPF No.</label>
                    <input 
                      type="text" 
                      name="epfNo"
                      value={formData.epfNo}
                      onChange={handleInputChange}
                      placeholder="EPF No."
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">SOCSO No.</label>
                    <input 
                      type="text" 
                      name="socsoNo"
                      value={formData.socsoNo}
                      onChange={handleInputChange}
                      placeholder="SOCSO No."
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Tax No.</label>
                    <input 
                      type="text" 
                      name="taxNo"
                      value={formData.taxNo}
                      onChange={handleInputChange}
                      placeholder="Tax No."
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg font-semibold hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#1e40af] text-white rounded-lg font-semibold hover:bg-blue-700 transition-all shadow-md"
                >
                  Save Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leave Entitlement Modal */}
      {isEntitlementModalOpen && editingEntitlement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Edit Entitlements</h3>
                <p className="text-xs text-gray-500 font-medium">{employees.find(e => e.id === editingEntitlement.employeeId)?.name}</p>
              </div>
              <button 
                onClick={() => setIsEntitlementModalOpen(false)}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateEntitlement} className="p-6 space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Annual Leave Entitlement (Days)</label>
                  <input 
                    required
                    type="number" 
                    value={editingEntitlement.annual}
                    onChange={(e) => setEditingEntitlement({ ...editingEntitlement, annual: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Medical Leave Entitlement (Days)</label>
                  <input 
                    required
                    type="number" 
                    value={editingEntitlement.medical}
                    onChange={(e) => setEditingEntitlement({ ...editingEntitlement, medical: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsEntitlementModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg font-semibold hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#1e40af] text-white rounded-lg font-semibold hover:bg-blue-700 transition-all shadow-md"
                >
                  Update Entitlements
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Employee Detail Slide-over */}
      <AnimatePresence>
        {selectedEmployee && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedEmployee(null)}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl z-[70] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setSelectedEmployee(null)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{selectedEmployee.name}</h3>
                    <p className="text-sm text-gray-500">{selectedEmployee.id} • {selectedEmployee.position}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                    selectedEmployee.status === 'Active' ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                  )}>
                    {selectedEmployee.status}
                  </span>
                  <button className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-10">
                {/* Profile Header */}
                <div className="flex items-center gap-6">
                  <div className="relative group">
                    {selectedEmployee.profilePicture ? (
                      <img 
                        src={selectedEmployee.profilePicture} 
                        alt={selectedEmployee.name} 
                        className="w-24 h-24 rounded-2xl object-cover shadow-lg shadow-blue-200"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-3xl font-bold shadow-lg shadow-blue-200">
                        {selectedEmployee.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                    )}
                    {user?.role === 'HR Admin' && (
                      <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <label className="cursor-pointer p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors text-white">
                          <Upload className="w-5 h-5" />
                          <input 
                            type="file" 
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleProfilePictureUpload(e, selectedEmployee.id)}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Building className="w-4 h-4" />
                      <span className="text-sm font-medium">{selectedEmployee.department}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail className="w-4 h-4" />
                      <span className="text-sm">{selectedEmployee.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm">Joined {selectedEmployee.joinDate}</span>
                    </div>
                  </div>
                </div>

                {/* Financial Information */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#1e40af] font-bold uppercase tracking-widest text-xs">
                      <CreditCard className="w-4 h-4" />
                      Financial Information
                    </div>
                    {canSeeSensitive(selectedEmployee) && (
                      <button 
                        onClick={() => setIsSensitiveVisible(!isSensitiveVisible)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-blue-600 transition-colors"
                      >
                        {isSensitiveVisible ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5" />
                            Hide Details
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            Show Details
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <div className="bg-gray-50 rounded-xl p-6 border border-gray-100 grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs text-gray-400 font-bold uppercase mb-1">Basic Salary</p>
                      <p className="text-xl font-bold text-gray-900">
                        {isSensitiveVisible ? `RM ${selectedEmployee.salary.toLocaleString()}` : 'RM ••••••••'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 font-bold uppercase mb-1">Payment Method</p>
                      <p className="text-sm font-semibold text-gray-700">Bank Transfer (Maybank)</p>
                    </div>
                  </div>
                </section>

                {/* Statutory Information */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#1e40af] font-bold uppercase tracking-widest text-xs">
                      <ShieldCheck className="w-4 h-4" />
                      Statutory Details
                    </div>
                    {canSeeSensitive(selectedEmployee) && (
                      <button 
                        onClick={() => setIsSensitiveVisible(!isSensitiveVisible)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-blue-600 transition-colors"
                      >
                        {isSensitiveVisible ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5" />
                            Hide Details
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            Show Details
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white border border-gray-100 p-4 rounded-xl shadow-sm">
                      <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">EPF No.</p>
                      <p className="text-sm font-bold text-gray-800">
                        {isSensitiveVisible ? selectedEmployee.epfNo : maskValue(selectedEmployee.epfNo)}
                      </p>
                    </div>
                    <div className="bg-white border border-gray-100 p-4 rounded-xl shadow-sm">
                      <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">SOCSO No.</p>
                      <p className="text-sm font-bold text-gray-800">
                        {isSensitiveVisible ? selectedEmployee.socsoNo : maskValue(selectedEmployee.socsoNo)}
                      </p>
                    </div>
                    <div className="bg-white border border-gray-100 p-4 rounded-xl shadow-sm">
                      <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Tax No.</p>
                      <p className="text-sm font-bold text-gray-800">
                        {isSensitiveVisible ? selectedEmployee.taxNo : maskValue(selectedEmployee.taxNo)}
                      </p>
                    </div>
                  </div>
                </section>

                {/* Employment History */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-[#1e40af] font-bold uppercase tracking-widest text-xs">
                    <History className="w-4 h-4" />
                    Employment History
                  </div>
                  <div className="relative pl-6 space-y-8 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100">
                    <div className="relative">
                      <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-blue-600 border-2 border-white shadow-sm" />
                      <p className="text-xs font-bold text-gray-400 uppercase">Current</p>
                      <h4 className="text-sm font-bold text-gray-900">{selectedEmployee.position}</h4>
                      <p className="text-xs text-gray-500 mt-1">Promoted to current role in Jan 2024</p>
                    </div>
                    <div className="relative">
                      <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-gray-300 border-2 border-white shadow-sm" />
                      <p className="text-xs font-bold text-gray-400 uppercase">{selectedEmployee.joinDate}</p>
                      <h4 className="text-sm font-bold text-gray-900">Joined MajuHR</h4>
                      <p className="text-xs text-gray-500 mt-1">Onboarded as Junior {selectedEmployee.position.split(' ').pop()}</p>
                    </div>
                  </div>
                </section>
              </div>

              <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3">
                <button className="flex-1 bg-[#1e40af] text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">
                  Edit Profile
                </button>
                <button 
                  onClick={() => generateEmployeePDF(selectedEmployee)}
                  className="px-6 py-3 border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-white transition-all flex items-center gap-2 justify-center"
                >
                  <Download className="w-4 h-4" />
                  Export PDF
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
