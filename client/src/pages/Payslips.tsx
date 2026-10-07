import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  FileText, 
  RefreshCw, 
  AlertCircle, 
  Calendar, 
  CheckCircle2, 
  CreditCard, 
  Search, 
  UserCheck, 
  Download,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { payrollApi } from '../api/payroll';
import { employeesApi } from '../api/employees';
import type { Employee, EmployeePayslipHistoryItem } from '../types';
import { DetailedPayslipModal } from '../components/DetailedPayslipModal';
import { formatCurrency, formatDate } from '../utils/formatters';
import { ApiError } from '../api/client';

type SortField = 'periodStart' | 'payrunName' | 'grossSalary' | 'totalDeductions' | 'netSalary' | 'status' | 'paidAt';
type SortDirection = 'asc' | 'desc';

const MONTH_NAMES = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

export const Payslips: React.FC = () => {
  const { user, displayRole } = useAuth();
  const isEmployee = displayRole === 'Employee';

  // State for all employees (for managers/admins)
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(
    user?.employeeId || 'EMP-001'
  );

  // Payslip history state
  const [payslips, setPayslips] = useState<EmployeePayslipHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPayslipId, setSelectedPayslipId] = useState<string | null>(null);

  // Filters state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [yearFilter, setYearFilter] = useState<string>('ALL');
  const [monthFilter, setMonthFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Sorting state (default: newest period first)
  const [sortField, setSortField] = useState<SortField>('periodStart');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const requestIdRef = useRef<number>(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      requestIdRef.current = -1;
    };
  }, []);

  // 1. Load employees list for managers/admins
  useEffect(() => {
    if (!isEmployee) {
      employeesApi.getAll()
        .then((list) => {
          setEmployees(list);
          if (list.length > 0 && (!selectedEmployeeId || !list.some(e => e.id === selectedEmployeeId))) {
            setSelectedEmployeeId(user?.employeeId && list.some(e => e.id === user.employeeId) ? user.employeeId : list[0].id);
          }
        })
        .catch((err) => {
          console.warn('[Payslips] Could not load employees dropdown:', err);
        });
    }
  }, [isEmployee, user?.employeeId]);

  // Target employee ID to query:
  // Strictly enforce user's own employeeId for EMPLOYEE role to prevent any cross-employee UI leak
  const targetEmployeeId = isEmployee ? (user?.employeeId || '') : selectedEmployeeId;

  // 2. Fetch employee payslips from backend API with concurrency guard
  const fetchPayslips = useCallback(async () => {
    if (!targetEmployeeId) {
      setLoading(false);
      setPayslips([]);
      return;
    }

    const currentReqId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const history = await payrollApi.getEmployeePayslips(targetEmployeeId);
      if (currentReqId === requestIdRef.current) {
        setPayslips(history);
      }
    } catch (err: any) {
      if (currentReqId === requestIdRef.current) {
        console.error('[Payslips] Failed to load payslips:', err instanceof Error ? err.message : String(err));
        if (err instanceof ApiError) {
          if (err.statusCode === 403) {
            setError('Access Denied: You do not have permission to view payroll records for this employee.');
          } else if (err.statusCode === 404) {
            setError(`No payroll records found for employee '${targetEmployeeId}'.`);
          } else {
            setError(err.message || 'Failed to retrieve payslip history.');
          }
        } else {
          setError(err?.message || 'Unable to load payslips. Please check your connection.');
        }
      }
    } finally {
      if (currentReqId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [targetEmployeeId]);

  useEffect(() => {
    fetchPayslips();
  }, [fetchPayslips]);

  // Extract available distinct years from payslip history
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    payslips.forEach((p) => {
      const dateStr = p.payrollPeriod.start || p.calculatedAt;
      if (dateStr) {
        const y = new Date(dateStr).getFullYear();
        if (!isNaN(y)) years.add(String(y));
      }
    });
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [payslips]);

  // Filter & Sort payslips
  const filteredAndSortedPayslips = useMemo(() => {
    return payslips
      .filter((p) => {
        // Free-text search
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          const periodStr = `${p.payrollPeriod.start || ''} ${p.payrollPeriod.end || ''}`.toLowerCase();
          const nameMatch = p.payrunName.toLowerCase().includes(term);
          const periodMatch = periodStr.includes(term);
          const idMatch = p.payslipId.toLowerCase().includes(term);
          const statusMatch = p.status.toLowerCase().includes(term);
          if (!nameMatch && !periodMatch && !idMatch && !statusMatch) return false;
        }

        // Year filter
        if (yearFilter !== 'ALL') {
          const pDate = p.payrollPeriod.start || p.calculatedAt;
          if (pDate) {
            const yr = String(new Date(pDate).getFullYear());
            if (yr !== yearFilter) return false;
          }
        }

        // Month filter
        if (monthFilter !== 'ALL') {
          const pDate = p.payrollPeriod.start || p.calculatedAt;
          if (pDate) {
            const d = new Date(pDate);
            const m = String(d.getMonth() + 1).padStart(2, '0');
            if (m !== monthFilter) return false;
          }
        }

        // Status filter
        if (statusFilter !== 'ALL' && p.status !== statusFilter) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        let valA: string | number = '';
        let valB: string | number = '';

        switch (sortField) {
          case 'periodStart':
            valA = a.payrollPeriod.start || a.calculatedAt || '';
            valB = b.payrollPeriod.start || b.calculatedAt || '';
            break;
          case 'payrunName':
            valA = a.payrunName.toLowerCase();
            valB = b.payrunName.toLowerCase();
            break;
          case 'grossSalary':
            valA = a.grossSalary;
            valB = b.grossSalary;
            break;
          case 'totalDeductions':
            valA = a.totalDeductions;
            valB = b.totalDeductions;
            break;
          case 'netSalary':
            valA = a.netSalary;
            valB = b.netSalary;
            break;
          case 'status':
            valA = a.status;
            valB = b.status;
            break;
          case 'paidAt':
            valA = a.paidAt || '';
            valB = b.paidAt || '';
            break;
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
  }, [payslips, searchTerm, yearFilter, monthFilter, statusFilter, sortField, sortDirection]);

  // Aggregate summary metrics for current filtered view
  const summary = useMemo(() => {
    const count = filteredAndSortedPayslips.length;
    const totalGross = filteredAndSortedPayslips.reduce((acc, p) => acc + (p.grossSalary || 0), 0);
    const totalDeductions = filteredAndSortedPayslips.reduce((acc, p) => acc + (p.totalDeductions || 0), 0);
    const totalNet = filteredAndSortedPayslips.reduce((acc, p) => acc + (p.netSalary || 0), 0);
    const avgNet = count > 0 ? totalNet / count : 0;

    return {
      count,
      totalGross,
      totalDeductions,
      totalNet,
      avgNet,
    };
  }, [filteredAndSortedPayslips]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'periodStart' || field === 'grossSalary' || field === 'netSalary' ? 'desc' : 'asc');
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

  const isFilterActive = searchTerm !== '' || yearFilter !== 'ALL' || monthFilter !== 'ALL' || statusFilter !== 'ALL';

  const resetFilters = () => {
    setSearchTerm('');
    setYearFilter('ALL');
    setMonthFilter('ALL');
    setStatusFilter('ALL');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return (
          <span className="badge badge-success">
            <span className="badge-dot" />
            PAID
          </span>
        );
      case 'VALIDATED':
        return (
          <span className="badge badge-info">
            <span className="badge-dot" />
            VALIDATED
          </span>
        );
      case 'COMPUTED':
        return (
          <span className="badge badge-info">
            <span className="badge-dot" />
            COMPUTED
          </span>
        );
      case 'DRAFT':
      default:
        return (
          <span className="badge badge-warning">
            <span className="badge-dot" />
            DRAFT
          </span>
        );
    }
  };

  const selectedEmployeeName = isEmployee
    ? (user?.name || user?.employeeId || 'My Account')
    : (employees.find((e) => e.id === selectedEmployeeId)?.name || selectedEmployeeId);

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {isEmployee ? 'My Payslips' : 'Employee Payslips & Payroll History'}
          </h1>
          <p className="page-desc">
            {isEmployee 
              ? 'View and inspect your historical payslip vouchers with complete month-by-month and year-by-year earnings and deductions breakdowns.'
              : 'Audit historical, persisted payslips across company staff members with zero recalculation.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={fetchPayslips}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Refresh payslips from database"
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Manager / Admin Employee Selector Bar */}
      {!isEmployee && employees.length > 0 && (
        <div className="card" style={{ marginBottom: '20px', padding: '14px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <UserCheck size={16} color="var(--primary)" />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--slate-700)' }}>
                Select Employee:
              </span>
              <select
                aria-label="Select Employee for Payslip History"
                className="form-input"
                style={{
                  width: 'auto',
                  fontWeight: 600,
                  fontSize: '13px',
                  padding: '6px 12px',
                  height: 'auto',
                  cursor: 'pointer',
                  minWidth: '240px',
                }}
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.id} • {emp.department})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--slate-500)' }}>
              Viewing records for: <strong>{selectedEmployeeName}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div
          style={{
            marginBottom: '16px',
            padding: '12px 16px',
            borderRadius: 'var(--radius)',
            backgroundColor: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            color: 'var(--danger-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '13px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={fetchPayslips} style={{ padding: '4px 10px' }}>
            Retry
          </button>
        </div>
      )}

      {/* Summary KPI Strip for Filtered History */}
      {!loading && !error && payslips.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
          <div className="card" style={{ padding: '14px 18px' }}>
            <div style={{ fontSize: '12px', color: 'var(--slate-500)', fontWeight: 500, marginBottom: '4px' }}>
              Payroll Cycles
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-main)' }}>
              {summary.count} {summary.count === 1 ? 'Cycle' : 'Cycles'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--slate-400)', marginTop: '4px' }}>
              {isFilterActive ? 'In active filter selection' : 'Total historical records'}
            </div>
          </div>

          <div className="card" style={{ padding: '14px 18px' }}>
            <div style={{ fontSize: '12px', color: 'var(--slate-500)', fontWeight: 500, marginBottom: '4px' }}>
              Total Gross Earnings
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-main)' }}>
              {formatCurrency(summary.totalGross)}
            </div>
            <div style={{ fontSize: '11px', color: '#059669', marginTop: '4px', fontWeight: 500 }}>
              Before standard deductions
            </div>
          </div>

          <div className="card" style={{ padding: '14px 18px' }}>
            <div style={{ fontSize: '12px', color: 'var(--slate-500)', fontWeight: 500, marginBottom: '4px' }}>
              Total Deductions
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#dc2626' }}>
              -{formatCurrency(summary.totalDeductions)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--slate-400)', marginTop: '4px' }}>
              Tax, PF & Statutory withholding
            </div>
          </div>

          <div className="card" style={{ padding: '14px 18px' }}>
            <div style={{ fontSize: '12px', color: 'var(--slate-500)', fontWeight: 500, marginBottom: '4px' }}>
              Total Net Disbursed
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)' }}>
              {formatCurrency(summary.totalNet)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--slate-500)', marginTop: '4px' }}>
              Avg {formatCurrency(summary.avgNet)} / cycle
            </div>
          </div>
        </div>
      )}

      {/* Filter and Sorting Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Search Box */}
          <div className="search-box" style={{ width: '220px' }}>
            <Search size={15} color="var(--slate-400)" />
            <input 
              type="text"
              placeholder="Search cycle, ref, period…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Year Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={14} color="var(--slate-400)" />
            <select
              aria-label="Filter payslips by year"
              className="form-input"
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '13px', minWidth: '110px', height: 'auto', fontWeight: 500 }}
            >
              <option value="ALL">All Years</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>

          {/* Month Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={14} color="var(--slate-400)" />
            <select
              aria-label="Filter payslips by month"
              className="form-input"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '13px', minWidth: '125px', height: 'auto', fontWeight: 500 }}
            >
              <option value="ALL">All Months</option>
              {MONTH_NAMES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <select
              aria-label="Filter payslips by status"
              className="form-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '13px', minWidth: '115px', height: 'auto', fontWeight: 500 }}
            >
              <option value="ALL">All Statuses</option>
              <option value="PAID">PAID</option>
              <option value="VALIDATED">VALIDATED</option>
              <option value="COMPUTED">COMPUTED</option>
              <option value="DRAFT">DRAFT</option>
            </select>
          </div>

          {/* Reset Filters */}
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
          Showing <strong>{filteredAndSortedPayslips.length}</strong> {filteredAndSortedPayslips.length === 1 ? 'cycle' : 'cycles'}
        </div>
      </div>

      {/* Payslip History Table Card */}
      <div className="table-container">
        <div style={{ 
          padding: '14px 18px', 
          borderBottom: '1px solid var(--border-color)', 
          fontWeight: 700, 
          fontSize: '14px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CreditCard size={16} color="var(--primary)" />
            <span>Persisted Payslip History — {selectedEmployeeName}</span>
          </div>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--slate-500)', letterSpacing: '0.04em' }}>
            Month-By-Month Verified Records
          </span>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--slate-500)' }}>
            <RefreshCw size={26} className="spin" style={{ margin: '0 auto 12px', display: 'block', color: 'var(--primary)' }} />
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--slate-800)', marginBottom: '4px' }}>
              Loading Payslip History…
            </div>
            <div style={{ fontSize: '12px', color: 'var(--slate-500)' }}>
              Querying persisted historical payroll snapshots.
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredAndSortedPayslips.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--slate-400)' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>📄</div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--slate-700)', marginBottom: '4px' }}>
              No Historical Payslips Found
            </div>
            <div style={{ fontSize: '13px', color: 'var(--slate-500)', maxWidth: '420px', margin: '0 auto' }}>
              {isFilterActive 
                ? 'No payslips match your active filter criteria. Try resetting or adjusting the year and month filters.'
                : `No payroll snapshots have been calculated for ${selectedEmployeeName} yet.`}
            </div>
          </div>
        )}

        {/* Live Records Table */}
        {!loading && !error && filteredAndSortedPayslips.length > 0 && (
          <table>
            <thead>
              <tr>
                <th onClick={() => handleSort('payrunName')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Cycle Name</span>
                    {getSortIcon('payrunName')}
                  </div>
                </th>
                <th onClick={() => handleSort('periodStart')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Payroll Period</span>
                    {getSortIcon('periodStart')}
                  </div>
                </th>
                <th onClick={() => handleSort('grossSalary')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Gross Salary</span>
                    {getSortIcon('grossSalary')}
                  </div>
                </th>
                <th onClick={() => handleSort('totalDeductions')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Total Deductions</span>
                    {getSortIcon('totalDeductions')}
                  </div>
                </th>
                <th onClick={() => handleSort('netSalary')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Net Disbursement</span>
                    {getSortIcon('netSalary')}
                  </div>
                </th>
                <th onClick={() => handleSort('status')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Status</span>
                    {getSortIcon('status')}
                  </div>
                </th>
                <th onClick={() => handleSort('paidAt')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Disbursed Date</span>
                    {getSortIcon('paidAt')}
                  </div>
                </th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedPayslips.map((slip) => (
                <tr key={slip.payslipId}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{slip.payrunName}</div>
                    <div style={{ fontSize: '11px', color: 'var(--slate-400)' }}>Ref: #{slip.payslipId}</div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                      <Calendar size={13} color="var(--slate-400)" />
                      <span>
                        {slip.payrollPeriod.start && slip.payrollPeriod.end
                          ? `${formatDate(slip.payrollPeriod.start)} – ${formatDate(slip.payrollPeriod.end)}`
                          : 'Regular Cycle'}
                      </span>
                    </div>
                  </td>
                  <td style={{ fontWeight: 600 }}>{formatCurrency(slip.grossSalary)}</td>
                  <td style={{ color: '#be123c', fontWeight: 500 }}>-{formatCurrency(slip.totalDeductions)}</td>
                  <td style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '14px' }}>
                    {formatCurrency(slip.netSalary)}
                  </td>
                  <td>{getStatusBadge(slip.status)}</td>
                  <td>
                    {slip.paidAt ? (
                      <span style={{ fontSize: '12px', color: 'var(--slate-600)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={12} color="#047857" />
                        {formatDate(slip.paidAt)}
                      </span>
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--slate-400)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedPayslipId(slip.payslipId)}
                        style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                      >
                        <FileText size={12} />
                        <span>View Breakdown</span>
                      </button>
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={async () => {
                          try {
                            await payrollApi.downloadPayslipPdf(slip.payslipId);
                          } catch (err: any) {
                            alert(err?.message || 'Failed to download payslip PDF');
                          }
                        }}
                        title="Download PDF Voucher"
                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Download size={12} />
                        <span>PDF</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detailed Payslip Modal */}
      {selectedPayslipId && (
        <DetailedPayslipModal
          payslipId={selectedPayslipId}
          onClose={() => setSelectedPayslipId(null)}
        />
      )}
    </div>
  );
};
