import { pool } from '../src/config/database.js';

async function main() {
  console.log('[sync-dynamic-data] Connecting to MySQL...');

  // 1. Fetch all employees
  const [employees] = await pool.query(`
    SELECT id, empCode, name, dateOfBirth, status
    FROM employees
    ORDER BY id ASC
  `);

  console.log(`[sync-dynamic-data] Found ${employees.length} employees.`);

  // 2. Populate Date of Birth for employees missing it
  const birthYears = [1985, 1987, 1989, 1990, 1992, 1993, 1994, 1995, 1996, 1998, 1999, 2000, 2001];
  const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
  const days = ['04', '09', '12', '15', '18', '21', '24', '27', '28'];

  let dobUpdatedCount = 0;
  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i];
    if (!emp.dateOfBirth) {
      const year = birthYears[i % birthYears.length];
      const month = months[(i * 3 + 2) % months.length];
      const day = days[(i * 7 + 5) % days.length];
      const dob = `${year}-${month}-${day}`;

      await pool.query('UPDATE employees SET dateOfBirth = ? WHERE id = ?', [dob, emp.id]);
      dobUpdatedCount++;
    }
  }
  console.log(`[sync-dynamic-data] Updated Date of Birth for ${dobUpdatedCount} employees.`);

  // 3. Ensure dynamic attendance history for employees with 0 records
  const [existingAtt] = await pool.query(`
    SELECT employee_id, COUNT(*) as count
    FROM attendance_records
    GROUP BY employee_id
  `);
  const attEmpSet = new Set(existingAtt.map(r => r.employee_id));

  // Generate 15 recent working days
  const dates = [];
  const curr = new Date();
  while (dates.length < 15) {
    curr.setDate(curr.getDate() - 1);
    const dayOfWeek = curr.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Weekdays only
      dates.push(curr.toISOString().split('T')[0]);
    }
  }

  let seededRecordsCount = 0;
  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i];
    const hasAtt = attEmpSet.has(emp.id) || (emp.empCode && attEmpSet.has(emp.empCode));
    if (!hasAtt) {
      // Determine realistic attendance profile: 90% - 100%
      const absenteeFrequency = (i % 5 === 0) ? 2 : (i % 3 === 0) ? 1 : 0;
      const lateFrequency = (i % 4 === 0) ? 1 : 0;

      for (let d = 0; d < dates.length; d++) {
        const dateStr = dates[d];
        const recordId = `ATT-${emp.id.slice(0, 8)}-${d + 1}`;
        let status = 'PRESENT';
        let checkIn = '09:00 AM';
        let checkOut = '05:30 PM';
        let workedHours = 8.5;

        if (d < absenteeFrequency) {
          status = 'ABSENT';
          checkIn = '—';
          checkOut = '—';
          workedHours = 0;
        } else if (d === absenteeFrequency && lateFrequency > 0) {
          status = 'LATE';
          checkIn = '09:42 AM';
          checkOut = '05:30 PM';
          workedHours = 7.8;
        }

        await pool.query(`
          INSERT INTO attendance_records (id, employee_id, date, check_in, check_out, worked_hours, status)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE status = VALUES(status)
        `, [recordId, emp.id, dateStr, checkIn, checkOut, workedHours, status]);

        seededRecordsCount++;
      }
    }
  }

  console.log(`[sync-dynamic-data] Seeded ${seededRecordsCount} attendance records for dynamic rates.`);
  console.log('[sync-dynamic-data] Finished successfully.');
  await pool.end();
  process.exit(0);
}

main().catch(err => {
  console.error('[sync-dynamic-data] Error:', err);
  process.exit(1);
});
