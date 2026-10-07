import React, { useState } from 'react';
import { 
  Lock, 
  Mail, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  Loader2, 
  AlertCircle,
  Sun,
  Moon,
  Shield,
  CheckCircle2,
  Sparkles,
  FileSpreadsheet, 
  Clock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import type { UserRole } from '../types';

interface LoginProps {
  onLogin?: (role: UserRole, userEmail: string, userName: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const { login, user, displayRole } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!normalizedEmail || !trimmedPassword) {
      setErrorMessage('Please enter both your work email and password.');
      return;
    }

    if (!normalizedEmail.includes('@') || !normalizedEmail.includes('.')) {
      setErrorMessage('Please enter a valid work email address.');
      return;
    }

    if (isLoading) return;

    setIsLoading(true);

    try {
      await login(normalizedEmail, trimmedPassword);
      if (onLogin && user) {
        onLogin(displayRole, user.email, user.name);
      }
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'Authentication failed. Please verify credentials and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Dynamic Animated Ambient Background Orbs */}
      <div className="login-bg-decorations" aria-hidden="true">
        <div className="login-bg-orb login-bg-orb-1" />
        <div className="login-bg-orb login-bg-orb-2" />
        <div className="login-bg-orb login-bg-orb-3" />
        <div className="login-bg-grid-overlay" />
      </div>

      {/* Top Floating Glass Navigation Bar */}
      <header className="login-top-bar">
        <div className="login-brand-pill">
          <div className="login-brand-icon-mini">N</div>
          <span style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '-0.02em', color: 'var(--text-main)' }}>
            HR <span style={{ color: 'var(--primary)' }}>Nexus</span>
          </span>
          <span className="login-brand-version-badge">Enterprise Edition</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div className="login-status-indicator">
            <span className="login-status-dot" />
            <span>Systems Operational • 99.99% SLA</span>
          </div>

          <button
            type="button"
            className="login-theme-btn"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? (
              <>
                <Sun size={15} color="#f59e0b" />
                <span>Light</span>
              </>
            ) : (
              <>
                <Moon size={15} color="#0d9488" />
                <span>Dark</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Dual-Column Showcase Layout */}
      <main className="login-main-layout">
        {/* Left Column: Hero, Metrics & Capability Highlights */}
        <div className="login-showcase">
          <div className="login-badge-hero">
            <Sparkles size={14} color="var(--primary)" />
            <span>Next-Generation HCM & Deterministic Payroll Platform</span>
          </div>
          
          <h1 className="login-hero-title">
            Empower Your Workforce with <span className="login-gradient-text">Precision Payroll</span> & Intelligent HR
          </h1>
          
          <p className="login-hero-subtitle">
            A comprehensive, relational database-backed Human Capital Management suite engineered with 
            strict 3-Tier Role-Based Access Control, real-time geofenced punch clocks, and deterministic, 
            zero-drift payroll calculations.
          </p>

          {/* Operational ERP Capabilities */}
          <div className="login-capabilities-grid">
            <div className="login-capability-item">
              <span className="login-cap-dot" />
              <span>Employee Management</span>
            </div>
            <div className="login-capability-item">
              <span className="login-cap-dot" />
              <span>Attendance Tracking</span>
            </div>
            <div className="login-capability-item">
              <span className="login-cap-dot" />
              <span>Leave & Time-Off</span>
            </div>
            <div className="login-capability-item">
              <span className="login-cap-dot" />
              <span>Contract Management</span>
            </div>
            <div className="login-capability-item">
              <span className="login-cap-dot" />
              <span>Payroll Processing</span>
            </div>
            <div className="login-capability-item">
              <span className="login-cap-dot" />
              <span>Payslips & Reporting</span>
            </div>
          </div>

          {/* Architectural Feature Cards Grid */}
          <div className="login-features-grid">
            <div className="login-feat-card">
              <div className="login-feat-icon" style={{ background: 'rgba(13, 148, 136, 0.14)', color: '#0d9488' }}>
                <Shield size={20} />
              </div>
              <div className="login-feat-content">
                <h4>3-Tier Server-Gated RBAC Architecture</h4>
                <p>Granular route guards enforcing strict isolation between Administrator, HR Manager, and Staff Employee profiles.</p>
              </div>
            </div>

            <div className="login-feat-card">
              <div className="login-feat-icon" style={{ background: 'rgba(13, 148, 136, 0.14)', color: '#0d9488' }}>
                <Clock size={20} />
              </div>
              <div className="login-feat-content">
                <h4>Real-Time Attendance & Shift Compliance</h4>
                <p>Live session timers and daily check-in/out limits feeding directly into overtime adjustments and absence calculations.</p>
              </div>
            </div>

            <div className="login-feat-card">
              <div className="login-feat-icon" style={{ background: 'rgba(16, 185, 129, 0.14)', color: '#10b981' }}>
                <FileSpreadsheet size={20} />
              </div>
              <div className="login-feat-content">
                <h4>Deterministic Payroll Engine</h4>
                <p>Persisted calculation snapshots, multi-year historical tracking, statutory deductions, and printable payslip vouchers.</p>
              </div>
            </div>
          </div>

          {/* Security & Audit Compliance Strip */}
          <div className="login-trust-strip">
            <div className="login-trust-item">
              <CheckCircle2 size={14} color="#10b981" />
              <span>MySQL 8.0 BCNF Relational Schema</span>
            </div>
            <div className="login-trust-item">
              <CheckCircle2 size={14} color="#10b981" />
              <span>JWT HMAC-SHA256 Token Protection</span>
            </div>
            <div className="login-trust-item">
              <CheckCircle2 size={14} color="#10b981" />
              <span>ISO 27001 Security Standard Ready</span>
            </div>
          </div>
        </div>

        {/* Right Column: High-End Glassmorphic Sign-In Portal */}
        <div className="login-card-column">
          <div className="login-card">
            {/* Card Header */}
            <div className="login-card-header">
              <div className="login-card-badge-row">
                <div className="login-card-logo">N</div>
                <div className="login-card-status">
                  <span className="login-card-status-pulse" />
                  <span>Secure TLS Gateway</span>
                </div>
              </div>
              <h2 className="login-card-title">Sign In to Workspace</h2>
              <p className="login-card-subtitle">
                Enter your enterprise work credentials to proceed.
              </p>
            </div>

            {/* Error Notification Alert */}
            {errorMessage && (
              <div className="login-error-banner" role="alert">
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Authentication Form */}
            <form onSubmit={handleSubmit} noValidate>
              <div className="form-field">
                <label className="form-label" htmlFor="login-email">
                  Corporate Work Email
                </label>
                <div className="login-input-wrapper">
                  <Mail size={16} className="login-input-icon" />
                  <input
                    id="login-email"
                    type="email"
                    className="form-input login-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    disabled={isLoading}
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="form-field" style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label" htmlFor="login-password" style={{ marginBottom: 0 }}>
                    Password
                  </label>
                  <a
                    href="#forgot"
                    onClick={(e) => {
                      e.preventDefault();
                      alert('Please contact your company system administrator to reset credentials.');
                    }}
                    className="login-forgot-link"
                    style={{ fontSize: '11.5px', color: 'var(--primary)', textDecoration: 'none' }}
                  >
                    Forgot password?
                  </a>
                </div>
                <div className="login-input-wrapper">
                  <Lock size={16} className="login-input-icon" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    className="form-input login-input"
                    style={{ paddingRight: '40px' }}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={isLoading}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword(!showPassword)}
                    className="login-eye-btn"
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary login-submit-btn"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Enter HR Nexus Workspace</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            <div className="login-card-footer">
              <p className="login-footer-notice">
                Protected by End-to-End Enterprise Encryption • Zero Trust Protocol
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
