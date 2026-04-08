/**
 * Malaysian Payroll Engine (2026)
 * Implements EPF, SOCSO, EIS and PCB (MTD) calculations.
 */

export interface StatutoryContributions {
  epfEmployee: number;
  epfEmployer: number;
  socsoEmployee: number;
  socsoEmployer: number;
  eisEmployee: number;
  eisEmployer: number;
  pcb: number;
  netSalary: number;
}

export const PAYROLL_CONSTANTS = {
  SOCSO_WAGE_CAP: 6000,
  EIS_WAGE_CAP: 6000,
  EPF_EMPLOYER_THRESHOLD: 5000,
  TAX_RELIEF_INDIVIDUAL: 9000,
  TAX_RELIEF_EPF_LIFE_INS: 7000, // Combined relief for EPF & Life Insurance
};

/**
 * Calculate SOCSO contribution based on brackets.
 * Cap at RM 6,000.
 */
export const calculateSOCSO = (wages: number, isForeignWorker: boolean = false) => {
  const cappedWages = Math.min(wages, PAYROLL_CONSTANTS.SOCSO_WAGE_CAP);
  
  if (cappedWages <= 0) return { employee: 0, employer: 0 };

  if (isForeignWorker) {
    // Foreign Workers (2026 rule): 
    // Employer: 1.25% (Injury) + 0.5% (Invalidity) = 1.75%
    // Employee: 0.5% (Invalidity)
    const employer = Number((cappedWages * 0.0175).toFixed(2));
    const employee = Number((cappedWages * 0.005).toFixed(2));
    return { employee, employer };
  }
  
  // Local Workers (~1.75% employer / ~0.5% employee)
  const employer = Number((cappedWages * 0.0175).toFixed(2));
  const employee = Number((cappedWages * 0.005).toFixed(2));
  
  return { employee, employer };
};

/**
 * Calculate EIS contribution.
 * Cap at RM 6,000.
 */
export const calculateEIS = (wages: number) => {
  const cappedWages = Math.min(wages, PAYROLL_CONSTANTS.EIS_WAGE_CAP);
  const contribution = Number((cappedWages * 0.002).toFixed(2));
  return { employee: contribution, employer: contribution };
};

/**
 * Calculate EPF contribution.
 * Local: Employee 11%, Employer 13% (<= 5000) or 12% (> 5000)
 * Foreign: Employee 2%, Employer 2% (2026 rule)
 */
export const calculateEPF = (wages: number, isForeignWorker: boolean = false) => {
  if (isForeignWorker) {
    const rate = 0.02;
    return { 
      employee: Math.ceil(wages * rate), 
      employer: Math.ceil(wages * rate) 
    };
  }

  const employeeRate = 0.11;
  const employee = Math.ceil(wages * employeeRate);
  const employerRate = wages <= PAYROLL_CONSTANTS.EPF_EMPLOYER_THRESHOLD ? 0.13 : 0.12;
  const employer = Math.ceil(wages * employerRate);
  
  return { employee, employer };
};

/**
 * Calculate PCB (Monthly Tax Deduction) using 2026 progressive rates.
 * Simplified Computerised Calculation.
 */
export const calculatePCB = (monthlyGross: number, annualReliefs: number = 9000) => {
  // 1. Calculate Annual Taxable Income
  // We assume monthlyGross is consistent for the year for this formula.
  const annualGross = monthlyGross * 12;
  
  // 2. Subtract Reliefs
  // Standard Individual Relief + standard EPF relief (capped)
  const epfAnnual = Math.min(monthlyGross * 0.11 * 12, 4000);
  const totalReliefs = annualReliefs + epfAnnual;
  const chargeableIncome = Math.max(annualGross - totalReliefs, 0);

  // 3. Apply 2026 Progressive Brackets
  let annualTax = 0;

  const brackets = [
    { limit: 5000, rate: 0, base: 0 },
    { limit: 20000, rate: 0.01, base: 0 },
    { limit: 35000, rate: 0.03, base: 150 },
    { limit: 50000, rate: 0.06, base: 600 },
    { limit: 70000, rate: 0.11, base: 1500 },
    { limit: 100000, rate: 0.19, base: 3700 },
    { limit: 400000, rate: 0.25, base: 9400 },
    { limit: 600001, rate: 0.26, base: 84400 },
  ];

  let prevLimit = 0;
  for (const bracket of brackets) {
    if (chargeableIncome > bracket.limit) {
      prevLimit = bracket.limit;
      continue;
    }
    annualTax = bracket.base + (chargeableIncome - prevLimit) * bracket.rate;
    break;
  }
  
  // If income exceeds the highest defined bracket limit
  if (chargeableIncome > 600000) {
    annualTax = 136400 + (chargeableIncome - 600000) * 0.28;
  }

  // Monthly PCB
  return Number((annualTax / 12).toFixed(2));
};

export const calculatePayroll = (basicSalary: number, allowances: number = 0, deductions: number = 0, isForeignWorker: boolean = false): StatutoryContributions => {
  const grossWages = basicSalary + allowances;
  
  const epf = calculateEPF(grossWages, isForeignWorker);
  const socso = calculateSOCSO(grossWages, isForeignWorker);
  const eis = calculateEIS(grossWages);
  const pcb = calculatePCB(grossWages - epf.employee); // PCB is calculated after EPF deduction

  const totalDeductions = epf.employee + socso.employee + eis.employee + pcb + deductions;
  const netSalary = grossWages - totalDeductions;

  return {
    epfEmployee: epf.employee,
    epfEmployer: epf.employer,
    socsoEmployee: socso.employee,
    socsoEmployer: socso.employer,
    eisEmployee: eis.employee,
    eisEmployer: eis.employer,
    pcb,
    netSalary: Number(netSalary.toFixed(2)),
  };
};
