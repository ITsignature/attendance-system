// =============================================
// ENHANCED PAYROLL CALCULATION SERVICE
// =============================================
// Integrates backend PayrollService.js calculations into frontend

export interface TaxSlab {
  min: number;
  max: number;
  rate: number;
}

export interface PayrollCalculationConfig {
  taxSlabs?: TaxSlab[];
  pfRates?: {
    employeeEPF: number;
    employerEPF: number;
    employerETF: number;
  };
  overtimeMultipliers?: {
    weekday: number;
    saturday: number;
    sunday: number;
    holiday: number;
  };
  workingDaysPerMonth?: number;
  hoursPerDay?: number;
}

export interface AttendanceMetrics {
  presentDays: number;
  absentDays: number;
  lateDays: number;
  halfDays: number;
  totalOvertime: number;
}

export interface PayrollCalculationResult {
  baseSalary: number;
  allowances: number;
  overtimeAmount: number;
  bonus: number;
  commission: number;
  grossSalary: number;
  taxDeduction: number;
  providentFund: number;
  insurance: number;
  loanDeduction: number;
  attendanceDeduction: number;
  otherDeductions: number;
  totalDeductions: number;
  netSalary: number;
  pfDetails: {
    employeeEPF: number;
    employerEPF: number;
    employerETF: number;
  };
  dailyRate: number;
  hourlyRate: number;
}

class PayrollCalculationService {
  private config: PayrollCalculationConfig;

  constructor(config: PayrollCalculationConfig = {}) {
    this.config = {
      // Sri Lankan tax slabs (default)
      taxSlabs: [
        { min: 0, max: 100000, rate: 0 },
        { min: 100000, max: 200000, rate: 0.06 },
        { min: 200000, max: 300000, rate: 0.12 },
        { min: 300000, max: 500000, rate: 0.18 },
        { min: 500000, max: 750000, rate: 0.24 },
        { min: 750000, max: Infinity, rate: 0.36 }
      ],
      pfRates: {
        employeeEPF: 0.08,
        employerEPF: 0.12,
        employerETF: 0.03
      },
      overtimeMultipliers: {
        weekday: 1.5,
        saturday: 1.5,
        sunday: 2.0,
        holiday: 2.5
      },
      workingDaysPerMonth: 22,
      hoursPerDay: 8,
      ...config
    };
  }

  // TAX CALCULATIONS
  calculateProgressiveTax(grossSalary: number): number {
    let tax = 0;
    let remainingSalary = grossSalary;

    for (const slab of this.config.taxSlabs!) {
      if (remainingSalary <= 0) break;
      
      const taxableInSlab = Math.min(remainingSalary, slab.max - slab.min);
      tax += taxableInSlab * slab.rate;
      remainingSalary -= taxableInSlab;
    }

    return Math.round(tax * 100) / 100;
  }

  calculateFlatTax(grossSalary: number, taxRate: number): number {
    return Math.round(grossSalary * taxRate * 100) / 100;
  }

  // PROVIDENT FUND
  calculateProvidentFund(baseSalary: number) {
    return {
      employeeEPF: Math.round(baseSalary * this.config.pfRates!.employeeEPF * 100) / 100,
      employerEPF: Math.round(baseSalary * this.config.pfRates!.employerEPF * 100) / 100,
      employerETF: Math.round(baseSalary * this.config.pfRates!.employerETF * 100) / 100
    };
  }

  // OVERTIME CALCULATIONS
  getHourlyRate(monthlySalary: number): number {
    return monthlySalary / (this.config.workingDaysPerMonth! * this.config.hoursPerDay!);
  }

  getDailyRate(monthlySalary: number): number {
    return monthlySalary / this.config.workingDaysPerMonth!;
  }

  calculateOvertime(hourlyRate: number, overtimeHours: number, dayType: 'weekday' | 'saturday' | 'sunday' | 'holiday' = 'weekday'): number {
    const multiplier = this.config.overtimeMultipliers![dayType];
    return Math.round(hourlyRate * overtimeHours * multiplier * 100) / 100;
  }

  // ATTENDANCE DEDUCTIONS
  calculateAttendanceDeductions(baseSalary: number, attendance: AttendanceMetrics): number {
    const dailyRate = this.getDailyRate(baseSalary);
    
    const absentDeduction = dailyRate * attendance.absentDays;
    const halfDayDeduction = (dailyRate / 2) * attendance.halfDays;
    
    return Math.round((absentDeduction + halfDayDeduction) * 100) / 100;
  }

  // LOAN EMI
  calculateEMI(principal: number, annualRate: number, tenureMonths: number): number {
    const monthlyRate = annualRate / 12;
    const emi = principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths) /
                (Math.pow(1 + monthlyRate, tenureMonths) - 1);
    return Math.round(emi * 100) / 100;
  }

  // BONUS CALCULATIONS
  calculatePerformanceBonus(baseSalary: number, performanceScore: number, maxBonusPercentage: number = 0.20): number {
    const bonusPercentage = (performanceScore / 100) * maxBonusPercentage;
    return Math.round(baseSalary * bonusPercentage * 100) / 100;
  }

  calculateAnnualBonus(baseSalary: number, monthsWorked: number = 12): number {
    return Math.round((baseSalary / 12) * monthsWorked * 100) / 100;
  }

  // COMPREHENSIVE PAYROLL CALCULATION
  calculatePayroll(params: {
    baseSalary: number;
    allowances?: number;
    overtimeHours?: number;
    bonus?: number;
    commission?: number;
    insurance?: number;
    loanDeduction?: number;
    otherDeductions?: number;
    attendance?: AttendanceMetrics;
    useFlatTax?: boolean;
    taxRate?: number;
    performanceScore?: number;
  }): PayrollCalculationResult {
    const {
      baseSalary,
      allowances = 0,
      overtimeHours = 0,
      bonus = 0,
      commission = 0,
      insurance = 0,
      loanDeduction = 0,
      otherDeductions = 0,
      attendance,
      useFlatTax = false,
      taxRate = 0.15,
      performanceScore
    } = params;

    const hourlyRate = this.getHourlyRate(baseSalary);
    const dailyRate = this.getDailyRate(baseSalary);
    const overtimeAmount = this.calculateOvertime(hourlyRate, overtimeHours);
    
    const finalBonus = performanceScore !== undefined 
      ? this.calculatePerformanceBonus(baseSalary, performanceScore) 
      : bonus;

    const grossSalary = baseSalary + allowances + overtimeAmount + finalBonus + commission;

    const taxDeduction = useFlatTax 
      ? this.calculateFlatTax(grossSalary, taxRate)
      : this.calculateProgressiveTax(grossSalary);

    const pfDetails = this.calculateProvidentFund(baseSalary);
    const attendanceDeduction = attendance 
      ? this.calculateAttendanceDeductions(baseSalary, attendance)
      : 0;

    const totalDeductions = taxDeduction + pfDetails.employeeEPF + insurance + 
                           loanDeduction + attendanceDeduction + otherDeductions;

    const netSalary = grossSalary - totalDeductions;

    return {
      baseSalary,
      allowances,
      overtimeAmount,
      bonus: finalBonus,
      commission,
      grossSalary,
      taxDeduction,
      providentFund: pfDetails.employeeEPF,
      insurance,
      loanDeduction,
      attendanceDeduction,
      otherDeductions,
      totalDeductions,
      netSalary,
      pfDetails,
      dailyRate,
      hourlyRate
    };
  }

  // UTILITY METHODS
  numberToWords(amount: number): string {
    if (amount === 0) return 'Zero';

    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function convertHundreds(num: number): string {
      let result = '';
      
      if (num > 99) {
        result += ones[Math.floor(num / 100)] + ' Hundred ';
        num %= 100;
      }
      
      if (num >= 20) {
        result += tens[Math.floor(num / 10)] + ' ';
        num %= 10;
      } else if (num >= 10) {
        result += teens[num - 10] + ' ';
        return result;
      }
      
      if (num > 0) {
        result += ones[num] + ' ';
      }
      
      return result;
    }

    let result = '';
    const crores = Math.floor(amount / 10000000);
    const lakhs = Math.floor((amount % 10000000) / 100000);
    const thousands = Math.floor((amount % 100000) / 1000);
    const hundreds = amount % 1000;

    if (crores > 0) result += convertHundreds(crores) + 'Crores ';
    if (lakhs > 0) result += convertHundreds(lakhs) + 'Lakhs ';
    if (thousands > 0) result += convertHundreds(thousands) + 'Thousands ';
    if (hundreds > 0) result += convertHundreds(hundreds);

    return result.trim() + ' Rupees Only';
  }

  formatCurrency(amount: number): string {
    return `Rs. ${new Intl.NumberFormat('en-IN').format(amount)}`;
  }

  // VALIDATION
  validatePayrollData(data: any): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data.baseSalary || data.baseSalary <= 0) {
      errors.push('Valid base salary is required');
    }

    if (data.overtimeAmount > data.baseSalary) {
      warnings.push('Overtime amount exceeds base salary');
    }

    if (data.totalDeductions > data.grossSalary * 0.5) {
      warnings.push('Total deductions exceed 50% of gross salary');
    }

    if (data.netSalary < 0) {
      errors.push('Net salary cannot be negative');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }
}

export const payrollCalculationService = new PayrollCalculationService();
export default payrollCalculationService;