export type UserRole = 'Admin' | 'Manager' | 'Employee' | 'Finance' | 'HR Admin';

export type Permission = 'View_Salary' | 'Edit_Tax_Info' | 'Manage_Users' | 'Approve_Leave';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  employeeId?: string;
  permissions?: Permission[];
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
  isForeignWorker?: boolean;
  passportNo?: string;
  permitExpiry?: string;
  icNo?: string;
  dob?: string;
  profilePicture?: string;
  faceDescriptor?: string;
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
  checkInLat?: number;
  checkInLng?: number;
  checkOutLat?: number;
  checkOutLng?: number;
  checkInAddress?: string;
  checkOutAddress?: string;
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

export interface CompanySettings {
  id: string;
  office_lat: number;
  office_lng: number;
  office_radius_meters: number;
  updated_at: string;
}

export interface RemoteWorkRequest {
  id: string;
  employeeId: string;
  date: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  resolvedBy?: string;
  createdAt: string;
}
