/**
 * ActivityCreateForm.jsx
 * ──────────────────────
 * Updated activity creation form.
 * New fields: External org toggle, spending, PDF report.
 * Role-based field visibility is handled by the parent (pass userRole prop).
 */

import React, { useState } from "react";
import axios from "axios";

// Field visibility by role
const CAN_ENTER_SPENDING = ["super_admin", "administrator", "branch_chief", "finance_director"];

const ACTIVITY_TYPES = [
  "Central Meeting",
  "Branch Meeting",
  "Project",
  "Joint Event",
  "Campaign",
  "Workshop",
  "Training",
];

const INITIAL_FORM = {
  activity_name: "",
  activity_type: "",
  hosting_date: "",
  location: "",
  branch_id: "",
  chief_host_name: "",
  chief_host_position: "",
  chief_host_phone: "",
  chief_host_email: "",
  expected_branches: "",
  remarks: "",
  external_organization: false,
  external_organization_name: "",
  total_spendings: "",
};

export default function ActivityCreateForm({ userRole, branches = [], onSuccess, onCancel }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [pdfFile, setPdfFile] = useState(null);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);

  const canEnterSpending = CAN_ENTER_SPENDING.includes(userRole);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
      // Clear external org name when unchecked
      ...(name === "external_organization" && !checked
        ? { external_organization_name: "" }
        : {}),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors([]);
    setLoading(true);

    try {
      // Step 1: Create activity
      const res = await axios.post("/api/activities", form);
      const activityId = res.data.data.activity_id;

      // Step 2: Upload PDF if provided
      if (pdfFile) {
        const fd = new FormData();
        fd.append("report", pdfFile);
        await axios.post(`/api/activities/${activityId}/report`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      onSuccess?.(res.data.data);
    } catch (err) {
      const details = err.response?.data?.details ?? [];
      const msg = err.response?.data?.error ?? "Failed to create activity.";
      setErrors(details.length ? details : [msg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 max-w-3xl mx-auto">
      <h2 className="text-xl font-bold text-gray-800 mb-6">Create New Activity</h2>

      {errors.length > 0 && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="font-semibold text-red-700 mb-1">Please fix the following:</p>
          <ul className="list-disc list-inside text-red-600 text-sm space-y-1">
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* ── Basic Info ─────────────────────────────────────────────────── */}
        <section>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Basic Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Activity Name <span className="text-red-500">*</span>
              </label>
              <input
                name="activity_name"
                value={form.activity_name}
                onChange={handleChange}
                required
                placeholder="e.g. Annual Youth Summit 2025"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Activity Type <span className="text-red-500">*</span>
              </label>
              <select
                name="activity_type"
                value={form.activity_type}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Select type...</option>
                {ACTIVITY_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hosting Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="hosting_date"
                value={form.hosting_date}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input
                name="location"
                value={form.location}
                onChange={handleChange}
                placeholder="Venue / Online"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Host Branch <span className="text-red-500">*</span>
              </label>
              <select
                name="branch_id"
                value={form.branch_id}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Select branch...</option>
                {branches.map((b) => (
                  <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expected Branches
              </label>
              <input
                name="expected_branches"
                value={form.expected_branches}
                onChange={handleChange}
                placeholder="Branch IDs comma-separated"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
        </section>

        {/* ── External Organization ──────────────────────────────────────── */}
        <section className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="external_organization"
              checked={form.external_organization}
              onChange={handleChange}
              className="w-4 h-4 rounded accent-blue-600"
            />
            <span className="font-medium text-blue-800 text-sm">
              Hosted with another organization
            </span>
          </label>

          {form.external_organization && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                External Organization Name <span className="text-red-500">*</span>
              </label>
              <input
                name="external_organization_name"
                value={form.external_organization_name}
                onChange={handleChange}
                required
                placeholder="e.g. Youth Federation Bangladesh"
                className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-blue-600 mt-1">
                Note: The host branch remains the internal organizer.
              </p>
            </div>
          )}
        </section>

        {/* ── Chief Host ────────────────────────────────────────────────── */}
        <section>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Chief Host Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { name: "chief_host_name", label: "Name", required: true, placeholder: "Full name" },
              { name: "chief_host_position", label: "Position", placeholder: "e.g. President" },
              { name: "chief_host_phone", label: "Phone", placeholder: "+880..." },
              { name: "chief_host_email", label: "Email", placeholder: "host@email.com" },
            ].map(({ name, label, required, placeholder }) => (
              <div key={name}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {label} {required && <span className="text-red-500">*</span>}
                </label>
                <input
                  name={name}
                  value={form[name]}
                  onChange={handleChange}
                  required={required}
                  placeholder={placeholder}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            ))}
          </div>
        </section>

        {/* ── Spending ──────────────────────────────────────────────────── */}
        {canEnterSpending && (
          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Finance
            </h3>
            <div className="max-w-xs">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total Spendings (BDT)
              </label>
              <input
                type="number"
                name="total_spendings"
                value={form.total_spendings}
                onChange={handleChange}
                min="0"
                step="0.01"
                placeholder="0.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </section>
        )}

        {/* ── PDF Report ────────────────────────────────────────────────── */}
        <section>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Report
          </h3>
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Project / Event Report (PDF)
            </label>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setPdfFile(e.target.files[0] ?? null)}
              className="block text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:bg-green-100 file:text-green-700 file:font-medium hover:file:bg-green-200"
            />
            {pdfFile && (
              <p className="mt-2 text-xs text-green-700">✓ {pdfFile.name}</p>
            )}
            <p className="mt-1 text-xs text-amber-600">
              ⚠ A PDF report is <strong>mandatory</strong> before marking this activity as Completed.
            </p>
          </div>
        </section>

        {/* ── Remarks ───────────────────────────────────────────────────── */}
        <section>
          <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
          <textarea
            name="remarks"
            value={form.remarks}
            onChange={handleChange}
            rows={3}
            placeholder="Additional notes..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </section>

        {/* ── Actions ───────────────────────────────────────────────────── */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
          >
            {loading ? "Creating..." : "Create Activity"}
          </button>
        </div>
      </form>
    </div>
  );
}
