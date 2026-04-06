export type UserRole = 'HR Admin' | 'Manager' | 'Employee';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  employeeId?: string;
}

export type EmployeeStatus = 'Active' | 'Resigned' | 'On Leave';

export interface Employee {
  id: string;
  name: string;
  position: string;
  department: string;
  email: string;
  joinDate: string;
  status: EmployeeStatus;
  salary: number;
  epfNo: string;
  socsoNo: string;
  taxNo: string;
  profilePicture?: string;
}

export type LeaveType = 'Annual' | 'Medical' | 'Unpaid' | 'Emergency';
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected';

export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveStatus;
  appliedDate: string;
}

export interface LeaveBalance {
  employeeId: string;
  annual: number;
  medical: number;
  unpaid: number;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  checkIn: string;
  checkOut: string;
  status: 'Present' | 'Absent' | 'Late' | 'On Leave';
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  month: string; // YYYY-MM
  basicSalary: number;
  allowances: number;
  deductions: number;
  epfEmployee: number;
  epfEmployer: number;
  socsoEmployee: number;
  socsoEmployer: number;
  eisEmployee: number;
  eisEmployer: number;
  pcb: number;
  netSalary: number;
}
