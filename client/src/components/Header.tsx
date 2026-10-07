import React, { useState, useRef, useEffect } from 'react';
import { 
  LogOut, 
  Sun, 
  Moon, 
  Clock,
  ChevronDown,
  Bell,
  Shield,
  Briefcase,
  UserCheck
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getStoredToken } from '../api/client';
import { getTokenRemainingMs } from '../utils/jwt';
import type { UserRole } from '../types';

interface HeaderProps {
  currentRole: UserRole;
  userName: string;
  currentTab?: string;
  onLogout: () => void;
}

const TAB_LABELS: Record<string, string> = {
  dashboard: 'Executive Dashboard',
  employees: 'Workforce Directory',
  contracts: 'Employment Contracts',
  schedules: 'Working Schedules',
  attendance: 'Attendance & Punch Clock',
  'time-off': 'Time Off & Leave Requests',
  payruns: 'Payruns & Payroll Engine',
  payslips: 'Payslip Records',
  'salary-rules': 'Salary Rules & Computation',
  'salary-structures': 'Salary Structures',
  settings: 'System Administration',
};

export const Header: React.FC<HeaderProps> = ({ 
  currentRole, 
  userName, 
  currentTab = 'dashboard',
  onLogout
}) => {
  const { theme, toggleTheme } = useTheme();
  const { user, token } = useAuth();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  // Live real-time clock
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');
  const [currentDateStr, setCurrentDateStr] = useState<string>('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTimeStr(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setCurrentDateStr(now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }));
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Live session remaining time tracker
  const [remainingTimeStr, setRemainingTimeStr] = useState<string>('20m 00s');

  useEffect(() => {
    const updateRemaining = () => {
      const activeToken = token || getStoredToken();
      if (!activeToken) {
        setRemainingTimeStr('Expired');
        return;
      }
      const ms = getTokenRemainingMs(activeToken);
      if (ms <= 0) {
        setRemainingTimeStr('Expired');
        return;
      }
      const effectiveMs = Math.min(ms, 20 * 60 * 1000);
      const totalSec = Math.floor(effectiveMs / 1000);
      const mins = Math.floor(totalSec / 60);
      const secs = totalSec % 60;
      setRemainingTimeStr(`${mins}m ${secs.toString().padStart(2, '0')}s`);
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [token]);

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);



  const getRoleTheme = (role: UserRole) => {
    switch (role) {
      case 'Admin':
        return {
          label: 'Administrator',
          color: '#6366f1',
          bg: 'rgba(99, 102, 241, 0.12)',
          border: 'rgba(99, 102, 241, 0.3)',
          icon: <Shield size={13} />,
          dept: 'System Administration',
        };
      case 'HR Manager':
        return {
          label: 'HR Manager',
          color: '#0d9488',
          bg: 'rgba(13, 148, 136, 0.12)',
          border: 'rgba(13, 148, 136, 0.3)',
          icon: <Briefcase size={13} />,
          dept: 'Human Resources & Operations',
        };
      case 'Employee':
      default:
        return {
          label: 'Employee',
          color: '#0284c7',
          bg: 'rgba(2, 132, 199, 0.12)',
          border: 'rgba(2, 132, 199, 0.3)',
          icon: <UserCheck size={13} />,
          dept: 'Engineering Department',
        };
    }
  };

  const currentTheme = getRoleTheme(currentRole);

  const notifications = [
    { id: 1, title: 'Leave Request Pending', desc: 'John Doe requested 2 days Sick Leave', time: '10m ago', unread: true },
    { id: 2, title: 'Payrun Cycle Open', desc: 'October 2026 Regular Payrun ready for calculation', time: '1h ago', unread: true },
    { id: 3, title: 'Contract Renewal', desc: 'Maya Lin contract due for renewal in 30 days', time: '1d ago', unread: false },
  ];

  return (
    <header className="header" role="banner">
      {/* Left: Tab Title & Breadcrumb */}
      <div className="header-left">
        <div className="header-breadcrumb">
          <span className="header-org">HR Nexus</span>
          <span className="header-separator">/</span>
          <span className="header-current-tab">{TAB_LABELS[currentTab] || currentTab}</span>
        </div>
      </div>

      {/* Center: Clean Workspace Status */}
      <div className="header-center">
        <span className="system-status-indicator" title="Connected to Secure Cloud ERP Database">
          <span className="status-indicator-dot" />
          <span>Cloud Core Active</span>
        </span>
      </div>

      {/* Right Controls */}
      <div className="header-right">
        {/* Live Clock Widget */}
        <div className="header-clock-widget" title={`Today is ${currentDateStr}`}>
          <Clock size={13} color="var(--primary)" />
          <div className="clock-text">
            <span className="clock-time">{currentTimeStr}</span>
            <span className="clock-date">{currentDateStr}</span>
          </div>
        </div>

        {/* Notifications Dropdown */}
        <div className="header-popover-wrapper" ref={notificationsRef}>
          <button
            type="button"
            className="header-icon-btn"
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            aria-label="Notifications"
            title="System Notifications"
          >
            <Bell size={17} />
            <span className="notification-dot" />
          </button>

          {isNotificationsOpen && (
            <div className="notifications-popover">
              <div className="notifications-header">
                <div style={{ fontWeight: 700, fontSize: '13px' }}>System Notifications</div>
                <span className="badge badge-info" style={{ fontSize: '10px' }}>2 New</span>
              </div>
              <div className="notifications-list">
                {notifications.map((n) => (
                  <div key={n.id} className={`notification-item ${n.unread ? 'unread' : ''}`}>
                    <div className="notif-title-row">
                      <span className="notif-title">{n.title}</span>
                      <span className="notif-time">{n.time}</span>
                    </div>
                    <p className="notif-desc">{n.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          type="button"
          className="header-icon-btn"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? <Sun size={17} color="#f59e0b" /> : <Moon size={17} color="var(--primary)" />}
        </button>

        {/* User Profile Badge & Dropdown */}
        <div className="header-popover-wrapper" ref={dropdownRef}>
          <button
            type="button"
            className="user-profile-trigger"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            aria-expanded={isDropdownOpen}
          >
            <div 
              className="user-avatar"
              style={{
                background: currentTheme.bg,
                color: currentTheme.color,
                border: `1.5px solid ${currentTheme.border}`
              }}
            >
              {userName.substring(0, 2).toUpperCase()}
            </div>
            <div className="user-info">
              <span className="user-name">{user?.name || userName}</span>
              <span className="user-role-tag" style={{ color: currentTheme.color, background: currentTheme.bg }}>
                {currentTheme.icon}
                {currentTheme.label}
              </span>
            </div>
            <ChevronDown size={14} className="user-chevron" />
          </button>

          {isDropdownOpen && (
            <div className="user-dropdown-menu">
              <div className="user-dropdown-header">
                <div className="dropdown-user-name">{user?.name || userName}</div>
                <div className="dropdown-user-email">{user?.email || 'user@company.com'}</div>
                <div className="dropdown-role-chip" style={{ color: currentTheme.color, background: currentTheme.bg, border: `1px solid ${currentTheme.border}` }}>
                  {currentTheme.icon}
                  <span>{currentTheme.label} • {currentTheme.dept}</span>
                </div>
              </div>

              <div className="user-dropdown-section">
                <div className="dropdown-meta-row">
                  <span className="meta-label">Session Remaining</span>
                  <span className="meta-value" style={{ color: '#10b981', fontWeight: 600 }}>{remainingTimeStr}</span>
                </div>
                <div className="dropdown-meta-row">
                  <span className="meta-label">Security Policy</span>
                  <span className="meta-value">3-Tier RBAC Protected</span>
                </div>
              </div>

              <div className="user-dropdown-actions">
                <button
                  type="button"
                  className="dropdown-action-btn logout-btn"
                  onClick={onLogout}
                >
                  <LogOut size={14} />
                  <span>Sign Out of HR Nexus</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
