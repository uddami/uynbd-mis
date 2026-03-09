/**
 * ActivityStatusModal.jsx
 * ────────────────────────
 * Modal to change activity lifecycle status.
 * Enforces PDF report requirement before Completed.
 * Shows lock warning when moving to Completed.
 */

import React, { useState } from "react";
import axios from "axios";

const LIFECYCLE = ["Draft", "Submitted", "Approved", "Ongoing", "Completed", "Archived"];

const ROLE_APPROVE = ["super_admin", "administrator"];

export default function ActivityStatusModal({ activity, userRole, onClose, onSuccess }) {
  const [newStatus, setNewStatus] = useState(activity.status);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);

  const currentIdx = LIFECYCLE.indexOf(activity.status);

  // Status options: allow moving forward (and back to Draft/Archived by admins)
  const allowedStatuses = LIFECYCLE.filter((s, i) => {
    if (ROLE_APPROVE.includes(userRole)) return true;
    return i > currentIdx || s === activity.status;
  });

  const isCompletionSelected = newStatus === "Completed";
  const hasReport = !!activity.pdf_report_url?.trim();
  const willLock = isCompletionSelected;

  const handleSubmit = async () => {
    setErrors([]);
    // Client-side guard
    if (isCompletionSelected && !hasReport) {
      setErrors(["A PDF report must be uploaded before marking this activity as Completed."]);
      return;
    }
    setLoading(true);
    try {
      await axios.patch(`/api/activities/${activity.activity_id}/status`, { newStatus });
      onSuccess?.();
      onClose();
    } catch (err) {
      const details = err.response?.data?.details ?? [];
      const msg = err.response?.data?.error ?? "Status change failed.";
      setErrors(details.length ? details : [msg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-1">Change Activity Status</h2>
        <p className="text-sm text-gray-400 mb-5">
          Current: <strong className="text-gray-700">{activity.status}</strong>
        </p>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 space-y-1">
            {errors.map((e, i) => <p key={i}>• {e}</p>)}
          </div>
        )}

        {/* Status Selector */}
        <label className="block text-sm font-medium text-gray-700 mb-2">New Status</label>
        <div className="space-y-2 mb-5">
          {allowedStatuses.map((s) => {
            const isDisabled = s === "Approved" && !ROLE_APPROVE.includes(userRole);
            return (
              <label
                key={s}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition
                  ${newStatus === s ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-gray-300"}
                  ${isDisabled ? "opacity-40 cursor-not-allowed" : ""}
                `}
              >
                <input
                  type="radio"
                  name="status"
                  value={s}
                  checked={newStatus === s}
                  onChange={() => !isDisabled && setNewStatus(s)}
                  disabled={isDisabled}
                  className="accent-green-600"
                />
                <span className="text-sm font-medium text-gray-700">{s}</span>
                {isDisabled && (
                  <span className="ml-auto text-xs text-gray-400">Admin only</span>
                )}
              </label>
            );
          })}
        </div>

        {/* Completion warnings */}
        {isCompletionSelected && (
          <div className="space-y-3 mb-5">
            {!hasReport && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
                ⚠ <strong>PDF report required.</strong> Upload a report before completing this activity.
              </div>
            )}
            {willLock && hasReport && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                🔒 <strong>This action will lock the activity.</strong> Attendance, spending, and participants
                will become read-only. Only Super Admin can unlock.
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || newStatus === activity.status}
            className="px-5 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-40 transition"
          >
            {loading ? "Updating..." : "Confirm Change"}
          </button>
        </div>
      </div>
    </div>
  );
}
