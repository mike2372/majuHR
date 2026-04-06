import React, { useState, useEffect } from 'react';
import { 
  Download, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  Search,
  Filter,
  ArrowRight,
  TrendingUp,
  ChevronRight,
  Loader2,
  Check,
  X,
  ShieldCheck,
  Calculator,
  Send
} from 'lucide-react';
import { MOCK_PAYROLL, MOCK_EMPLOYEES, MOCK_LEAVE_REQUESTS } from '../mockData';
import { cn } from '../lib/utils';
import { useUser } from '../contexts/UserContext';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { motion, AnimatePresence } from 'motion/react';

import { useNotifications } from '../contexts/NotificationContext';

export function Payroll() {
  const [selectedMonth, setSelectedMonth] = useState('2024-02');
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [processingStatus, setProcessingStatus] = useState<'idle' | 'checking' | 'calculating' | 'finalizing' | 'completed'>('idle');
  const { user } = useUser();
  const { addNotification } = useNotifications();

  // Dynamic calculations based on selected month
  const monthlyPayroll = MOCK_PAYROLL.filter(p => p.month === selectedMonth);
  
  const stats = React.useMemo(() => {
    return monthlyPayroll.reduce((acc, curr) => ({
      gross: acc.gross + curr.basicSalary + curr.allowances,
      statutory: acc.statutory + curr.epfEmployer + curr.socsoEmployer + curr.eisEmployer,
      net: acc.net + curr.netSalary
    }), { gross: 0, statutory: 0, net: 0 });
  }, [monthlyPayroll]);

  const pendingLeaves = MOCK_LEAVE_REQUESTS.filter(r => r.status === 'Pending').length;
  const incompleteProfiles = MOCK_EMPLOYEES.filter(e => e.epfNo === '-' || e.taxNo === '-').length;

  const handleStartWizard = () => {
    setIsWizardOpen(true);
    setWizardStep(1);
    setProcessingStatus('idle');
  };

  const nextStep = () => {
    if (wizardStep < 3) {
      setWizardStep(prev => prev + 1);
    } else {
      setIsWizardOpen(false);
    }
  };

  const prevStep = () => {
    if (wizardStep > 1) {
      setWizardStep(prev => prev - 1);
    }
  };

  const runChecks = () => {
    setProcessingStatus('checking');
    setTimeout(() => {
      setProcessingStatus('idle');
      nextStep();
    }, 2000);
  };

  const runCalculation = () => {
    setProcessingStatus('calculating');
    setTimeout(() => {
      setProcessingStatus('idle');
      addNotification({
        type: 'payroll_milestone',
        title: 'Payroll Calculation Complete',
        message: `Payroll calculation for ${selectedMonth} has been completed for ${MOCK_EMPLOYEES.length} employees.`,
      });
      nextStep();
    }, 2500);
  };

  const finalizePayroll = () => {
    setProcessingStatus('finalizing');
    setTimeout(() => {
      setProcessingStatus('completed');
      addNotification({
        type: 'payroll_milestone',
        title: 'Payroll Finalized',
        message: `Payroll for ${selectedMonth} has been finalized and is ready for disbursement.`,
      });
    }, 2000);
  };

  const generatePayslip = (employeeId: string, payrollId: string) => {
    const emp = MOCK_EMPLOYEES.find(e => e.id === employeeId);
    const pay = MOCK_PAYROLL.find(p => p.id === payrollId);

    if (!emp || !pay) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(22);
    doc.setTextColor(30, 64, 175); // #1e40af
    doc.text('MajuHR', 20, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Enterprise Human Resource Management System', 20, 27);
    
    doc.setDrawColor(229, 231, 235);
    doc.line(20, 35, pageWidth - 20, 35);

    // Payslip Title
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text('SALARY SLIP', pageWidth / 2, 45, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Month: ${pay.month}`, pageWidth / 2, 52, { align: 'center' });

    // Employee Details
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Employee Details', 20, 65);
    doc.setFont('helvetica', 'normal');
    
    const details = [
      ['Employee Name:', emp.name],
      ['Employee ID:', emp.id],
      ['Position:', emp.position],
      ['Department:', emp.department],
      ['EPF No:', emp.epfNo],
      ['SOCSO No:', emp.socsoNo],
      ['Tax No:', emp.taxNo]
    ];

    let yPos = 72;
    details.forEach(([label, value]) => {
      doc.text(label, 20, yPos);
      doc.text(value, 60, yPos);
      yPos += 7;
    });

    // Financial Table
    (doc as any).autoTable({
      startY: 125,
      head: [['Description', 'Earnings (RM)', 'Deductions (RM)']],
      body: [
        ['Basic Salary', pay.basicSalary.toFixed(2), ''],
        ['Allowances', pay.allowances.toFixed(2), ''],
        ['EPF (Employee)', '', pay.epfEmployee.toFixed(2)],
        ['SOCSO (Employee)', '', pay.socsoEmployee.toFixed(2)],
        ['EIS (Employee)', '', pay.eisEmployee.toFixed(2)],
        ['PCB (Income Tax)', '', pay.pcb.toFixed(2)],
        ['Other Deductions', '', pay.deductions.toFixed(2)],
      ],
      theme: 'striped',
      headStyles: { fillStyle: [30, 64, 175] },
      styles: { fontSize: 9 }
    });

    const finalY = (doc as any).lastAutoTable.finalY;

    // Totals
    doc.setFont('helvetica', 'bold');
    doc.text('Total Earnings:', 120, finalY + 15);
    doc.text(`RM ${(pay.basicSalary + pay.allowances).toFixed(2)}`, 170, finalY + 15, { align: 'right' });
    
    doc.text('Total Deductions:', 120, finalY + 22);
    doc.text(`RM ${(pay.epfEmployee + pay.socsoEmployee + pay.eisEmployee + pay.pcb + pay.deductions).toFixed(2)}`, 170, finalY + 22, { align: 'right' });

    doc.setFillColor(243, 244, 246);
    doc.rect(115, finalY + 28, 75, 12, 'F');
    doc.setFontSize(12);
    doc.setTextColor(30, 64, 175);
    doc.text('NET SALARY:', 120, finalY + 36);
    doc.text(`RM ${pay.netSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 185, finalY + 36, { align: 'right' });

    // Employer Contributions
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.text('Employer Contributions (Statutory)', 20, finalY + 15);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`EPF: RM ${pay.epfEmployer.toFixed(2)}`, 20, finalY + 22);
    doc.text(`SOCSO: RM ${pay.socsoEmployer.toFixed(2)}`, 20, finalY + 27);
    doc.text(`EIS: RM ${pay.eisEmployer.toFixed(2)}`, 20, finalY + 32);

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('This is a computer-generated document and does not require a signature.', pageWidth / 2, 280, { align: 'center' });
    doc.text(`Generated on: ${new Date().toLocaleString()}`, pageWidth / 2, 285, { align: 'center' });

    doc.save(`Payslip_${emp.name.replace(/\s+/g, '_')}_${pay.month}.pdf`);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Payroll Processing</h2>
          <p className="text-gray-500">Manage monthly salary, statutory deductions, and payslips.</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 border border-gray-200 rounded-lg flex items-center gap-2 hover:bg-gray-50 transition-colors text-gray-600 bg-white shadow-sm">
            <Download className="w-4 h-4" />
            Export Reports
          </button>
          {user?.role === 'HR Admin' && (
            <button 
              onClick={handleStartWizard}
              className="bg-[#1e40af] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              Process Payroll
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 font-medium">Total Gross Salary</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">RM {stats.gross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          <div className="flex items-center gap-1 text-green-600 text-xs mt-2 font-medium">
            <TrendingUp className="w-3 h-3" />
            <span>+2.4% vs last month</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 font-medium">Total Statutory (Employer)</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">RM {stats.statutory.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-gray-400 mt-2 font-medium">EPF, SOCSO, EIS</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 font-medium">Net Disbursement</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">RM {stats.net.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          <div className="flex items-center gap-1 text-blue-600 text-xs mt-2 font-medium">
            <CheckCircle2 className="w-3 h-3" />
            <span>Ready for bank transfer</span>
          </div>
        </div>
      </div>

      {/* Payroll Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <select 
              className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-600 bg-white"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              <option value="2024-02">February 2024</option>
              <option value="2024-01">January 2024</option>
              <option value="2023-12">December 2023</option>
            </select>
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search employee..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Status: Processed
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Basic Salary</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Deductions (Statutory)</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">PCB (Tax)</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Net Salary</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {monthlyPayroll.length > 0 ? monthlyPayroll.map((pay) => {
                const emp = MOCK_EMPLOYEES.find(e => e.id === pay.employeeId);
                return (
                  <tr key={pay.id} className="hover:bg-gray-50 transition-colors">
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
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">RM {pay.basicSalary.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <div className="text-xs space-y-1">
                        <div className="flex justify-between text-gray-500">
                          <span>EPF:</span>
                          <span className="font-medium text-gray-700">RM {pay.epfEmployee.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                          <span>SOCSO:</span>
                          <span className="font-medium text-gray-700">RM {pay.socsoEmployee.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                          <span>EIS:</span>
                          <span className="font-medium text-gray-700">RM {pay.eisEmployee.toFixed(2)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">RM {pay.pcb.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm font-bold text-blue-600">RM {pay.netSalary.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <button className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-semibold transition-colors">
                          <FileText className="w-4 h-4" />
                          View
                        </button>
                        {user?.role === 'HR Admin' && (
                          <button 
                            onClick={() => generatePayslip(pay.employeeId, pay.id)}
                            className="flex items-center gap-2 text-green-600 hover:text-green-800 text-sm font-semibold transition-colors"
                            title="Download PDF Payslip"
                          >
                            <Download className="w-4 h-4" />
                            PDF
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No payroll records found for this month.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Statutory Info */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 flex items-start gap-4">
        <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="text-blue-900 font-semibold">Statutory Compliance Note</h4>
          <p className="text-blue-800 text-sm mt-1 leading-relaxed">
            Statutory contributions (EPF, SOCSO, EIS) are calculated based on the latest Malaysian government rates. 
            Ensure all employee details (IC No, EPF No) are accurate before final submission to LHDN and KWSP.
          </p>
        </div>
      </div>

      {/* Payroll Wizard Modal */}
      <AnimatePresence>
        {isWizardOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              {/* Wizard Header */}
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Payroll Processing Wizard</h3>
                  <p className="text-sm text-gray-500">Step {wizardStep} of 3: {
                    wizardStep === 1 ? 'Pre-processing Checks' :
                    wizardStep === 2 ? 'Salary Calculation' : 'Finalization'
                  }</p>
                </div>
                <button 
                  onClick={() => setIsWizardOpen(false)}
                  className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Progress Bar */}
              <div className="h-1 bg-gray-100 w-full">
                <motion.div 
                  className="h-full bg-blue-600"
                  initial={{ width: '0%' }}
                  animate={{ width: `${(wizardStep / 3) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              {/* Step Content */}
              <div className="p-8 min-h-[300px]">
                {wizardStep === 1 && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                      <ShieldCheck className="w-8 h-8 text-blue-600" />
                      <div>
                        <h4 className="font-bold text-blue-900">Data Integrity Check</h4>
                        <p className="text-sm text-blue-800">Verifying employee statutory details and monthly records.</p>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      {[
                        { label: 'Employee Statutory Details (EPF/SOCSO/Tax)', status: incompleteProfiles > 0 ? 'warning' : 'ready', detail: incompleteProfiles > 0 ? `${incompleteProfiles} profiles incomplete` : 'All profiles complete' },
                        { label: 'Monthly Attendance Records', status: 'ready', detail: 'All records verified' },
                        { label: 'Approved Leave Requests', status: pendingLeaves > 0 ? 'warning' : 'ready', detail: pendingLeaves > 0 ? `${pendingLeaves} requests pending approval` : 'All leaves processed' },
                        { label: 'Overtime & Allowance Claims', status: 'ready', detail: 'No pending claims' }
                      ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                          <div>
                            <p className="text-sm font-medium text-gray-700">{item.label}</p>
                            <p className="text-[10px] text-gray-500">{item.detail}</p>
                          </div>
                          {processingStatus === 'checking' ? (
                            <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                          ) : item.status === 'warning' ? (
                            <AlertCircle className="w-4 h-4 text-amber-500" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          )}
                        </div>
                      ))}
                    </div>
                    {pendingLeaves > 0 && (
                      <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800">
                          Warning: There are {pendingLeaves} pending leave requests. It is recommended to approve or reject all leaves before processing payroll.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {wizardStep === 2 && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-4 p-4 bg-amber-50 rounded-xl border border-amber-100">
                      <Calculator className="w-8 h-8 text-amber-600" />
                      <div>
                        <h4 className="font-bold text-amber-900">Payroll Calculation</h4>
                        <p className="text-sm text-amber-800">Computing gross salary, statutory deductions, and net pay.</p>
                      </div>
                    </div>

                    {processingStatus === 'calculating' ? (
                      <div className="flex flex-col items-center justify-center py-12 space-y-4">
                        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                        <p className="text-gray-600 font-medium animate-pulse">Calculating payroll for {MOCK_EMPLOYEES.length} employees...</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                          <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total Gross</p>
                          <p className="text-xl font-bold text-gray-900">RM {stats.gross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                          <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total Deductions</p>
                          <p className="text-xl font-bold text-gray-900">RM {stats.statutory.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 col-span-2">
                          <p className="text-xs text-blue-600 font-bold uppercase tracking-wider">Net Disbursement</p>
                          <p className="text-2xl font-bold text-blue-900">RM {stats.net.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {wizardStep === 3 && (
                  <div className="space-y-6">
                    {processingStatus === 'completed' ? (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center justify-center py-8 space-y-4 text-center"
                      >
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                          <Check className="w-10 h-10" />
                        </div>
                        <div>
                          <h4 className="text-2xl font-bold text-gray-900">Payroll Finalized!</h4>
                          <p className="text-gray-500 mt-2">Payroll for February 2024 has been successfully processed and finalized.</p>
                        </div>
                        <div className="flex gap-3 mt-4">
                          <button className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all">
                            Download Summary
                          </button>
                          <button 
                            onClick={() => setIsWizardOpen(false)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-all"
                          >
                            Close Wizard
                          </button>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="space-y-6">
                        <div className="flex items-center gap-4 p-4 bg-green-50 rounded-xl border border-green-100">
                          <Send className="w-8 h-8 text-green-600" />
                          <div>
                            <h4 className="font-bold text-green-900">Final Review & Disbursement</h4>
                            <p className="text-sm text-green-800">Finalize payroll and prepare for bank disbursement.</p>
                          </div>
                        </div>

                        <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Total Employees</span>
                            <span className="font-bold text-gray-900">{monthlyPayroll.length}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Total Net Salary</span>
                            <span className="font-bold text-gray-900">RM {stats.net.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Payment Date</span>
                            <span className="font-bold text-gray-900">2024-02-28</span>
                          </div>
                          <div className="pt-4 border-t border-gray-200">
                            <label className="flex items-start gap-3 cursor-pointer group">
                              <input type="checkbox" className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                              <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">
                                I confirm that all payroll data has been reviewed and is accurate according to company policy and statutory requirements.
                              </span>
                            </label>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Wizard Footer */}
              {processingStatus !== 'completed' && (
                <div className="p-6 border-t border-gray-100 flex justify-between items-center bg-gray-50">
                  <button 
                    onClick={prevStep}
                    disabled={wizardStep === 1 || processingStatus !== 'idle'}
                    className="px-6 py-2 text-gray-600 font-bold hover:text-gray-900 disabled:opacity-30 transition-all"
                  >
                    Back
                  </button>
                  
                  {wizardStep === 1 && (
                    <button 
                      onClick={runChecks}
                      disabled={processingStatus === 'checking'}
                      className="px-8 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center gap-2"
                    >
                      {processingStatus === 'checking' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Running Checks...
                        </>
                      ) : (
                        <>
                          Run Checks
                          <ChevronRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  )}

                  {wizardStep === 2 && (
                    <button 
                      onClick={runCalculation}
                      disabled={processingStatus === 'calculating'}
                      className="px-8 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center gap-2"
                    >
                      {processingStatus === 'calculating' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Calculating...
                        </>
                      ) : (
                        <>
                          Calculate Payroll
                          <ChevronRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  )}

                  {wizardStep === 3 && (
                    <button 
                      onClick={finalizePayroll}
                      disabled={processingStatus === 'finalizing'}
                      className="px-8 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-200 flex items-center gap-2"
                    >
                      {processingStatus === 'finalizing' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Finalizing...
                        </>
                      ) : (
                        <>
                          Finalize & Disburse
                          <CheckCircle2 className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
