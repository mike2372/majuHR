import { supabase } from './supabase';

export interface MyInvoisSubmissionResult {
  internalId: string;
  uuid?: string;
  status: string;
  longId?: string;
  errorMessage?: string;
}

export const myInvoisService = {
  async submitSelfBilledInvoice(payrollId: string, employeeId: string) {
    // 1. Fetch data for submission
    const { data: payrollData, error: pError } = await supabase
      .from('payroll')
      .select('*')
      .eq('id', payrollId)
      .single();

    const { data: employeeData, error: eError } = await supabase
      .from('employees')
      .select('*')
      .eq('id', employeeId)
      .single();

    if (pError || eError) throw new Error('Data fetching failed for MyInvois submission.');

    // 2. Call Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('myinvois', {
      body: { payrollData, employeeData }
    });

    if (error) throw error;

    // 3. Log results locally
    const { error: logError } = await supabase
      .from('myinvois_logs')
      .insert({
        payrollId,
        employeeId,
        internalId: data.submissionId || 'PENDING',
        uuid: data.uuid,
        status: data.status || 'Submitted',
        payload: { payrollData, employeeData },
        response: data
      });

    if (logError) console.error('Failed to log MyInvois result:', logError);

    return data as MyInvoisSubmissionResult;
  }
};
