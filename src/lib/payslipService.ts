import { supabase } from './supabase';

export const payslipService = {
  /**
   * Triggers the server-side generation of a secure, password-protected PDF payslip.
   * Returns a time-limited pre-signed URL to download the file.
   */
  async generateSecurePayslip(payrollId: string, employeeId: string) {
    const { data, error } = await supabase.functions.invoke('generate-payslip', {
      body: { payrollId, employeeId }
    });

    if (error) throw error;
    
    if (data.url) {
      // Automatically open the URL in a new tab for download
      window.open(data.url, '_blank');
    }
    
    return data;
  }
};
