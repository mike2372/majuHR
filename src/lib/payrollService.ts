import { supabase } from './supabase';
import { calculatePayroll } from './payrollEngine';

export interface PayrollRecord {
  id?: string;
  employeeId: string;
  month: string;
  basicSalary: number;
  allowances: number;
  deductions: number;
  status?: string;
  isOverride?: boolean;
  isForeignWorker?: boolean;
}

export const payrollService = {
  async processPayroll(record: PayrollRecord, reason?: string) {
    const calculated = calculatePayroll(
      record.basicSalary, 
      record.allowances, 
      record.deductions, 
      record.isForeignWorker || false
    );
    // 1. Validation check
    // If this is a manual entry and we are validating
    // In this MVP, we treat the calculated values as the source of truth
    const finalData = {
      ...record,
      ...calculated,
      status: 'Validated'
    };

    // 2. Perform Override logging if needed
    // (This would be triggered if the user manually changed a statutory value, 
    // but the engine currently calculates them automatically).
    
    const { data, error } = await supabase
      .from('payroll')
      .upsert(finalData)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async logOverride(payrollId: string, employeeId: string, field: string, oldValue: number, newValue: number, reason: string) {
    const { error } = await supabase
      .from('payroll_audit_logs')
      .insert({
        payrollId,
        employeeId,
        changeType: 'Statutory Override',
        fieldName: field,
        oldValue,
        newValue,
        reason,
        changedBy: (await supabase.auth.getUser()).data.user?.id
      });

    if (error) throw error;
  }
};
