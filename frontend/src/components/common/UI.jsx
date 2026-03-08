/**
 * UYNBD MIS - Shared UI Components
 * Modal, StatusBadge, StatWidget, LoadingState, Pagination, ConfirmDialog
 */

import { X, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { useState } from 'react';

// ─── Modal ─────────────────────────────────────────────────────────────────────
export const Modal = ({ open, onClose, title, children, size = 'md' }) => {
  if (!open) return null;
  const sizes = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal-box ${sizes[size]} w-full`}>
        <div className="modal-header">
          <h3 className="text-lg font-display font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

// ─── Status Badge ──────────────────────────────────────────────────────────────
export const StatusBadge = ({ status }) => {
  const map = {
    active: 'badge-active',
    probation: 'badge-probation',
    inactive: 'badge-inactive',
    alumni: 'badge-alumni',
    suspended: 'badge-suspended',
    draft: 'badge-draft',
    submitted: 'badge-probation',
    approved: 'badge-approved',
    published: 'badge-active',
    completed: 'badge-completed',
    archived: 'badge-draft',
    ongoing: 'badge-ongoing',
    proposed: 'badge-probation',
    closed: 'badge-draft',
    paid: 'badge-active',
    late: 'badge-probation',
    suspension_review: 'badge-inactive',
    active_branch: 'badge-active',
  };
  const cls = map[status] || 'badge bg-slate-500/15 text-slate-400';
  const labels = {
    active: 'Active', probation: 'Probation', inactive: 'Inactive',
    alumni: 'Alumni', suspended: 'Suspended', draft: 'Draft',
    submitted: 'Submitted', approved: 'Approved', published: 'Published',
    completed: 'Completed', archived: 'Archived', ongoing: 'Ongoing',
    proposed: 'Proposed', closed: 'Closed', paid: 'Paid',
    late: 'Late', suspension_review: 'Review Needed',
  };
  return <span className={cls}>{labels[status] || status}</span>;
};

// ─── Stat Widget ───────────────────────────────────────────────────────────────
export const StatWidget = ({ title, value, subtitle, icon: Icon, color = 'brand', trend }) => {
  const colors = {
    brand: 'text-brand-400 bg-brand-500/10',
    emerald: 'text-emerald-400 bg-emerald-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
    red: 'text-red-400 bg-red-500/10',
    violet: 'text-violet-400 bg-violet-500/10',
    blue: 'text-blue-400 bg-blue-500/10',
  };

  return (
    <div className="stat-widget">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{title}</div>
          <div className="text-3xl font-display font-bold text-white">{value ?? '—'}</div>
          {subtitle && <div className="text-xs text-slate-500 mt-1">{subtitle}</div>}
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-xl ${colors[color]}`}>
            <Icon size={20} />
          </div>
        )}
      </div>
      {trend !== undefined && (
        <div className={`text-xs mt-2 ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% from last month
        </div>
      )}
    </div>
  );
};

// ─── Loading State ─────────────────────────────────────────────────────────────
export const LoadingState = ({ rows = 5 }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="skeleton h-14 rounded-xl" style={{ opacity: 1 - i * 0.15 }} />
    ))}
  </div>
);

export const LoadingCards = ({ count = 6 }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="skeleton h-40 rounded-2xl" />
    ))}
  </div>
);

// ─── Empty State ───────────────────────────────────────────────────────────────
export const EmptyState = ({ icon = '📭', title = 'No data found', subtitle, action }) => (
  <div className="flex flex-col items-center justify-center py-20 text-center">
    <div className="text-5xl mb-4">{icon}</div>
    <h3 className="font-display font-bold text-white text-lg mb-2">{title}</h3>
    {subtitle && <p className="text-slate-400 text-sm mb-4 max-w-sm">{subtitle}</p>}
    {action}
  </div>
);

// ─── Pagination ────────────────────────────────────────────────────────────────
export const Pagination = ({ page, total, limit, onPageChange }) => {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
      <span className="text-xs text-slate-500">
        Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total}
      </span>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="btn-secondary btn btn-sm"
        >
          ‹ Prev
        </button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
          return (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-secondary'}`}
            >
              {p}
            </button>
          );
        })}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="btn-secondary btn btn-sm"
        >
          Next ›
        </button>
      </div>
    </div>
  );
};

// ─── Confirm Dialog ────────────────────────────────────────────────────────────
export const ConfirmDialog = ({ open, onClose, onConfirm, title, message, variant = 'danger' }) => {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm();
    setLoading(false);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="flex flex-col gap-4">
        <div className={variant === 'danger' ? 'alert-danger' : 'alert-warning'}>
          <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
          <span>{message}</span>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary btn">Cancel</button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={variant === 'danger' ? 'btn-danger btn' : 'btn-primary btn'}
          >
            {loading ? 'Processing...' : 'Confirm'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ─── Score Ring ────────────────────────────────────────────────────────────────
export const ScoreRing = ({ score, size = 80, strokeWidth = 8 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="score-ring">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#1e293b" strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
      </svg>
      <div className="absolute text-center">
        <span className="text-white font-display font-bold" style={{ fontSize: size * 0.22 }}>{score}</span>
      </div>
    </div>
  );
};

// ─── Search Bar ────────────────────────────────────────────────────────────────
export const SearchBar = ({ value, onChange, placeholder = 'Search...', onSearch }) => (
  <div className="relative">
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && onSearch?.()}
      placeholder={placeholder}
      className="form-input pl-9 w-full"
    />
    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M10 6.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0zM9.17 9.88l3 3-.71.71-3-3 .71-.71z" fill="currentColor" />
      </svg>
    </div>
  </div>
);

// ─── Section Header ────────────────────────────────────────────────────────────
export const SectionHeader = ({ title, subtitle, actions }) => (
  <div className="section-header">
    <div>
      <h1 className="text-2xl font-display font-bold text-white">{title}</h1>
      {subtitle && <p className="text-slate-400 text-sm mt-1">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-3">{actions}</div>}
  </div>
);

// ─── Alert ─────────────────────────────────────────────────────────────────────
export const Alert = ({ type = 'info', message, onDismiss }) => {
  const classes = { info: 'alert-info', warning: 'alert-warning', danger: 'alert-danger' };
  const icons = { info: Info, warning: AlertTriangle, danger: AlertTriangle };
  const Icon = icons[type];

  return (
    <div className={classes[type]}>
      <Icon size={16} className="flex-shrink-0 mt-0.5" />
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="opacity-60 hover:opacity-100 ml-auto">
          <X size={14} />
        </button>
      )}
    </div>
  );
};
