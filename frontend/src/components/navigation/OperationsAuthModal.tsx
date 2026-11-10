import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  Lock,
  Phone,
  AlertTriangle,
  CheckCircle2,
  LogOut,
  Eye,
  EyeOff,
  Shield,
  Loader2,
} from 'lucide-react';
import { login, logout, demoLogin, getUserRole } from '../../services/api';
import { ModalPortal } from '../ui/ModalPortal';

interface OperationsAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthChange?: () => void;
}

export const OperationsAuthModal: React.FC<OperationsAuthModalProps> = ({
  isOpen,
  onClose,
  onAuthChange,
}) => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const currentRole = getUserRole();

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !password) {
      setError('Please provide phone number and password.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await login(phone.trim(), password);
      if (onAuthChange) onAuthChange();
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Authentication failed';
      if (msg.includes('401') || msg.toLowerCase().includes('credential')) {
        setError('Invalid credentials. Please verify your phone number and password.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    setDemoLoading(true);
    try {
      const result = await demoLogin();
      if (!result?.access_token) {
        throw new Error('No token received from demo login.');
      }
      if (onAuthChange) onAuthChange();
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Demo login failed';
      // Surface a clean message; never expose backend configuration details
      if (msg.includes('503') || msg.toLowerCase().includes('not available') || msg.toLowerCase().includes('not configured')) {
        setError('Demo access is not available right now. Please sign in manually.');
      } else if (msg.includes('403') || msg.toLowerCase().includes('role')) {
        setError('Demo account does not have the required officer role. Contact the administrator.');
      } else {
        setError('Demo login failed. Please try signing in manually.');
      }
    } finally {
      setDemoLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    if (onAuthChange) onAuthChange();
    onClose();
  };

  const isAnyLoading = loading || demoLoading;

  return (
    <ModalPortal onClose={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#202622]/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md bg-[#FAF9F3] border border-[#C7B89B] rounded-3xl shadow-2xl overflow-hidden flex flex-col font-sans"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="px-6 py-4 bg-[#F4F1E8] border-b border-[#C7B89B]/50 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-[#23483A] text-[#FAF9F3] flex items-center justify-center shadow-sm shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 id="auth-modal-title" className="text-sm font-heading font-black tracking-wider text-[#202622] uppercase">
                  Operations Authentication
                </h2>
                <span className="text-[10px] font-mono text-[#536A72] block">
                  Authorized Command &amp; Tactical Dashboard
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#536A72] hover:text-[#202622] hover:bg-[#E8E6DC] transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#23483A]"
              aria-label="Close modal"
              disabled={isAnyLoading}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 space-y-5">
            {/* Current Authorization Status */}
            <div className="p-4 rounded-2xl bg-[#F4F1E8] border border-[#C7B89B]/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-[#536A72] uppercase tracking-wider">
                  Current Authorization
                </span>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md uppercase ${
                    currentRole === 'admin'
                      ? 'bg-[#23483A] text-[#FAF9F3]'
                      : currentRole === 'officer'
                      ? 'bg-[#23483A]/80 text-[#FAF9F3]'
                      : currentRole === 'citizen'
                      ? 'bg-[#D88A32] text-white'
                      : 'bg-[#C7B89B] text-[#202622]'
                  }`}
                >
                  {currentRole ? `Role: ${currentRole}` : 'Unauthenticated'}
                </span>
              </div>

              {currentRole === 'admin' && (
                <p className="text-xs text-[#23483A] font-medium flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-[#23483A]" />
                  <span>Full operational &amp; simulation access granted via backend RBAC.</span>
                </p>
              )}

              {currentRole === 'officer' && (
                <p className="text-xs text-[#23483A] font-medium flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-[#23483A]" />
                  <span>Operational officer access granted. What-If simulations enabled.</span>
                </p>
              )}

              {currentRole === 'citizen' && (
                <div className="p-3 rounded-xl bg-[#23483A]/10 border border-[#23483A]/30 text-[#23483A] text-xs font-mono space-y-2">
                  <div className="flex items-center space-x-1.5 font-bold">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-[#23483A]" />
                    <span>Citizen Session Active</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-[#202622]/80">
                    You are signed in as a verified citizen. Live incident telemetry, map hazard reports, and SOS distress signals are fully enabled.
                  </p>
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={isAnyLoading}
                    className="px-2.5 py-1 rounded bg-[#8E2F2B] text-white text-[10px] font-bold hover:bg-[#702420] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Sign Out Citizen Session
                  </button>
                </div>
              )}
            </div>

            {/* Demo Login — primary action */}
            <div>
              <button
                type="button"
                onClick={handleDemoLogin}
                disabled={isAnyLoading}
                className="w-full flex items-center justify-center space-x-2.5 py-3 px-4 rounded-xl bg-[#23483A] text-[#FAF9F3] font-heading font-bold text-sm hover:bg-[#1b382d] active:bg-[#162d24] transition-all cursor-pointer shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#23483A] focus-visible:ring-offset-[#FAF9F3] disabled:opacity-60 disabled:cursor-not-allowed"
                aria-label="Continue as Demo Officer"
              >
                {demoLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                ) : (
                  <Shield className="w-4 h-4 shrink-0" />
                )}
                <span>{demoLoading ? 'Authenticating...' : 'Continue as Demo Officer'}</span>
              </button>
              <p className="mt-2 text-center text-[10px] font-mono text-[#536A72]">
                Authenticates a pre-configured officer account via the backend.
              </p>
            </div>

            {/* Divider */}
            <div className="flex items-center space-x-3">
              <div className="flex-1 h-px bg-[#C7B89B]/60" />
              <span className="text-[10px] font-mono font-bold text-[#536A72] uppercase tracking-wider shrink-0">
                Or Sign In Manually
              </span>
              <div className="flex-1 h-px bg-[#C7B89B]/60" />
            </div>

            {/* Manual Login Form */}
            <form onSubmit={handleLogin} className="space-y-4" noValidate>
              {/* Phone */}
              <div>
                <label
                  htmlFor="auth-phone"
                  className="text-xs font-mono font-bold text-[#202622] block mb-1.5"
                >
                  Authorized Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-[#536A72] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91..."
                    autoComplete="tel"
                    disabled={isAnyLoading}
                    className="w-full pl-9 pr-3 py-2.5 bg-[#F4F1E8] border border-[#C7B89B] rounded-xl text-xs font-mono text-[#202622] placeholder:text-[#536A72]/60 focus:outline-none focus:border-[#23483A] transition-colors disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="auth-password"
                  className="text-xs font-mono font-bold text-[#202622] block mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#536A72] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    disabled={isAnyLoading}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.form?.requestSubmit();
                      }
                    }}
                    className="w-full pl-9 pr-10 py-2.5 bg-[#F4F1E8] border border-[#C7B89B] rounded-xl text-xs font-mono text-[#202622] placeholder:text-[#536A72]/60 focus:outline-none focus:border-[#23483A] transition-colors disabled:opacity-50"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#536A72] hover:text-[#202622] transition-colors cursor-pointer focus:outline-none"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-[#8E2F2B]/10 border border-[#8E2F2B]/40 text-[#8E2F2B] text-xs font-mono flex items-start space-x-2"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit + Sign-out row */}
              <div className="pt-1 flex items-center space-x-2">
                <button
                  type="submit"
                  disabled={isAnyLoading}
                  className="flex-1 py-2.5 rounded-xl bg-[#536A72] text-[#FAF9F3] text-xs font-heading font-bold hover:bg-[#44555c] transition-all cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#536A72] flex items-center justify-center space-x-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <span>Log In to Operations</span>
                  )}
                </button>

                {currentRole && (
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={isAnyLoading}
                    className="px-3 py-2.5 rounded-xl bg-[#F4F1E8] border border-[#C7B89B] text-[#8E2F2B] hover:bg-[#E8E6DC] text-xs font-mono font-bold transition-all cursor-pointer flex items-center space-x-1 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8E2F2B]"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden sm:inline">Sign Out</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
