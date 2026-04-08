import { Employee } from '../types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates foreign worker data requirements for payroll processing.
 */
export const validateForeignWorker = (employee: Employee): ValidationResult => {
  const errors: string[] = [];

  if (employee.isForeignWorker) {
    if (!employee.passportNo || employee.passportNo === '-' || employee.passportNo.trim() === '') {
      errors.push(`Employee ${employee.name} is missing a valid Passport Number.`);
    }

    if (!employee.permitExpiry || employee.permitExpiry === '-' || employee.permitExpiry.trim() === '') {
      errors.push(`Employee ${employee.name} is missing a valid Permit Expiry Date.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Batch validates a list of employees for payroll processing.
 */
export const validateEmployeesForPayroll = (employees: Employee[]): ValidationResult => {
  const allErrors: string[] = [];

  employees.forEach(emp => {
    const result = validateForeignWorker(emp);
    if (!result.isValid) {
      allErrors.push(...result.errors);
    }
  });

  return {
    isValid: allErrors.length === 0,
    errors: allErrors
  };
};
