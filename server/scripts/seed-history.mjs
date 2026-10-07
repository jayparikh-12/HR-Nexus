import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT) || 3306;
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || 'Jay@1234';
const DB_NAME = process.env.DB_NAME || 'peoplepay360';

async function main() {
  console.log(`Connecting to ${DB_NAME} on ${DB_HOST}:${DB_PORT} as ${DB_USER}...`);
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  });

  console.log('Cleaning up redundant test payruns and test payslips...');
  // Delete test payruns that start with PR-E2E, PR-VAL, PR-FINAL, PR-PAY, PR-REG, PR-202609-
  await conn.query(`
    DELETE FROM payslips WHERE payrun_id LIKE 'PR-E2E%' 
      OR payrun_id LIKE 'PR-VAL%' 
      OR payrun_id LIKE 'PR-FINAL%' 
      OR payrun_id LIKE 'PR-PAY%' 
      OR payrun_id LIKE 'PR-REG%'
      OR payrun_id LIKE 'PR-202609%'
  `);

  await conn.query(`
    DELETE FROM payruns WHERE id LIKE 'PR-E2E%' 
      OR id LIKE 'PR-VAL%' 
      OR id LIKE 'PR-FINAL%' 
      OR id LIKE 'PR-PAY%' 
      OR id LIKE 'PR-REG%'
      OR id LIKE 'PR-202609%'
  `);

  // Clear existing seeded monthly cycles so we can re-seed cleanly
  await conn.query(`DELETE FROM payslips WHERE payrun_id LIKE 'PR-CYCLE-%'`);
  await conn.query(`DELETE FROM payruns WHERE id LIKE 'PR-CYCLE-%'`);

  // List of active employees to seed payslips for
  const [employees] = await conn.query('SELECT id, name, department, position, bankAccountNo FROM employees ORDER BY id ASC');
  console.log(`Found ${employees.length} employees to generate payslip history for.`);

  // Monthly Cycles definition: month by month, year by year (2026 and 2025)
  const cycles = [
    {
      id: 'PR-CYCLE-2026-10',
      name: 'October 2026 Regular Cycle',
      period: 'October 2026',
      start: '2026-10-01',
      end: '2026-10-31',
      paidAt: '2026-10-31 17:00:00',
      status: 'PAID',
      yearMultiplier: 1.0,
      bonusRatio: 0.0,
    },
    {
      id: 'PR-CYCLE-2026-09',
      name: 'September 2026 Regular Cycle',
      period: 'September 2026',
      start: '2026-09-01',
      end: '2026-09-30',
      paidAt: '2026-09-30 17:00:00',
      status: 'PAID',
      yearMultiplier: 1.0,
      bonusRatio: 0.0,
    },
    {
      id: 'PR-CYCLE-2026-08',
      name: 'August 2026 Regular Cycle',
      period: 'August 2026',
      start: '2026-08-01',
      end: '2026-08-31',
      paidAt: '2026-08-31 17:00:00',
      status: 'PAID',
      yearMultiplier: 1.0,
      bonusRatio: 0.08, // Q3 Mid-Year Bonus / Performance Allowance (+8%)
    },
    {
      id: 'PR-CYCLE-2026-07',
      name: 'July 2026 Regular Cycle',
      period: 'July 2026',
      start: '2026-07-01',
      end: '2026-07-31',
      paidAt: '2026-07-31 17:00:00',
      status: 'PAID',
      yearMultiplier: 1.0,
      bonusRatio: 0.0,
    },
    {
      id: 'PR-CYCLE-2026-06',
      name: 'June 2026 Regular Cycle',
      period: 'June 2026',
      start: '2026-06-01',
      end: '2026-06-30',
      paidAt: '2026-06-30 17:00:00',
      status: 'PAID',
      yearMultiplier: 1.0,
      bonusRatio: 0.0,
    },
    {
      id: 'PR-CYCLE-2026-05',
      name: 'May 2026 Regular Cycle',
      period: 'May 2026',
      start: '2026-05-01',
      end: '2026-05-31',
      paidAt: '2026-05-31 17:00:00',
      status: 'PAID',
      yearMultiplier: 1.0,
      bonusRatio: 0.0,
    },
    {
      id: 'PR-CYCLE-2026-04',
      name: 'April 2026 Regular Cycle',
      period: 'April 2026',
      start: '2026-04-01',
      end: '2026-04-30',
      paidAt: '2026-04-30 17:00:00',
      status: 'PAID',
      yearMultiplier: 1.0,
      bonusRatio: 0.0,
    },
    {
      id: 'PR-CYCLE-2026-03',
      name: 'March 2026 Regular Cycle',
      period: 'March 2026',
      start: '2026-03-01',
      end: '2026-03-31',
      paidAt: '2026-03-31 17:00:00',
      status: 'PAID',
      yearMultiplier: 1.0,
      bonusRatio: 0.0,
    },
    {
      id: 'PR-CYCLE-2026-02',
      name: 'February 2026 Regular Cycle',
      period: 'February 2026',
      start: '2026-02-01',
      end: '2026-02-28',
      paidAt: '2026-02-28 17:00:00',
      status: 'PAID',
      yearMultiplier: 1.0,
      bonusRatio: 0.0,
    },
    {
      id: 'PR-CYCLE-2026-01',
      name: 'January 2026 Regular Cycle',
      period: 'January 2026',
      start: '2026-01-01',
      end: '2026-01-31',
      paidAt: '2026-01-31 17:00:00',
      status: 'PAID',
      yearMultiplier: 1.0, // New 2026 salary appraisal implemented
      bonusRatio: 0.0,
    },
    // 2025 Cycles (Previous Calendar Year - Base salary 10-12% lower prior to annual appraisal)
    {
      id: 'PR-CYCLE-2025-12',
      name: 'December 2025 Year-End Cycle',
      period: 'December 2025',
      start: '2025-12-01',
      end: '2025-12-31',
      paidAt: '2025-12-31 17:00:00',
      status: 'PAID',
      yearMultiplier: 0.892,
      bonusRatio: 0.12, // Annual Corporate Profit Share (+12%)
    },
    {
      id: 'PR-CYCLE-2025-11',
      name: 'November 2025 Regular Cycle',
      period: 'November 2025',
      start: '2025-11-01',
      end: '2025-11-30',
      paidAt: '2025-11-30 17:00:00',
      status: 'PAID',
      yearMultiplier: 0.892,
      bonusRatio: 0.0,
    },
    {
      id: 'PR-CYCLE-2025-10',
      name: 'October 2025 Regular Cycle',
      period: 'October 2025',
      start: '2025-10-01',
      end: '2025-10-31',
      paidAt: '2025-10-31 17:00:00',
      status: 'PAID',
      yearMultiplier: 0.892,
      bonusRatio: 0.0,
    },
    {
      id: 'PR-CYCLE-2025-09',
      name: 'September 2025 Regular Cycle',
      period: 'September 2025',
      start: '2025-09-01',
      end: '2025-09-30',
      paidAt: '2025-09-30 17:00:00',
      status: 'PAID',
      yearMultiplier: 0.892,
      bonusRatio: 0.0,
    },
    {
      id: 'PR-CYCLE-2025-08',
      name: 'August 2025 Regular Cycle',
      period: 'August 2025',
      start: '2025-08-01',
      end: '2025-08-31',
      paidAt: '2025-08-31 17:00:00',
      status: 'PAID',
      yearMultiplier: 0.892,
      bonusRatio: 0.0,
    }
  ];

  // Base wage map for 2026 (matching contracts in DB)
  const baseWages = {
    'EMP-001': 6500.00,
    'EMP-002': 7200.00,
    'EMP-003': 5200.00,
    'EMP-004': 8000.00,
    'EMP-005': 6800.00,
    'EMP-006': 6300.00,
  };

  let totalPayrunsCreated = 0;
  let totalPayslipsCreated = 0;

  for (const cycle of cycles) {
    let cycleTotalGross = 0;
    let cycleTotalNet = 0;
    let cycleEmpCount = 0;

    // Insert Payrun row first
    await conn.query(`
      INSERT INTO payruns (id, name, period, salary_structure_id, total_gross, total_net, employee_count, status, validated_at, validated_by, paid_at, paid_by)
      VALUES (?, ?, ?, 'STR-001', 0, 0, 0, ?, ?, 'admin@company.com', ?, 'Finance Automated Engine')
    `, [cycle.id, cycle.name, cycle.period, cycle.status, cycle.paidAt, cycle.paidAt]);

    totalPayrunsCreated++;

    for (const emp of employees) {
      const standardBase = baseWages[emp.id] || 6000.00;
      const effectiveBaseWage = Math.round(standardBase * cycle.yearMultiplier);
      const bonusAmount = Math.round(effectiveBaseWage * cycle.bonusRatio);
      const gross = effectiveBaseWage + bonusAmount;

      const basic = Math.round(gross * 0.60);
      const hra = Math.round(gross * 0.25);
      const allowance = gross - basic - hra; // Remaining allowances

      const tax = Math.round(gross * 0.10);
      const pf = Math.round(gross * 0.07);
      const totalDeductions = tax + pf;
      const net = gross - totalDeductions;

      cycleTotalGross += gross;
      cycleTotalNet += net;
      cycleEmpCount++;

      const slipId = `PSL-${emp.id.replace('EMP-', '')}-${cycle.id.replace('PR-CYCLE-', '')}`;

      const earningsBreakdown = [
        { code: 'BASIC', name: 'Basic Salary', category: 'BASIC', amount: basic },
        { code: 'HRA', name: 'House Rent Allowance', category: 'ALLOWANCE', amount: hra },
        { code: 'ALLOWANCE', name: bonusAmount > 0 ? 'Special & Performance Allowance' : 'Special Allowance', category: 'ALLOWANCE', amount: allowance },
      ];

      const deductionsBreakdown = [
        { code: 'TAX', name: 'Income Tax (TDS)', category: 'DEDUCTION', amount: tax },
        { code: 'PF', name: 'Provident Fund (PF)', category: 'DEDUCTION', amount: pf },
      ];

      const calculationSnapshot = {
        employee: {
          id: emp.id,
          name: emp.name,
          department: emp.department,
          position: emp.position,
          bankAccount: emp.bankAccountNo || '•••• 4921',
        },
        contractWage: effectiveBaseWage,
        gross,
        net,
        earnings: earningsBreakdown,
        deductions: deductionsBreakdown,
      };

      await conn.query(`
        INSERT INTO payslips (
          id, payrun_id, employee_id, period_start, period_end, contract_wage,
          basic, hra, allowance, gross, tax, other_deductions, net,
          earnings_breakdown, deductions_breakdown, calculation_snapshot,
          calculation_timestamp, calculation_version, status
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, 1, ?
        )
      `, [
        slipId,
        cycle.id,
        emp.id,
        cycle.start,
        cycle.end,
        effectiveBaseWage,
        basic,
        hra,
        allowance,
        gross,
        tax,
        pf,
        net,
        JSON.stringify(earningsBreakdown),
        JSON.stringify(deductionsBreakdown),
        JSON.stringify(calculationSnapshot),
        cycle.paidAt,
        cycle.status,
      ]);

      totalPayslipsCreated++;
    }

    // Update aggregated totals in payruns table
    await conn.query(`
      UPDATE payruns 
      SET total_gross = ?, total_net = ?, employee_count = ?
      WHERE id = ?
    `, [cycleTotalGross, cycleTotalNet, cycleEmpCount, cycle.id]);
  }

  console.log(`Successfully seeded ${totalPayrunsCreated} distinct monthly cycles across 2025 and 2026!`);
  console.log(`Successfully generated ${totalPayslipsCreated} persisted payslips with month-by-month and year-by-year variation!`);

  await conn.end();
}

main().catch((err) => {
  console.error('Seed script error:', err);
  process.exit(1);
});
