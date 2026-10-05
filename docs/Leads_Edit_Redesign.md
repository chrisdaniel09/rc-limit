# The current layout suffers from three main UX issues: vertical scrolling overload, fragmented state updates (4 separate "Save"/"Record" buttons), and lack of visual hierarchy for the conversion requirements.

# Here is a streamlined redesign using a Wider Two-Column Grid with a Header Checklist Banner and a Unified Footer Action Bar.

# Key Improvements in the Redesign
## 1. Header Qualification Pipeline: Replaces the yellow text box with dynamic visual badges showing the real-time status of CIBIL Check, RC Check, and Lead Qualification.

## 2. 2-Column Layout (max-w-4xl): Moves Assignment & Lead Metadata to the left panel, and Verification Checks (CIBIL & RC) to the right panel. Eliminates vertical scrolling entirely.

## 3. Unified Form Submission: Eliminates the multiple "Save" / "Record" buttons inside individual sections in favor of direct state editing and a single "Save Draft" or "Convert to Customer" action bar at the bottom.

## 4. Gated Conversion Footer: The "Convert to Customer" CTA dynamically unlocks with clear visual guidance when all criteria are met.

```Typescrip
import React, { useState } from 'react';
import { X, CheckCircle2, XCircle, Clock, ArrowRight, ShieldCheck } from 'lucide-react';

interface Lead {
  id: string;
  applicantName: string;
  assignedTo: string;
  status: string;
  cibilStatus: 'PASSED' | 'FAILED' | 'PENDING';
  cibilScore: number | '';
  cibilRemarks: string;
  rcStatus: 'PASSED' | 'FAILED' | 'PENDING';
  rcRemarks: string;
}

export const LeadEditModal = ({ lead, onClose, onSave, onConvert }: any) => {
  const [formData, setFormData] = useState<Lead>({ ...lead });

  const isCibilPassed = formData.cibilStatus === 'PASSED';
  const isRcPassed = formData.rcStatus === 'PASSED';
  const isQualified = formData.status === 'QUALIFIED';
  const canConvert = isCibilPassed && isRcPassed && isQualified;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl rounded-xl bg-white shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        
        {/* 1. MODAL HEADER & PIPELINE TRACKER */}
        <div className="border-b bg-gray-50/80 px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Lead: {formData.applicantName}</h2>
              <p className="text-xs text-gray-500">Manage assignment, complete verifications, and transition lead.</p>
            </div>
            <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Qualification Requirement Checklist Banner */}
          <div className="grid grid-cols-3 gap-3 bg-white p-3 rounded-lg border border-gray-200">
            <div className="flex items-center space-x-2 text-xs font-medium">
              {isCibilPassed ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-rose-500" />}
              <span className="text-gray-600">CIBIL Check:</span>
              <span className={isCibilPassed ? 'text-emerald-700 font-semibold' : 'text-rose-600 font-semibold'}>
                {formData.cibilStatus} {formData.cibilScore && `(${formData.cibilScore})`}
              </span>
            </div>

            <div className="flex items-center space-x-2 text-xs font-medium">
              {isRcPassed ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Clock className="h-4 w-4 text-amber-500" />}
              <span className="text-gray-600">RC Check:</span>
              <span className={isRcPassed ? 'text-emerald-700 font-semibold' : 'text-amber-600 font-semibold'}>
                {formData.rcStatus}
              </span>
            </div>

            <div className="flex items-center space-x-2 text-xs font-medium">
              {isQualified ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Clock className="h-4 w-4 text-gray-400" />}
              <span className="text-gray-600">Status:</span>
              <span className={isQualified ? 'text-emerald-700 font-semibold' : 'text-gray-700 font-semibold'}>
                {formData.status}
              </span>
            </div>
          </div>
        </div>

        {/* 2. TWO-COLUMN MAIN BODY */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 overflow-y-auto">
          
          {/* LEFT COLUMN: Assignment & Metadata */}
          <div className="space-y-5">
            <div className="border rounded-lg p-4 bg-gray-50/50 space-y-4">
              <h3 className="text-sm font-semibold text-gray-800 border-b pb-2 flex items-center">
                <ShieldCheck className="h-4 w-4 mr-2 text-indigo-600" /> Lead Overview & Assignment
              </h3>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Assign Lead To</label>
                <select
                  name="assignedTo"
                  value={formData.assignedTo}
                  onChange={handleChange}
                  className="w-full rounded-md border border-gray-300 bg-white p-2 text-sm focus:border-indigo-500 focus:outline-none"
                >
                  <option value="Admin User">Admin User</option>
                  <option value="Field Agent 1">Field Agent 1</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Lead Lifecycle Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full rounded-md border border-gray-300 bg-white p-2 text-sm focus:border-indigo-500 focus:outline-none"
                >
                  <option value="NEW">NEW</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="QUALIFIED">QUALIFIED</option>
                  <option value="REJECTED">REJECTED</option>
                </select>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Verification Checks Hub */}
          <div className="space-y-5">
            
            {/* CIBIL Check Box */}
            <div className="border rounded-lg p-4 bg-white shadow-sm space-y-3">
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className="text-sm font-semibold text-gray-800">CIBIL Verification</h3>
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${isCibilPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                  {formData.cibilStatus}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select
                    name="cibilStatus"
                    value={formData.cibilStatus}
                    onChange={handleChange}
                    className="w-full rounded-md border border-gray-300 p-1.5 text-xs focus:border-indigo-500"
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="PASSED">PASSED</option>
                    <option value="FAILED">FAILED</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">CIBIL Score</label>
                  <input
                    type="number"
                    name="cibilScore"
                    value={formData.cibilScore}
                    onChange={handleChange}
                    placeholder="e.g. 750"
                    className="w-full rounded-md border border-gray-300 p-1.5 text-xs focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Remarks</label>
                <textarea
                  name="cibilRemarks"
                  value={formData.cibilRemarks}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Notes on credit history..."
                  className="w-full rounded-md border border-gray-300 p-1.5 text-xs focus:border-indigo-500"
                />
              </div>
            </div>

            {/* RC Check Box */}
            <div className="border rounded-lg p-4 bg-white shadow-sm space-y-3">
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className="text-sm font-semibold text-gray-800">RC Verification</h3>
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${isRcPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {formData.rcStatus}
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                <select
                  name="rcStatus"
                  value={formData.rcStatus}
                  onChange={handleChange}
                  className="w-full rounded-md border border-gray-300 p-1.5 text-xs focus:border-indigo-500"
                >
                  <option value="PENDING">PENDING</option>
                  <option value="PASSED">PASSED</option>
                  <option value="FAILED">FAILED</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Remarks</label>
                <textarea
                  name="rcRemarks"
                  value={formData.rcRemarks}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Notes on vehicle ownership/hypothecation..."
                  className="w-full rounded-md border border-gray-300 p-1.5 text-xs focus:border-indigo-500"
                />
              </div>
            </div>

          </div>
        </div>

        {/* 3. UNIFIED ACTION FOOTER */}
        <div className="border-t bg-gray-50 px-6 py-3 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-800 rounded-md border border-gray-300 bg-white"
          >
            Cancel
          </button>

          <div className="flex space-x-3">
            <button
              onClick={() => onSave(formData)}
              className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm"
            >
              Save Changes
            </button>

            <button
              disabled={!canConvert}
              onClick={() => onConvert(formData)}
              className={`px-4 py-2 text-xs font-semibold rounded-md shadow-sm flex items-center ${
                canConvert
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Convert to Customer <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

```