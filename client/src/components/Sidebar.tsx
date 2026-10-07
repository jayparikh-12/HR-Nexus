import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  PlayCircle, 
  Clock, 
  Palmtree, 
  FileText, 
  Settings,
  Sparkles,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Shield,
  Briefcase,
  UserCheck,
  CalendarDays,
  Layers
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  employeeCount?: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentTab, 
  onSelectTab, 
  employeeCount,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const { displayRole } = useAuth();

  const isAdmin = displayRole === 'Admin';
  const isHRManager = displayRole === 'HR Manager';
  const isEmployee = displayRole === 'Employee';

  // Specific visibility flags for the 3 roles
  const showEmployees = isAdmin || isHRManager;
  const showContracts = isAdmin || isHRManager;
  const showSchedules = isAdmin || isHRManager;
  const showAttendance = true; // Everyone: self for Employee, company for managers
  const showTimeOff = true;    // Everyone: request for Employee, review/approve for HR/Admin
  const showPayrollEngine = isAdmin || isHRManager; // Both Admin and HR Manager run payroll
  const showSalaryRules = isAdmin || isHRManager;
  const showSettings = isAdmin; // Strictly Admin

  const countBadge = employeeCount !== undefined && employeeCount !== null ? employeeCount : 6;

  const getRoleBadge = () => {
    if (isAdmin) {
      return { text: 'Admin Portal', color: '#0d9488', bg: 'rgba(13, 148, 136, 0.12)', icon: <Shield size={12} /> };
    }
    if (isHRManager) {
      return { text: 'HR Operations', color: '#0d9488', bg: 'rgba(13, 148, 136, 0.12)', icon: <Briefcase size={12} /> };
    }
    return { text: 'Employee Portal', color: '#0284c7', bg: 'rgba(2, 132, 199, 0.12)', icon: <UserCheck size={12} /> };
  };

  const roleBadge = getRoleBadge();

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`} aria-label="Main navigation sidebar">
      {/* Brand Header */}
      <div className="sidebar-header" style={{ justifyContent: isCollapsed ? 'center' : 'space-between', padding: isCollapsed ? '0 10px' : '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="logo-box" title="HR Nexus Platform">
            <span>N</span>
          </div>
          {!isCollapsed && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="logo-text">HR Nexus</div>
              <div 
                className="sidebar-role-indicator"
                style={{ color: roleBadge.color, background: roleBadge.bg }}
              >
                {roleBadge.icon}
                <span>{roleBadge.text}</span>
              </div>
            </div>
          )}
        </div>
        {onToggleCollapse && (
          <button
            type="button"
            className="sidebar-toggle-btn"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        )}
      </div>

      {/* Navigation Menu */}
      <div className="sidebar-menu">
        {/* Workspace Hub */}
        <div>
          <div className="menu-group-title">{isEmployee ? 'Personal Space' : 'Overview'}</div>
          <ul className="menu-items">
            <li>
              <button
                className={`nav-link ${currentTab === 'dashboard' ? 'active' : ''}`}
                onClick={() => onSelectTab('dashboard')}
                title={isEmployee ? 'My Dashboard' : 'Executive Dashboard'}
              >
                <div className="nav-link-left">
                  <LayoutDashboard size={17} />
                  <span>{isEmployee ? 'My Dashboard' : 'Dashboard'}</span>
                </div>
              </button>
            </li>
          </ul>
        </div>

        {/* Core Operations / Employee Self-Service */}
        <div>
          <div className="menu-group-title">{isEmployee ? 'Self-Service Services' : 'Workforce Management'}</div>
          <ul className="menu-items">
            {showEmployees && (
              <li>
                <button
                  className={`nav-link ${currentTab === 'employees' ? 'active' : ''}`}
                  onClick={() => onSelectTab('employees')}
                  title="Employees Directory"
                >
                  <div className="nav-link-left">
                    <Users size={17} />
                    <span>Employees</span>
                  </div>
                  <span className="nav-badge">{countBadge}</span>
                </button>
              </li>
            )}

            {showContracts && (
              <li>
                <button
                  className={`nav-link ${currentTab === 'contracts' ? 'active' : ''}`}
                  onClick={() => onSelectTab('contracts')}
                  title="Employment Contracts"
                >
                  <div className="nav-link-left">
                    <FileText size={17} />
                    <span>Contracts</span>
                  </div>
                </button>
              </li>
            )}

            {showSchedules && (
              <li>
                <button
                  className={`nav-link ${currentTab === 'schedules' ? 'active' : ''}`}
                  onClick={() => onSelectTab('schedules')}
                  title="Working Schedules"
                >
                  <div className="nav-link-left">
                    <CalendarDays size={17} />
                    <span>Work Schedules</span>
                  </div>
                </button>
              </li>
            )}

            {showAttendance && (
              <li>
                <button
                  className={`nav-link ${currentTab === 'attendance' ? 'active' : ''}`}
                  onClick={() => onSelectTab('attendance')}
                  title={isEmployee ? 'My Attendance & Punch Clock' : 'Attendance Tracking'}
                >
                  <div className="nav-link-left">
                    <Clock size={17} />
                    <span>{isEmployee ? 'Punch Clock & Log' : 'Attendance'}</span>
                  </div>
                  {isEmployee && <span className="nav-pulse-dot" title="Live clock active" />}
                </button>
              </li>
            )}

            {showTimeOff && (
              <li>
                <button
                  className={`nav-link ${currentTab === 'time-off' ? 'active' : ''}`}
                  onClick={() => onSelectTab('time-off')}
                  title={isEmployee ? 'Request Time Off' : 'Time Off & Leave Approvals'}
                >
                  <div className="nav-link-left">
                    <Palmtree size={17} />
                    <span>{isEmployee ? 'My Leaves & Requests' : 'Time Off Approvals'}</span>
                  </div>
                  {isHRManager && <span className="nav-badge warning">1 pending</span>}
                </button>
              </li>
            )}

            <li>
              <button
                className={`nav-link ${currentTab === 'payslips' ? 'active' : ''}`}
                onClick={() => onSelectTab('payslips')}
                title={isEmployee ? 'My Payslips' : 'All Payslip Records'}
              >
                <div className="nav-link-left">
                  <CreditCard size={17} />
                  <span>{isEmployee ? 'My Payslips' : 'Payslips'}</span>
                </div>
              </button>
            </li>
          </ul>
        </div>

        {/* Payroll Engine for Admin & HR Manager */}
        {showPayrollEngine && (
          <div>
            <div className="menu-group-title">Payroll System</div>
            <ul className="menu-items">
              <li>
                <button
                  className={`nav-link ${currentTab === 'payruns' ? 'active' : ''}`}
                  onClick={() => onSelectTab('payruns')}
                  title="Payruns & Processing"
                >
                  <div className="nav-link-left">
                    <PlayCircle size={17} />
                    <span>Payruns & Calculations</span>
                  </div>
                  <span className="nav-badge success">Live Engine</span>
                </button>
              </li>
            </ul>
          </div>
        )}

        {/* Configuration & Administration */}
        {(showSalaryRules || showSettings) && (
          <div>
            <div className="menu-group-title">Governance</div>
            <ul className="menu-items">
              {showSalaryRules && (
                <li>
                  <button
                    className={`nav-link ${currentTab === 'salary-rules' || currentTab === 'salary-structures' ? 'active' : ''}`}
                    onClick={() => onSelectTab('salary-rules')}
                    title="Salary Rules & Structures"
                  >
                    <div className="nav-link-left">
                      <Layers size={17} />
                      <span>Salary Rules</span>
                    </div>
                  </button>
                </li>
              )}
              {showSettings && (
                <li>
                  <button
                    className={`nav-link ${currentTab === 'settings' ? 'active' : ''}`}
                    onClick={() => onSelectTab('settings')}
                    title="System Administration & Audit"
                  >
                    <div className="nav-link-left">
                      <Settings size={17} />
                      <span>Settings & Audit</span>
                    </div>
                  </button>
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="sidebar-footer">
        {!isCollapsed && (
          <div className="sidebar-footer-content">
            <div className="sidebar-version-chip">
              <Sparkles size={13} color="var(--primary)" />
              <span>HR 360 Edition</span>
            </div>
            <span className="sidebar-role-indicator-pill" style={{ color: roleBadge.color }}>
              {displayRole}
            </span>
          </div>
        )}
      </div>
    </aside>
  );
};
