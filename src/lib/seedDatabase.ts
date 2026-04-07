import { supabase } from './supabase';
import { MOCK_EMPLOYEES, MOCK_PAYROLL, MOCK_LEAVE_REQUESTS, MOCK_LEAVE_BALANCES } from '../mockData';

export const seedDatabase = async () => {
  try {
    // Check if seeding is already done
    const { data: existingEmps } = await supabase.from('employees').select('id').limit(1);
    if (existingEmps && existingEmps.length > 0) {
      console.log('Database already seeded. Skipping...');
      return;
    }

    console.log('Seeding Supabase with mock data...');

    // 1. Seed Employees
    const employeesWithTimestamp = MOCK_EMPLOYEES.map(emp => ({
      ...emp,
      updatedAt: new Date().toISOString()
    }));
    const { error: empError } = await supabase.from('employees').upsert(employeesWithTimestamp);
    if (empError) throw empError;

    // 2. Seed Payroll Records
    const payrollWithTimestamp = MOCK_PAYROLL.map(pay => ({
      ...pay,
      createdAt: new Date().toISOString()
    }));
    const { error: payError } = await supabase.from('payroll').upsert(payrollWithTimestamp);
    if (payError) throw payError;

    // 3. Seed Leave Requests
    const leavesWithTimestamp = MOCK_LEAVE_REQUESTS.map(req => ({
      ...req,
      createdAt: new Date().toISOString()
    }));
    const { error: leaveError } = await supabase.from('leaves').upsert(leavesWithTimestamp);
    if (leaveError) throw leaveError;

    // 4. Seed Leave Balances (Entitlements)
    const entitlementsWithTimestamp = MOCK_LEAVE_BALANCES.map(balance => ({
      ...balance,
      updatedAt: new Date().toISOString()
    }));
    const { error: entError } = await supabase.from('entitlements').upsert(entitlementsWithTimestamp);
    if (entError) throw entError;

    console.log('Successfully seeded database!');
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
};
