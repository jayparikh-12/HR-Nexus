import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Clock, 
  RefreshCw, 
  Search, 
  Filter, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  CheckCircle2, 
  Calendar,
  X
} from 'lucide-react';
import type { AttendanceRecord } from '../types';
import { attendanceApi } from '../api/attendance';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { employeesApi } from '../api/employees';

interface AttendanceProps {
  attendanceRecords?: AttendanceRecord[];
  onAddRecord?: (record: AttendanceRecord) => void;
}

type SortField = 'date' | 'employeeName' | 'checkIn' | 'checkOut' | 'workedHours' | 'status';
type SortDirection = 'asc' | 'desc';

export const Attendance: React.FC<AttendanceProps> = ({ onAddRecord }) => {
  const { user } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isCheckedIn, setIsCheckedIn] = useState<boolean>(false);
  const [isCompletedToday, setIsCompletedToday] = useState<boolean>(false);
  const [activeRecord, setActiveRecord] = useState<AttendanceRecord | null>(null);
  const [resolvedEmployeeId, setResolvedEmployeeId] = useState<string | undefined>(
    () => user?.employeeId || (user?.id?.startsWith('EMP-') ? user.id : undefined)
  );

  // Filters & Sorting state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const todayStr = new Date().toISOString().split('T')[0];

  // Resolve employee ID for Admin or unlinked users via directory lookup
  useEffect(() => {
    if (resolvedEmployeeId) return;

    let isMounted = true;
    async function resolveEmployee() {
      if (!user?.email) return;
      try {
        const emps = await employeesApi.getAll();
        const matched = emps.find(
          (e) =>
            e.email?.toLowerCase() === user.email.toLowerCase() ||
            (user.name && e.name?.toLowerCase() === user.name.toLowerCase())
        );
        if (matched && isMounted) {
          setResolvedEmployeeId(matched.id);
        }
      } catch (_e) {
        // Continue gracefully
      }
    }
    resolveEmployee();
    return () => {
      isMounted = false;
    };
  }, [user, resolvedEmployeeId]);

  const syncActiveState = useCallback((fetchedRecords: AttendanceRecord[], activeEmpId?: string) => {
    const empId = activeEmpId || resolvedEmployeeId || user?.employeeId || (user?.id?.startsWith('EMP-') ? user.id : undefined);

    const todayRecord = fetchedRecords.find(
      (r) =>
        ((empId && r.employeeId === empId) ||
          (user?.name && r.employeeName?.trim().toLowerCase() === user.name.trim().toLowerCase())) &&
        r.date === todayStr
    );

    const completed = Boolean(
      todayRecord &&
      todayRecord.checkIn &&
      todayRecord.checkIn !== '—' &&
      todayRecord.checkOut &&
      todayRecord.checkOut !== 'Active' &&
      todayRecord.checkOut !== '—' &&
      todayRecord.checkOut.trim() !== ''
    );

    const active = fetchedRecords.find(
      (r) =>
        ((empId && r.employeeId === empId) ||
          (user?.name && r.employeeName?.trim().toLowerCase() === user.name.trim().toLowerCase())) &&
        r.status !== 'ABSENT' &&
        r.checkIn &&
        r.checkIn !== '—' &&
        (r.checkOut === 'Active' || !r.checkOut || r.checkOut === '—' || r.checkOut.trim() === '')
    );

    setIsCompletedToday(completed);

    if (active) {
      setIsCheckedIn(true);
      setActiveRecord(active);
    } else {
      setIsCheckedIn(false);
      setActiveRecord(null);
    }
  }, [user, resolvedEmployeeId, todayStr]);

  const loadAttendance = useCallback(async (activeEmpId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await attendanceApi.getAll();
      setRecords(data);
      syncActiveState(data, activeEmpId);
    } catch (err) {
      console.error('[Attendance Page] Failed to fetch records:', err instanceof Error ? err.message : String(err));
      setError(err instanceof ApiError ? err.message : 'Unable to load attendance records. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [syncActiveState]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const getSystemTime = (): string => {
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  };

  const getSystemDate = (): string => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const handleToggleCheck = async () => {
    if (submitting) return;

    if (isCompletedToday) {
      setError('Daily attendance limit reached: Each employee is restricted to 1 check-in and 1 check-out per calendar day.');
      return;
    }

    let empId = resolvedEmployeeId || user?.employeeId || (user?.id?.startsWith('EMP-') ? user.id : undefined);

    if (!empId && user?.email) {
      try {
        const emps = await employeesApi.getAll();
        const matched = emps.find(
          (e) =>
            e.email?.toLowerCase() === user.email.toLowerCase() ||
            (user.name && e.name?.toLowerCase() === user.name.toLowerCase())
        );
        if (matched) {
          empId = matched.id;
          setResolvedEmployeeId(matched.id);
        }
      } catch (_e) {
        // Continue
      }
    }

    if (!empId) {
      setError('No employee profile is linked to this account. Please link an employee profile in the directory to enable self check-in.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (!isCheckedIn) {
        // Clock In with exact system time
        const currentTime = getSystemTime();
        const currentDate = getSystemDate();
        const created = await attendanceApi.checkIn({
          employeeId: empId,
          checkIn: currentTime,
          date: currentDate,
        });
        await loadAttendance(empId);
        onAddRecord?.(created);
      } else {
        // Clock Out with exact system time
        const currentTime = getSystemTime();
        await attendanceApi.checkOut({
          recordId: activeRecord?.id,
          employeeId: empId,
          checkOut: currentTime,
        });
        await loadAttendance(empId);
      }
    } catch (err) {
      console.error('[Attendance Action] Error toggling check state:', err instanceof Error ? err.message : String(err));
      setError(err instanceof ApiError ? err.message : 'Operation failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={13} style={{ opacity: 0.4 }} />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp size={13} style={{ color: 'var(--primary)' }} /> 
      : <ArrowDown size={13} style={{ color: 'var(--primary)' }} />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return <span className="badge badge-success"><span className="badge-dot" />Present</span>;
      case 'LATE':
        return <span className="badge badge-warning"><span className="badge-dot" />Late</span>;
      case 'OVERTIME':
        return <span className="badge badge-info"><span className="badge-dot" />Overtime</span>;
      case 'ABSENT':
        return <span className="badge badge-danger"><span className="badge-dot" />Absent</span>;
      default:
        return <span className="badge badge-neutral">{status}</span>;
    }
  };

  // Filtered & Sorted records
  const filteredAndSortedRecords = useMemo(() => {
    return records
      .filter((rec) => {
        // Search Term (Employee Name or ID)
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          const nameMatch = (rec.employeeName || '').toLowerCase().includes(term);
          const idMatch = (rec.employeeId || '').toLowerCase().includes(term);
          if (!nameMatch && !idMatch) return false;
        }

        // Status Filter
        if (statusFilter !== 'ALL' && rec.status !== statusFilter) {
          return false;
        }

        // Date Filter
        if (dateFilter === 'TODAY' && rec.date !== todayStr) {
          return false;
        }
        if (dateFilter === 'PAST_7_DAYS') {
          const recDate = new Date(rec.date);
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          if (recDate < sevenDaysAgo) return false;
        }
        if (dateFilter === 'THIS_MONTH') {
          const currentMonthPrefix = todayStr.substring(0, 7); // 'YYYY-MM'
          if (!rec.date.startsWith(currentMonthPrefix)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        let valA: string | number = '';
        let valB: string | number = '';

        switch (sortField) {
          case 'date':
            valA = a.date || '';
            valB = b.date || '';
            break;
          case 'employeeName':
            valA = (a.employeeName || a.employeeId || '').toLowerCase();
            valB = (b.employeeName || b.employeeId || '').toLowerCase();
            break;
          case 'checkIn':
            valA = a.checkIn || '';
            valB = b.checkIn || '';
            break;
          case 'checkOut':
            valA = a.checkOut || '';
            valB = b.checkOut || '';
            break;
          case 'workedHours':
            valA = a.workedHours || 0;
            valB = b.workedHours || 0;
            break;
          case 'status':
            valA = a.status || '';
            valB = b.status || '';
            break;
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
  }, [records, searchTerm, statusFilter, dateFilter, sortField, sortDirection, todayStr]);

  // Metrics summary
  const hasTodayRecords = records.some((r) => r.date === todayStr);
  const targetDataset = hasTodayRecords ? records.filter((r) => r.date === todayStr) : records;

  const presentCount = targetDataset.filter((r) => r.status === 'PRESENT' || r.status === 'OVERTIME' || r.status === 'LATE').length;
  const lateCount = targetDataset.filter((r) => r.status === 'LATE').length;
  const overtimeCount = targetDataset.filter((r) => r.status === 'OVERTIME').length;
  const absentCount = targetDataset.filter((r) => r.status === 'ABSENT').length;

  const isFilterActive = searchTerm !== '' || statusFilter !== 'ALL' || dateFilter !== 'ALL';

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setDateFilter('ALL');
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance Registry</h1>
          <p className="page-desc">Daily check-in and check-out logs feeding into the payroll overtime and absence engine.</p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => loadAttendance()}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Refresh attendance from database"
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          {/* Live Check-in / Out Widget */}
          <button
            className={`btn ${isCompletedToday ? 'btn-secondary' : isCheckedIn ? 'btn-danger' : 'btn-primary'}`}
            onClick={handleToggleCheck}
            disabled={submitting || isCompletedToday}
            style={isCompletedToday ? { opacity: 0.85, cursor: 'not-allowed' } : undefined}
            title={
              isCompletedToday 
                ? 'Daily limit reached: 1 check-in and 1 check-out allowed per day.' 
                : isCheckedIn 
                ? 'Clock out to finish today\'s shift.' 
                : 'Clock in to begin shift.'
            }
          >
            {isCompletedToday ? (
              <>
                <CheckCircle2 size={15} color="#10b981" />
                <span>Shift Completed (1/1 Limit Reached)</span>
              </>
            ) : (
              <>
                <Clock size={15} />
                <span>
                  {submitting
                    ? 'Processing...'
                    : isCheckedIn
                    ? 'Clock Out (Active Session)'
                    : 'Self Check-In Now'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {isCompletedToday && (
        <div style={{ 
          marginBottom: '16px', 
          padding: '10px 14px', 
          background: '#ecfdf5', 
          border: '1px solid #a7f3d0', 
          borderRadius: '8px', 
          fontSize: '13px', 
          color: '#065f46', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px' 
        }}>
          <CheckCircle2 size={16} color="#059669" />
          <span>
            <strong>Daily Limit Enforced:</strong> You have completed your shift check-in and check-out for today ({todayStr}). Each employee is restricted to at most 1 check-in and 1 check-out per calendar day.
          </span>
        </div>
      )}

      {error && (
        <div style={{ marginBottom: '16px', padding: '10px 14px', background: '#fee2e2', border: '1px solid #f87171', borderRadius: '8px', fontSize: '13px', color: '#991b1b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ {error}</span>
          <button
            onClick={() => setError(null)}
            style={{ background: 'transparent', border: 'none', color: '#991b1b', cursor: 'pointer', fontWeight: 600, fontSize: '16px', lineHeight: 1 }}
            title="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Summary Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card">
          <div className="metric-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Present Today</span>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#059669' }} />
          </div>
          <div className="metric-val" style={{ color: '#059669' }}>{presentCount} Staff</div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '6px' }}>On-schedule & active check-ins</div>
        </div>
        <div className="card">
          <div className="metric-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Late Arrivals</span>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#d97706' }} />
          </div>
          <div className="metric-val" style={{ color: '#d97706' }}>{lateCount} Staff</div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '6px' }}>Clocked in past grace period</div>
        </div>
        <div className="card">
          <div className="metric-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Overtime Shifts</span>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }} />
          </div>
          <div className="metric-val" style={{ color: 'var(--primary)' }}>{overtimeCount} Staff</div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '6px' }}>Shift duration exceeding 8 hrs</div>
        </div>
        <div className="card">
          <div className="metric-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Absences Recorded</span>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#e11d48' }} />
          </div>
          <div className="metric-val" style={{ color: '#e11d48' }}>{absentCount} Staff</div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '6px' }}>No check-in or approved leave</div>
        </div>
      </div>

      {/* Filter and Controls Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Search Box */}
          <div className="search-box" style={{ width: '250px' }}>
            <Search size={15} color="var(--slate-400)" />
            <input 
              type="text"
              placeholder="Search employee or ID…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Status Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={14} color="var(--slate-400)" />
            <select
              aria-label="Filter attendance by status"
              className="form-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '13px', minWidth: '130px', height: 'auto', fontWeight: 500 }}
            >
              <option value="ALL">All Statuses</option>
              <option value="PRESENT">Present</option>
              <option value="LATE">Late</option>
              <option value="OVERTIME">Overtime</option>
              <option value="ABSENT">Absent</option>
            </select>
          </div>

          {/* Date Filter Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={14} color="var(--slate-400)" />
            <select
              aria-label="Filter attendance by timeframe"
              className="form-input"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '13px', minWidth: '130px', height: 'auto', fontWeight: 500 }}
            >
              <option value="ALL">All Dates</option>
              <option value="TODAY">Today Only</option>
              <option value="PAST_7_DAYS">Past 7 Days</option>
              <option value="THIS_MONTH">This Month</option>
            </select>
          </div>

          {/* Clear Filters */}
          {isFilterActive && (
            <button
              onClick={resetFilters}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', fontSize: '12px' }}
              title="Reset all filters"
            >
              <X size={13} />
              <span>Clear</span>
            </button>
          )}
        </div>

        <div style={{ fontSize: '13px', color: 'var(--slate-500)' }}>
          Showing <strong>{filteredAndSortedRecords.length}</strong> {filteredAndSortedRecords.length === 1 ? 'record' : 'records'}
        </div>
      </div>

      {/* Attendance Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th onClick={() => handleSort('employeeName')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Employee</span>
                  {getSortIcon('employeeName')}
                </div>
              </th>
              <th onClick={() => handleSort('date')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Date</span>
                  {getSortIcon('date')}
                </div>
              </th>
              <th onClick={() => handleSort('checkIn')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Clock In</span>
                  {getSortIcon('checkIn')}
                </div>
              </th>
              <th onClick={() => handleSort('checkOut')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Clock Out</span>
                  {getSortIcon('checkOut')}
                </div>
              </th>
              <th onClick={() => handleSort('workedHours')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Worked Hours</span>
                  {getSortIcon('workedHours')}
                </div>
              </th>
              <th onClick={() => handleSort('status')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Compliance Status</span>
                  {getSortIcon('status')}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--slate-400)' }}>
                  Loading attendance records from database...
                </td>
              </tr>
            ) : filteredAndSortedRecords.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--slate-400)' }}>
                  {isFilterActive 
                    ? 'No attendance records match your filter criteria.' 
                    : 'No attendance records found in database. Click "Self Check-In Now" to clock in.'}
                </td>
              </tr>
            ) : (
              filteredAndSortedRecords.map((rec) => (
                <tr key={rec.id}>
                  <td style={{ fontWeight: 600 }}>{rec.employeeName}</td>
                  <td style={{ color: 'var(--slate-500)' }}>{rec.date}</td>
                  <td>{rec.checkIn}</td>
                  <td>{rec.checkOut}</td>
                  <td style={{ fontWeight: 600 }}>{rec.workedHours > 0 ? `${rec.workedHours} hrs` : 'In Progress'}</td>
                  <td>{getStatusBadge(rec.status)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
