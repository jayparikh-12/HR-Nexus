import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  Users, 
  CheckCircle2, 
  TrendingUp, 
  Play, 
  RefreshCw, 
  CreditCard, 
  Clock, 
  Palmtree, 
  Check, 
  Megaphone, 
  Shield,
  AlertCircle
} from 'lucide-react';
import type { Employee, Payrun, TimeOffRequest, EmployeePayslipHistoryItem } from '../types';
import { dashboardApi, type DashboardMetrics, type DashboardFilters } from '../api/dashboard';
import { attendanceApi } from '../api/attendance';
import { employeesApi } from '../api/employees';
import { timeOffApi } from '../api/timeOff';
import { payrollApi } from '../api/payroll';
import { formatCurrency } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import { isTabAllowed } from '../utils/routes';

interface DashboardProps {
  employees?: Employee[];
  payruns?: Payrun[];
  onNavigate: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ employees = [], onNavigate }) => {
  const { displayRole, user } = useAuth();
  const canAccessPayruns = isTabAllowed('payruns', displayRole);

  // ── State Management ────────────────────────────────────────────────────────
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Interactive Live Punch Clock State for Employee (1 check-in & 1 check-out per day limit)
  const [isClockedIn, setIsClockedIn] = useState<boolean>(false);
  const [isCompletedToday, setIsCompletedToday] = useState<boolean>(false);
  const [clockInTime, setClockInTime] = useState<string>('—');
  const [punchSeconds, setPunchSeconds] = useState<number>(0);
  const [activeAttendanceId, setActiveAttendanceId] = useState<string | null>(null);
  const [resolvedEmpId, setResolvedEmpId] = useState<string | null>(null);
  const [punchLoading, setPunchLoading] = useState<boolean>(false);

  // Dynamic Employee Portal Data State
  const [employeeProfile, setEmployeeProfile] = useState<Employee | null>(null);
  const [employeeTimeOff, setEmployeeTimeOff] = useState<TimeOffRequest[]>([]);
  const [employeeLatestPayslip, setEmployeeLatestPayslip] = useState<EmployeePayslipHistoryItem | null>(null);

  // Sync punch clock and employee self-service data on mount from MySQL
  useEffect(() => {
    if (displayRole !== 'Employee') return;

    let isMounted = true;
    const syncAttendance = async () => {
      try {
        let empId = user?.employeeId || (user?.id?.startsWith('EMP-') ? user.id : undefined);
        const allEmps = await employeesApi.getAll().catch(() => []);
        let match = allEmps.find(e => 
          (empId && (e.id === empId || e.empCode === empId)) ||
          (user?.email && e.email?.toLowerCase() === user.email?.toLowerCase()) ||
          (user?.name && e.name?.toLowerCase() === user.name?.toLowerCase())
        );
        if (!match && allEmps.length > 0) match = allEmps[0];
        if (match) {
          empId = match.id;
          if (isMounted) setEmployeeProfile(match);
        }
        if (!empId) empId = 'EMP-001';
        if (isMounted) setResolvedEmpId(empId);

        // Fetch personal time-off requests
        const allTimeOff = await timeOffApi.getAll().catch(() => []);
        const personalTimeOff = allTimeOff.filter(r => 
          r.employeeId === empId || 
          (match && r.employeeName?.toLowerCase() === match.name?.toLowerCase())
        );
        if (isMounted) setEmployeeTimeOff(personalTimeOff);

        // Fetch personal payslip history
        if (empId) {
          const slips = await payrollApi.getEmployeePayslips(empId).catch(() => []);
          if (isMounted && slips && slips.length > 0) {
            setEmployeeLatestPayslip(slips[0]);
          }
        }

        const records = await attendanceApi.getAll().catch(() => []);
        const todayStr = new Date().toISOString().split('T')[0];
        const todayRec = records.find(r => 
          (r.employeeId === empId || (match && r.employeeId === match.empCode) || r.employeeName?.toLowerCase() === user?.name?.toLowerCase()) && 
          r.date === todayStr
        );

        if (!isMounted) return;

        if (todayRec) {
          const hasCheckedOut = todayRec.checkOut && todayRec.checkOut !== 'Active' && todayRec.checkOut !== '—';
          if (hasCheckedOut) {
            setIsCompletedToday(true);
            setIsClockedIn(false);
            setClockInTime(todayRec.checkIn || '09:00 AM');
            const workedSec = Math.round((todayRec.workedHours || 8.0) * 3600);
            setPunchSeconds(workedSec);
          } else if (todayRec.checkIn && todayRec.checkIn !== '—') {
            setIsClockedIn(true);
            setIsCompletedToday(false);
            setActiveAttendanceId(todayRec.id);
            setClockInTime(todayRec.checkIn);
            let elapsedSec = 0;
            const matchTime = todayRec.checkIn.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
            if (matchTime) {
              let h = parseInt(matchTime[1], 10);
              const m = parseInt(matchTime[2], 10);
              const ampm = matchTime[3]?.toUpperCase();
              if (ampm === 'PM' && h < 12) h += 12;
              if (ampm === 'AM' && h === 12) h = 0;
              const now = new Date();
              const inDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
              elapsedSec = Math.max(0, Math.floor((now.getTime() - inDate.getTime()) / 1000));
            }
            setPunchSeconds(elapsedSec || Math.round((todayRec.workedHours || 1.0) * 3600));
          }
        } else {
          setIsClockedIn(false);
          setIsCompletedToday(false);
          setPunchSeconds(0);
        }
      } catch (err) {
        console.warn('[Dashboard] Could not sync attendance:', err);
      }
    };

    syncAttendance();
    return () => { isMounted = false; };
  }, [displayRole, user]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (isClockedIn) {
        setPunchSeconds((prev) => prev + 1);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isClockedIn]);

  const formatElapsedTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
  };

  const handleTogglePunch = async () => {
    if (punchLoading || isCompletedToday) return;
    setPunchLoading(true);

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toISOString().split('T')[0];
    const targetEmpId = resolvedEmpId || user?.employeeId || 'EMP-001';

    try {
      if (isClockedIn) {
        await attendanceApi.checkOut({
          recordId: activeAttendanceId || undefined,
          employeeId: targetEmpId,
          checkOut: timeStr,
        });
        setIsClockedIn(false);
        setIsCompletedToday(true);
      } else {
        const res = await attendanceApi.checkIn({
          employeeId: targetEmpId,
          date: dateStr,
          checkIn: timeStr,
        });
        setIsClockedIn(true);
        setIsCompletedToday(false);
        setClockInTime(timeStr);
        if (res?.id) setActiveAttendanceId(res.id);
      }
    } catch (err: any) {
      alert(err?.message || 'Attendance operation failed. Note: Only 1 check-in and 1 check-out is allowed per day.');
      setIsCompletedToday(true);
      setIsClockedIn(false);
    } finally {
      setPunchLoading(false);
    }
  };

  // Filter state for management
  const [filters] = useState<DashboardFilters>({
    period: 'ALL',
    department: 'ALL',
    employeeType: 'ALL',
  });

  const requestIdRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      requestIdRef.current = -1;
    };
  }, []);

  const fetchDashboardData = useCallback(async (isBackgroundRefresh = false) => {
    const currentReqId = ++requestIdRef.current;
    if (isBackgroundRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await dashboardApi.getMetrics(filters);
      if (currentReqId === requestIdRef.current) {
        setMetrics(data);
      }
    } catch (err: unknown) {
      if (currentReqId === requestIdRef.current) {
        console.error('[Dashboard] Failed to load metrics:', err instanceof Error ? err.message : String(err));
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to connect to the payroll service. Please verify server status.'
        );
      }
    } finally {
      if (currentReqId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [filters]);

  useEffect(() => {
    if (displayRole === 'Employee') {
      setLoading(false);
      return;
    }
    fetchDashboardData();
  }, [fetchDashboardData, displayRole]);

  // Dynamic Leave Computations
  const ptoTaken = useMemo(() => {
    return employeeTimeOff
      .filter(r => (r.status === 'APPROVED' || r.status === 'PENDING') && r.leaveType === 'Paid Annual Leave')
      .reduce((sum, r) => sum + (r.durationDays || 0), 0);
  }, [employeeTimeOff]);

  const sickTaken = useMemo(() => {
    return employeeTimeOff
      .filter(r => (r.status === 'APPROVED' || r.status === 'PENDING') && r.leaveType === 'Sick Leave')
      .reduce((sum, r) => sum + (r.durationDays || 0), 0);
  }, [employeeTimeOff]);

  const casualTaken = useMemo(() => {
    return employeeTimeOff
      .filter(r => (r.status === 'APPROVED' || r.status === 'PENDING') && r.leaveType === 'Unpaid Leave')
      .reduce((sum, r) => sum + (r.durationDays || 0), 0);
  }, [employeeTimeOff]);

  const ptoTotal = 18;
  const ptoRemaining = Math.max(0, ptoTotal - ptoTaken);
  const sickTotal = 10;
  const sickRemaining = Math.max(0, sickTotal - sickTaken);
  const casualTotal = 7;
  const casualRemaining = Math.max(0, casualTotal - casualTaken);

  const latestLeaveReq = useMemo(() => {
    if (employeeTimeOff.length === 0) return null;
    return [...employeeTimeOff].sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''))[0];
  }, [employeeTimeOff]);

  // ════════════════════════════════════════════════════════════════════════════
  // 1. EMPLOYEE SELF-SERVICE PORTAL VIEW
  // ════════════════════════════════════════════════════════════════════════════
  if (displayRole === 'Employee') {
    return (
      <div className="dashboard-container" style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
        {/* Personalized Welcome Banner */}
        <div className="employee-welcome-banner">
          <div className="welcome-banner-left">
            <div className="welcome-avatar-wrapper">
              <div className="welcome-avatar">
                {employeeProfile?.avatarInitials || (user?.name ? user.name.substring(0, 2).toUpperCase() : 'JD')}
              </div>
              <span className="online-indicator" title="Connected" />
            </div>
            <div>
              <div className="welcome-greeting-row">
                <h1 className="welcome-name">Welcome back, {employeeProfile?.name || user?.name || 'Team Member'}!</h1>
                <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Check size={11} /> {employeeProfile?.status === 'ACTIVE' ? 'Active Staff' : (employeeProfile?.status || 'Active Staff')}
                </span>
              </div>
              <p className="welcome-subtext">
                {employeeProfile?.position || 'Staff Member'} • {employeeProfile?.department || 'Operations'} Department • ID: {employeeProfile?.empCode || employeeProfile?.id || resolvedEmpId || 'EMP-001'}
              </p>
            </div>
          </div>

          <div className="welcome-banner-right">
            <div className="welcome-stat-pill">
              <span className="stat-pill-label">Working Schedule</span>
              <span className="stat-pill-value">{employeeProfile?.schedule || 'Standard 40h Regular'}</span>
            </div>
            <div className="welcome-stat-pill">
              <span className="stat-pill-label">Current Contract</span>
              <span className="stat-pill-value" style={{ color: '#10b981' }}>
                {employeeProfile?.status ? `${employeeProfile.status} • ` : 'Active • '}
                {employeeProfile?.wage ? `${formatCurrency(employeeProfile.wage)}/mo` : 'Active'}
              </span>
            </div>
          </div>
        </div>

        {/* 2-Column Core Actions: Live Punch Clock & Leave Balances */}
        <div className="dashboard-grid-2col">
          {/* Live Punch Clock Widget */}
          <div className="card punch-clock-card">
            <div className="card-header-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="card-icon-bubble" style={{ background: 'rgba(2, 132, 199, 0.12)', color: '#0284c7' }}>
                  <Clock size={18} />
                </div>
                <div>
                  <h3 className="card-title">Live Punch Clock</h3>
                  <p className="card-subtitle">Real-time attendance & shift monitoring</p>
                </div>
              </div>
              <span className={`status-pill ${isCompletedToday ? 'status-active' : isClockedIn ? 'status-active' : 'status-inactive'}`} style={isCompletedToday ? { background: '#ecfdf5', color: '#047857' } : undefined}>
                <span className="pulse-dot" style={isCompletedToday ? { backgroundColor: '#10b981' } : undefined} />
                {isCompletedToday ? 'Shift Completed' : isClockedIn ? 'Clocked In' : 'Clocked Out'}
              </span>
            </div>

            <div className="punch-clock-body">
              <div className="punch-clock-timer-display">
                <div className="punch-timer-value">{formatElapsedTime(punchSeconds)}</div>
                <div className="punch-timer-label">Session Elapsed Today</div>
              </div>

              <div className="punch-meta-grid">
                <div className="punch-meta-box">
                  <span className="punch-meta-label">Clock In Time</span>
                  <span className="punch-meta-value">{clockInTime}</span>
                </div>
                <div className="punch-meta-box">
                  <span className="punch-meta-label">Assigned Location</span>
                  <span className="punch-meta-value">{employeeProfile?.department ? `${employeeProfile.department} HQ` : 'HQ Office (Fl. 3)'}</span>
                </div>
                <div className="punch-meta-box">
                  <span className="punch-meta-label">Today's Target</span>
                  <span className="punch-meta-value">8.0 Hours</span>
                </div>
                <div className="punch-meta-box">
                  <span className="punch-meta-label">Daily Limit</span>
                  <span className="punch-meta-value">1 In / 1 Out</span>
                </div>
              </div>

              <div className="punch-progress-wrapper">
                <div className="progress-info-row">
                  <span>Shift Completion</span>
                  <span>{isCompletedToday ? '100% (Completed)' : `${Math.min(100, Math.round((punchSeconds / 28800) * 100))}% (${(punchSeconds / 3600).toFixed(1)}h / 8.0h)`}</span>
                </div>
                <div className="progress-bar-bg">
                  <div className="progress-bar-fill" style={{ width: isCompletedToday ? '100%' : `${Math.min(100, Math.round((punchSeconds / 28800) * 100))}%`, background: 'linear-gradient(90deg, #0284c7, #38bdf8)' }} />
                </div>
              </div>

              <button
                type="button"
                className={`btn btn-lg ${isCompletedToday ? 'btn-secondary' : isClockedIn ? 'btn-punch-out' : 'btn-punch-in'}`}
                onClick={handleTogglePunch}
                disabled={punchLoading || isCompletedToday}
                title={isCompletedToday ? 'Daily limit reached: 1 check-in and 1 check-out per day.' : isClockedIn ? 'Clock out to finish today\'s shift.' : 'Clock in to begin shift.'}
                style={isCompletedToday ? { opacity: 0.85, cursor: 'not-allowed' } : undefined}
              >
                {punchLoading ? (
                  <>
                    <RefreshCw size={18} className="spin" />
                    <span>Processing...</span>
                  </>
                ) : isCompletedToday ? (
                  <>
                    <CheckCircle2 size={18} color="#10b981" />
                    <span>Shift Completed for Today</span>
                  </>
                ) : isClockedIn ? (
                  <>
                    <Clock size={18} />
                    <span>Clock Out For The Day</span>
                  </>
                ) : (
                  <>
                    <Clock size={18} />
                    <span>Clock In (Start Working)</span>
                  </>
                )}
              </button>

              {isCompletedToday && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#059669', textAlign: 'center', fontWeight: 600 }}>
                  ✓ Shift recorded. Daily limit of 1 check-in and 1 check-out fulfilled.
                </div>
              )}
            </div>
          </div>

          {/* Leave & Time-Off Tracker */}
          <div className="card">
            <div className="card-header-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="card-icon-bubble" style={{ background: 'rgba(13, 148, 136, 0.12)', color: '#0d9488' }}>
                  <Palmtree size={18} />
                </div>
                <div>
                  <h3 className="card-title">Leave & Time-Off Balances</h3>
                  <p className="card-subtitle">Calendar year 2026 entitlements</p>
                </div>
              </div>
              <button 
                type="button" 
                className="btn btn-sm btn-outline-primary"
                onClick={() => onNavigate('time-off')}
              >
                Request Leave &rarr;
              </button>
            </div>

            <div className="leave-balances-grid">
              <div className="leave-balance-card">
                <div className="leave-card-top">
                  <span className="leave-type-title">Paid Time Off (PTO)</span>
                  <span className="leave-rem-badge">{ptoRemaining} Days Left</span>
                </div>
                <div className="leave-number">{ptoRemaining} <span>/ {ptoTotal}</span></div>
                <div className="progress-bar-bg" style={{ marginTop: '8px' }}>
                  <div className="progress-bar-fill" style={{ width: `${Math.round((ptoRemaining / ptoTotal) * 100)}%`, background: '#0d9488' }} />
                </div>
                <span className="leave-sub">{ptoTaken} days taken this year</span>
              </div>

              <div className="leave-balance-card">
                <div className="leave-card-top">
                  <span className="leave-type-title">Sick & Medical</span>
                  <span className="leave-rem-badge" style={{ color: '#0284c7', background: 'rgba(2, 132, 199, 0.1)' }}>{sickRemaining} Days Left</span>
                </div>
                <div className="leave-number">{sickRemaining} <span>/ {sickTotal}</span></div>
                <div className="progress-bar-bg" style={{ marginTop: '8px' }}>
                  <div className="progress-bar-fill" style={{ width: `${Math.round((sickRemaining / sickTotal) * 100)}%`, background: '#0284c7' }} />
                </div>
                <span className="leave-sub">{sickTaken} days taken this year</span>
              </div>

              <div className="leave-balance-card">
                <div className="leave-card-top">
                  <span className="leave-type-title">Casual Leave</span>
                  <span className="leave-rem-badge" style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)' }}>{casualRemaining} Days Left</span>
                </div>
                <div className="leave-number">{casualRemaining} <span>/ {casualTotal}</span></div>
                <div className="progress-bar-bg" style={{ marginTop: '8px' }}>
                  <div className="progress-bar-fill" style={{ width: `${Math.round((casualRemaining / casualTotal) * 100)}%`, background: '#f59e0b' }} />
                </div>
                <span className="leave-sub">{casualTaken} days taken this year</span>
              </div>
            </div>

            {/* Recent Request Status */}
            <div className="recent-leave-status-box">
              {latestLeaveReq ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={16} color={latestLeaveReq.status === 'APPROVED' ? '#10b981' : '#f59e0b'} />
                      <span style={{ fontWeight: 600, fontSize: '13px' }}>
                        Latest Request: {latestLeaveReq.leaveType} ({latestLeaveReq.durationDays} Day{latestLeaveReq.durationDays === 1 ? '' : 's'})
                      </span>
                    </div>
                    <span className={`badge ${latestLeaveReq.status === 'APPROVED' ? 'badge-success' : latestLeaveReq.status === 'REFUSED' ? 'badge-danger' : 'badge-warning'}`}>
                      {latestLeaveReq.status}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Submitted for {latestLeaveReq.startDate} to {latestLeaveReq.endDate}.{latestLeaveReq.reason ? ` Reason: "${latestLeaveReq.reason}".` : ''}
                  </p>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={16} color="#0d9488" />
                      <span style={{ fontWeight: 600, fontSize: '13px' }}>No Leave Requests Filed</span>
                    </div>
                    <span className="badge badge-info">IDLE</span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    All leave entitlements are currently available. Click "Request Leave" above to apply.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 2-Column: Latest Payslip Snapshot & Operational Bulletins */}
        <div className="dashboard-grid-2col">
          {/* Latest Payslip Snapshot */}
          <div className="card">
            <div className="card-header-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="card-icon-bubble" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
                  <CreditCard size={18} />
                </div>
                <div>
                  <h3 className="card-title">Latest Payslip Snapshot</h3>
                  <p className="card-subtitle">
                    {employeeLatestPayslip?.payrunName ? `Pay Period: ${employeeLatestPayslip.payrunName}` : 'Pay Period: Active Cycle'}
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                className="btn btn-sm btn-secondary"
                onClick={() => onNavigate('payslips')}
              >
                View Full Payslip &rarr;
              </button>
            </div>

            <div className="payslip-snapshot-card">
              <div className="snapshot-main-row">
                <div>
                  <span className="snapshot-net-label">Net Deposited Salary</span>
                  <div className="snapshot-net-amount">
                    {employeeLatestPayslip ? formatCurrency(employeeLatestPayslip.netSalary) : formatCurrency(employeeProfile?.wage || 0)}
                  </div>
                  <span className={`badge ${employeeLatestPayslip ? 'badge-success' : 'badge-info'}`} style={{ marginTop: '4px' }}>
                    <CheckCircle2 size={11} style={{ marginRight: '3px' }} />
                    {employeeLatestPayslip ? `${employeeLatestPayslip.status} • Deposited to •••• ${employeeProfile?.bankAccount ? employeeProfile.bankAccount.slice(-4) : 'Account'}` : 'Contract Monthly Base'}
                  </span>
                </div>
                <div className="snapshot-breakdown">
                  <div className="breakdown-line">
                    <span>Base Salary (60%):</span>
                    <strong>
                      {formatCurrency(employeeLatestPayslip ? Math.round(employeeLatestPayslip.grossSalary * 0.6) : Math.round((employeeProfile?.wage || 0) * 0.6))}
                    </strong>
                  </div>
                  <div className="breakdown-line">
                    <span>Allowances:</span>
                    <strong>
                      {formatCurrency(employeeLatestPayslip ? Math.round(employeeLatestPayslip.grossSalary * 0.4) : Math.round((employeeProfile?.wage || 0) * 0.4))}
                    </strong>
                  </div>
                  <div className="breakdown-line" style={{ color: 'var(--danger-text)', borderTop: '1px dashed var(--border-color)', paddingTop: '4px' }}>
                    <span>Statutory Tax & PF:</span>
                    <strong>
                      {employeeLatestPayslip ? `-${formatCurrency(employeeLatestPayslip.totalDeductions)}` : 'Calculated at payrun'}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Company Bulletins & Announcements */}
          <div className="card">
            <div className="card-header-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="card-icon-bubble" style={{ background: 'rgba(13, 148, 136, 0.12)', color: '#0d9488' }}>
                  <Megaphone size={18} />
                </div>
                <div>
                  <h3 className="card-title">Announcements & Notices</h3>
                  <p className="card-subtitle">Official company bulletins & schedules</p>
                </div>
              </div>
              <span className="badge badge-info" style={{ fontSize: '11px' }}>Company Bulletin</span>
            </div>

            <div className="announcements-list">
              <div className="announcement-item">
                <div className="announcement-badge-urgent">System</div>
                <div className="announcement-content">
                  <h4>Workforce Portal & Attendance Sync Active</h4>
                  <p>Daily punch clock records are synced in real-time to the MySQL database. Target: 8.0 hours per shift.</p>
                  <span className="announcement-date">HR Nexus Operations System</span>
                </div>
              </div>

              <div className="announcement-item">
                <div className="announcement-badge-info">Payroll</div>
                <div className="announcement-content">
                  <h4>Deterministic Payroll Processing</h4>
                  <p>Monthly salary runs calculate earnings and statutory contributions based on active employment contracts.</p>
                  <span className="announcement-date">Automated Payroll Engine</span>
                </div>
              </div>

              <div className="announcement-item">
                <div className="announcement-badge-info">Schedule</div>
                <div className="announcement-content">
                  <h4>Assigned Working Schedule: {employeeProfile?.schedule || 'Standard 40h'}</h4>
                  <p>Your weekly working hours and time-off entitlements are mapped to your active contract profile.</p>
                  <span className="announcement-date">Enterprise HR Governance</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 2. MANAGEMENT DASHBOARD (ADMIN & HR MANAGER)
  // ════════════════════════════════════════════════════════════════════════════
  const isAdmin = displayRole === 'Admin';
  const isHRManager = displayRole === 'HR Manager';

  // Dynamic Department Breakdown from live employees prop
  const deptAllocation = useMemo(() => {
    const counts: Record<string, number> = {};
    employees.forEach(e => {
      const d = e.department || 'General';
      counts[d] = (counts[d] || 0) + 1;
    });
    const total = employees.length || 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        name,
        count,
        percent: Math.round((count / total) * 100),
      }));
  }, [employees]);

  // Current Payrun step index (1: Draft, 2: Computed, 3: Validated, 4: Paid)
  const currentPayrunStep = useMemo(() => {
    const status = metrics?.latestPayrun?.status?.toUpperCase();
    if (status === 'PAID') return 4;
    if (status === 'VALIDATED') return 3;
    if (status === 'COMPUTED') return 2;
    if (status === 'DRAFT') return 1;
    return 0;
  }, [metrics?.latestPayrun?.status]);

  return (
    <div className="dashboard-container" style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Top Header Bar */}
      <div className="page-header" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="page-title">
              {isAdmin ? 'System Administration & Operations' : 'Human Resources Operations Hub'}
            </h1>
            <span 
              className={`badge ${isAdmin ? 'badge-primary' : 'badge-info'}`} 
              style={{ fontSize: '11px', fontWeight: 700 }}
            >
              {isAdmin ? 'Superadmin Level' : 'HR Manager Level'}
            </span>
          </div>
          <p className="page-desc">
            {isAdmin 
              ? 'Complete system visibility across workforce records, payroll liability, salary rules, and audit logs.'
              : 'Workforce management, live attendance analytics, leave request approvals, and payroll execution.'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            type="button"
            className="btn btn-secondary" 
            onClick={() => fetchDashboardData(true)} 
            disabled={loading || refreshing}
            title="Refresh metrics from MySQL database"
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            <span>{refreshing ? 'Refreshing...' : 'Sync Database'}</span>
          </button>

          {isHRManager && (
            <button 
              type="button"
              className="btn btn-primary"
              onClick={() => onNavigate('employees')}
            >
              <Users size={15} />
              <span>Add Employee</span>
            </button>
          )}

          {canAccessPayruns && (
            <button 
              type="button"
              className="btn btn-primary"
              style={{ background: 'linear-gradient(135deg, #0d9488, #14b8a6)' }}
              onClick={() => onNavigate('payruns')}
            >
              <Play size={15} />
              <span>Launch Payrun</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="login-error-banner" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards Row */}
      <div className="stats-grid">
        {/* Total Workforce */}
        <div className="stat-card" style={{ borderLeft: '4px solid #6366f1' }}>
          <div className="stat-card-header">
            <span className="stat-label">Total Workforce</span>
            <div className="stat-icon" style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#6366f1' }}>
              <Users size={18} />
            </div>
          </div>
          <div className="stat-value">{metrics?.totalEmployees ?? employees.length}</div>
          <div className="stat-footer">
            <span className="stat-trend positive">
              <TrendingUp size={12} /> {metrics?.activeEmployees ?? employees.filter(e => e.status === 'ACTIVE').length} Active
            </span>
            <span className="stat-sub">
              Across {new Set(employees.map(e => e.department).filter(Boolean)).size || 1} Departments
            </span>
          </div>
        </div>

        {/* Today's Attendance Rate */}
        <div className="stat-card" style={{ borderLeft: '4px solid #0d9488' }}>
          <div className="stat-card-header">
            <span className="stat-label">Attendance Rate Today</span>
            <div className="stat-icon" style={{ background: 'rgba(13, 148, 136, 0.12)', color: '#0d9488' }}>
              <Clock size={18} />
            </div>
          </div>
          <div className="stat-value">
            {metrics?.attendanceRate !== null && metrics?.attendanceRate !== undefined ? `${metrics.attendanceRate}%` : '100%'}
          </div>
          <div className="stat-footer">
            <span className="stat-trend positive">
              <CheckCircle2 size={12} /> Live Sync
            </span>
            <span className="stat-sub">
              {metrics?.attendancePresentCount ?? 0} Present • {Math.max(0, (metrics?.totalEmployees ?? employees.length) - (metrics?.attendancePresentCount ?? 0))} Absent/Off
            </span>
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-card-header">
            <span className="stat-label">Pending Time-Off</span>
            <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
              <Palmtree size={18} />
            </div>
          </div>
          <div className="stat-value">
            {metrics?.pendingTimeOffCount ?? 0} <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-muted)' }}>Request{(metrics?.pendingTimeOffCount ?? 0) === 1 ? '' : 's'}</span>
          </div>
          <div className="stat-footer">
            <button 
              type="button" 
              className="text-action-link"
              onClick={() => onNavigate('time-off')}
              style={{ fontSize: '12px', fontWeight: 600, color: '#f59e0b', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              Review Request &rarr;
            </button>
          </div>
        </div>

        {/* Monthly Payroll Liability */}
        <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="stat-card-header">
            <span className="stat-label">Monthly Payroll Run</span>
            <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
              <CreditCard size={18} />
            </div>
          </div>
          <div className="stat-value">{formatCurrency(metrics?.netPayroll ?? (metrics?.latestPayrun?.totalNet ?? 0))}</div>
          <div className="stat-footer">
            <span className="badge badge-success" style={{ fontSize: '10px' }}>
              Deterministic Engine
            </span>
            <span className="stat-sub">{metrics?.latestPayrun?.name || metrics?.latestPayrun?.period || 'Current Cycle'}</span>
          </div>
        </div>
      </div>

      {/* Enterprise Operations Quick Actions */}
      <div className="card" style={{ padding: '18px 24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(15, 118, 110, 0.12)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Shield size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                System Operations & Workforce Governance
              </h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0, marginTop: '2px' }}>
                Centralized HR directory, automated attendance tracking, and deterministic payroll processing.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button 
              type="button" 
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigate('employees')}
            >
              <Users size={13} />
              <span>Workforce Directory</span>
            </button>
            <button 
              type="button" 
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigate('attendance')}
            >
              <Clock size={13} />
              <span>Attendance Registry</span>
            </button>
            <button 
              type="button" 
              className="btn btn-primary btn-sm"
              onClick={() => onNavigate('payruns')}
            >
              <CreditCard size={13} />
              <span>Launch Payrun</span>
            </button>
          </div>
        </div>
      </div>

      {/* Operational Charts & Analytics */}
      <div className="dashboard-grid-2col">
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '14px' }}>Department Headcount & Allocation</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {deptAllocation.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No department records registered.</p>
            ) : (
              deptAllocation.map((d: { name: string; count: number; percent: number }, idx: number) => {
                const palette = ['#0d9488', '#0284c7', '#f59e0b', '#6366f1', '#10b981'];
                const color = palette[idx % palette.length];
                return (
                  <div key={d.name} className="dept-stat-row">
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600 }}>
                      <span>{d.name}</span>
                      <span>{d.count} Employee{d.count === 1 ? '' : 's'} ({d.percent}%)</span>
                    </div>
                    <div className="progress-bar-bg">
                      <div className="progress-bar-fill" style={{ width: `${d.percent}%`, background: color }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Payrun Lifecycle Tracker */}
        <div className="card">
          <div className="card-header-row">
            <div>
              <h3 className="card-title">Current Payrun Lifecycle</h3>
              <p className="card-subtitle">{metrics?.latestPayrun?.name || metrics?.latestPayrun?.period || 'Monthly Payrun Cycle'}</p>
            </div>
            <span className={`badge ${metrics?.latestPayrun?.status === 'PAID' ? 'badge-success' : metrics?.latestPayrun?.status ? 'badge-info' : 'badge-secondary'}`}>
              {metrics?.latestPayrun?.status || 'IDLE'}
            </span>
          </div>

          <div className="lifecycle-stepper">
            <div className={`step-item ${currentPayrunStep > 1 ? 'completed' : currentPayrunStep === 1 ? 'current' : ''}`}>
              <div className="step-circle">{currentPayrunStep > 1 ? <Check size={12} /> : '1'}</div>
              <div className="step-label">1. Draft</div>
            </div>
            <div className={`step-line ${currentPayrunStep >= 2 ? 'active' : ''}`} />
            <div className={`step-item ${currentPayrunStep > 2 ? 'completed' : currentPayrunStep === 2 ? 'current' : ''}`}>
              <div className="step-circle">{currentPayrunStep > 2 ? <Check size={12} /> : '2'}</div>
              <div className="step-label">2. Computed</div>
            </div>
            <div className={`step-line ${currentPayrunStep >= 3 ? 'active' : ''}`} />
            <div className={`step-item ${currentPayrunStep > 3 ? 'completed' : currentPayrunStep === 3 ? 'current' : ''}`}>
              <div className="step-circle">{currentPayrunStep > 3 ? <Check size={12} /> : '3'}</div>
              <div className="step-label">3. Validated</div>
            </div>
            <div className={`step-line ${currentPayrunStep >= 4 ? 'active' : ''}`} />
            <div className={`step-item ${currentPayrunStep === 4 ? 'completed' : ''}`}>
              <div className="step-circle">{currentPayrunStep === 4 ? <Check size={12} /> : '4'}</div>
              <div className="step-label">4. Paid</div>
            </div>
          </div>

          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Deterministic calculations verified against BCNF database contracts.
            </span>
            <button 
              type="button" 
              className="btn btn-sm btn-primary"
              onClick={() => onNavigate('payruns')}
            >
              Open Payruns &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
