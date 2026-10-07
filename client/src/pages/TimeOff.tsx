import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Check, 
  X, 
  Plus, 
  RefreshCw, 
  Search, 
  Filter, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown 
} from 'lucide-react';
import type { TimeOffRequest } from '../types';
import { timeOffApi } from '../api/timeOff';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface TimeOffProps {
  requests?: TimeOffRequest[];
  onApprove?: (id: string) => void;
  onRefuse?: (id: string) => void;
}

type SortField = 'employeeName' | 'leaveType' | 'startDate' | 'durationDays' | 'status';
type SortDirection = 'asc' | 'desc';

export const TimeOff: React.FC<TimeOffProps> = ({ onApprove, onRefuse }) => {
  const { user, displayRole } = useAuth();
  const canApprove = displayRole === 'Admin' || displayRole === 'HR Manager';
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [newModalOpen, setNewModalOpen] = useState<boolean>(false);

  // Filters & Sorting
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<SortField>('startDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Modal Form State (Dynamic today default)
  const todayDateStr = new Date().toISOString().split('T')[0];
  const [leaveType, setLeaveType] = useState<string>('Paid Annual Leave');
  const [startDate, setStartDate] = useState<string>(todayDateStr);
  const [endDate, setEndDate] = useState<string>(todayDateStr);
  const [reason, setReason] = useState<string>('');
  const [modalSubmitting, setModalSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await timeOffApi.getAll();
      setRequests(data);
    } catch (err) {
      console.error('[TimeOff Page] Failed to fetch requests:', err instanceof Error ? err.message : String(err));
      setError(err instanceof ApiError ? err.message : 'Unable to load time-off requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleAction = async (id: string, newStatus: 'APPROVED' | 'REFUSED') => {
    if (actionLoadingId) return;
    setActionLoadingId(id);
    setError(null);
    try {
      if (newStatus === 'APPROVED') {
        const updated = await timeOffApi.approve(id);
        setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
        onApprove?.(id);
      } else {
        const updated = await timeOffApi.refuse(id);
        setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
        onRefuse?.(id);
      }
    } catch (err) {
      console.error(`[TimeOff Action] Failed to ${newStatus.toLowerCase()} request:`, err instanceof Error ? err.message : String(err));
      setError(err instanceof ApiError ? err.message : `Failed to ${newStatus.toLowerCase()} request.`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCreateRequest = async () => {
    if (modalSubmitting) return;

    if (!startDate || !endDate) {
      setModalError('Please select both start and end dates.');
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      setModalError('End date cannot be before start date.');
      return;
    }

    const empId = user?.employeeId || (user?.id?.startsWith('EMP-') ? user.id : 'EMP-004');

    setModalSubmitting(true);
    setModalError(null);
    try {
      await timeOffApi.create({
        employeeId: empId,
        leaveType,
        startDate,
        endDate,
        reason: reason.trim() || undefined,
      });
      await loadRequests();
      setNewModalOpen(false);
      setReason('');
    } catch (err) {
      console.error('[TimeOff Modal] Failed to submit request:', err instanceof Error ? err.message : String(err));
      setModalError(err instanceof ApiError ? err.message : 'Failed to submit time-off request.');
    } finally {
      setModalSubmitting(false);
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

  // Distinct leave types
  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    requests.forEach((r) => {
      if (r.leaveType) types.add(r.leaveType);
    });
    return Array.from(types).sort();
  }, [requests]);

  // Filtered and sorted requests
  const filteredAndSortedRequests = useMemo(() => {
    return requests
      .filter((req) => {
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          const nameMatch = (req.employeeName || '').toLowerCase().includes(term);
          const reasonMatch = (req.reason || '').toLowerCase().includes(term);
          const typeMatch = (req.leaveType || '').toLowerCase().includes(term);
          if (!nameMatch && !reasonMatch && !typeMatch) return false;
        }

        if (statusFilter !== 'ALL' && req.status !== statusFilter) {
          return false;
        }

        if (typeFilter !== 'ALL' && req.leaveType !== typeFilter) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        let valA: string | number = '';
        let valB: string | number = '';

        switch (sortField) {
          case 'employeeName':
            valA = (a.employeeName || a.employeeId || '').toLowerCase();
            valB = (b.employeeName || b.employeeId || '').toLowerCase();
            break;
          case 'leaveType':
            valA = (a.leaveType || '').toLowerCase();
            valB = (b.leaveType || '').toLowerCase();
            break;
          case 'startDate':
            valA = a.startDate || '';
            valB = b.startDate || '';
            break;
          case 'durationDays':
            valA = a.durationDays || 0;
            valB = b.durationDays || 0;
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
  }, [requests, searchTerm, statusFilter, typeFilter, sortField, sortDirection]);

  // Dynamic summary stats
  const takenDays = requests
    .filter((r) => r.status === 'APPROVED')
    .reduce((acc, r) => acc + (r.durationDays || 0), 0);
  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;
  const teamMemberCount = new Set(
    requests.filter((r) => r.status === 'APPROVED').map((r) => r.employeeId)
  ).size;

  const isFilterActive = searchTerm !== '' || statusFilter !== 'ALL' || typeFilter !== 'ALL';

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setTypeFilter('ALL');
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Time Off & Leave Operations</h1>
          <p className="page-desc">Manage employee leave requests, approve entitlements, and automatically deduct unpaid days from payroll.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={loadRequests}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Refresh requests from database"
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
          <button className="btn btn-primary" onClick={() => setNewModalOpen(true)}>
            <Plus size={14} /> Request Leave
          </button>
        </div>
      </div>

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

      {/* Allocation Cards */}
      <div className="grid-4-stat" style={{ marginBottom: '20px' }}>
        <div className="card">
          <div className="metric-title">Annual Leave Quota</div>
          <div className="metric-val">20 Days</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Standard company allocation</div>
        </div>
        <div className="card">
          <div className="metric-title">Taken This Cycle</div>
          <div className="metric-val">{takenDays} Days</div>
          <div style={{ fontSize: '12px', color: 'var(--success)', marginTop: '4px' }}>
            Across {teamMemberCount} team member{teamMemberCount === 1 ? '' : 's'}
          </div>
        </div>
        <div className="card">
          <div className="metric-title">Pending Approvals</div>
          <div className="metric-val" style={{ color: 'var(--warning)' }}>
            {pendingCount} Request{pendingCount === 1 ? '' : 's'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Requires manager signoff</div>
        </div>
        <div className="card">
          <div className="metric-title">Payroll Sync Status</div>
          <div className="metric-val" style={{ color: 'var(--success)' }}>Active</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Unpaid days synced to Payrun</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Search Box */}
          <div className="search-box" style={{ width: '240px' }}>
            <Search size={15} color="var(--slate-400)" />
            <input 
              type="text"
              placeholder="Search employee, reason…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={14} color="var(--slate-400)" />
            <select
              aria-label="Filter leave requests by status"
              className="form-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '13px', minWidth: '125px', height: 'auto', fontWeight: 500 }}
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">PENDING</option>
              <option value="APPROVED">APPROVED</option>
              <option value="REFUSED">REFUSED</option>
            </select>
          </div>

          {/* Leave Type Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <select
              aria-label="Filter leave requests by leave type"
              className="form-input"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '13px', minWidth: '140px', height: 'auto', fontWeight: 500 }}
            >
              <option value="ALL">All Leave Types</option>
              {availableTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
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
          Showing <strong>{filteredAndSortedRequests.length}</strong> {filteredAndSortedRequests.length === 1 ? 'request' : 'requests'}
        </div>
      </div>

      {/* Requests Table */}
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
              <th onClick={() => handleSort('leaveType')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Leave Type</span>
                  {getSortIcon('leaveType')}
                </div>
              </th>
              <th onClick={() => handleSort('startDate')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Date Span</span>
                  {getSortIcon('startDate')}
                </div>
              </th>
              <th onClick={() => handleSort('durationDays')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Duration</span>
                  {getSortIcon('durationDays')}
                </div>
              </th>
              <th>Reason Note</th>
              <th onClick={() => handleSort('status')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Status</span>
                  {getSortIcon('status')}
                </div>
              </th>
              <th>Decision Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--slate-400)' }}>
                  Loading time-off requests from database...
                </td>
              </tr>
            ) : filteredAndSortedRequests.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--slate-400)' }}>
                  {isFilterActive 
                    ? 'No time-off requests match your filter criteria.' 
                    : 'No time-off requests recorded. Click "Request Leave" to submit a request.'}
                </td>
              </tr>
            ) : (
              filteredAndSortedRequests.map((req) => (
                <tr key={req.id}>
                  <td style={{ fontWeight: 600 }}>{req.employeeName}</td>
                  <td>
                    <span style={{ fontWeight: 500 }}>{req.leaveType}</span>
                  </td>
                  <td style={{ color: 'var(--slate-500)' }}>
                    {req.startDate} to {req.endDate}
                  </td>
                  <td style={{ fontWeight: 600 }}>{req.durationDays} day(s)</td>
                  <td style={{ color: 'var(--slate-600)' }}>{req.reason || '—'}</td>
                  <td>
                    <span
                      className={`badge ${
                        req.status === 'APPROVED'
                          ? 'badge-success'
                          : req.status === 'REFUSED'
                          ? 'badge-danger'
                          : 'badge-warning'
                      }`}
                    >
                      <span className="badge-dot" />
                      {req.status}
                    </span>
                  </td>
                  <td>
                    {req.status === 'PENDING' ? (
                      canApprove ? (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ backgroundColor: '#059669' }}
                            disabled={actionLoadingId === req.id}
                            onClick={() => handleAction(req.id, 'APPROVED')}
                          >
                            <Check size={12} /> {actionLoadingId === req.id ? '...' : 'Approve'}
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ color: '#be123c' }}
                            disabled={actionLoadingId === req.id}
                            onClick={() => handleAction(req.id, 'REFUSED')}
                          >
                            <X size={12} /> {actionLoadingId === req.id ? '...' : 'Refuse'}
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--slate-400)', fontStyle: 'italic' }}>
                          Pending Approval
                        </span>
                      )
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--slate-400)' }}>
                        {req.status === 'APPROVED' ? 'Approved' : 'Declined'}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* NEW REQUEST MODAL */}
      {newModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Submit Time Off Request</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setNewModalOpen(false)}>
                <X size={14} />
              </button>
            </div>

            {modalError && (
              <div style={{ marginBottom: '14px', padding: '8px 12px', background: '#fee2e2', border: '1px solid #f87171', borderRadius: '6px', fontSize: '12.5px', color: '#991b1b' }}>
                ⚠️ {modalError}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Leave Type</label>
              <select
                aria-label="Leave Type"
                className="form-input"
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
              >
                <option value="Paid Annual Leave">Paid Annual Leave</option>
                <option value="Sick Leave">Sick Leave</option>
                <option value="Unpaid Leave">Unpaid Leave (Affects Payroll)</option>
                <option value="Compassionate Leave">Compassionate Leave</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">End Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Employee Note / Justification</label>
              <textarea
                className="form-input"
                rows={3}
                placeholder="Brief reason for your manager's review..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Assigned Profile</label>
              <input
                type="text"
                className="form-input"
                disabled
                value={`${user?.name || 'Current User'} (${user?.employeeId || 'Active User'})`}
                style={{ backgroundColor: 'var(--slate-50)', color: 'var(--slate-500)' }}
              />
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setNewModalOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleCreateRequest} disabled={modalSubmitting}>
                {modalSubmitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
