import React from "react";
import type { SavedResume } from "../../types/resume";

interface UploadStepProps {
  savedResumes: SavedResume[];
  selectedResumeId: string | null;
  isUploading: boolean;
  isLoadingResumes: boolean;
  onSelectResume: (resumeId: string) => void;
  onUploadSubmit: (file: File) => Promise<void>; // parse -> save -> analyze
  onAnalyzeResume: () => Promise<void>; // analyze the selected saved resume
  // Existing manual-JSON props (unchanged):
  manualResumeText: string;
  manualResumeError?: string | null;
  onManualResumeChange: (value: string) => void;
  onManualSubmit: () => void;
}

export const UploadStep: React.FC<UploadStepProps> = ({
  savedResumes,
  selectedResumeId,
  isUploading,
  isLoadingResumes,
  onSelectResume,
  onUploadSubmit,
  onAnalyzeResume,
  manualResumeText,
  manualResumeError,
  onManualResumeChange,
  onManualSubmit,
}) => {
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset the input so picking the same file again re-fires onChange (e.g. to
    // retry after a failed parse/save).
    e.target.value = "";
    void onUploadSubmit(file);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-400">
      <div className="mb-8">
        <h3 className="text-xl font-semibold text-slate-900 mb-1.5">Resume Discovery</h3>
        <p className="text-[13px] text-slate-500 leading-relaxed">
          Select a saved resume or upload a PDF. Analysis only runs when you trigger it.
        </p>
      </div>

      <div className="mb-6">
        <label
          htmlFor="saved-resume-select"
          className="text-[11px] font-bold text-slate-500 uppercase tracking-widest"
        >
          Saved resume
        </label>
        <select
          id="saved-resume-select"
          value={selectedResumeId ?? ""}
          onChange={(e) => onSelectResume(e.target.value)}
          disabled={isLoadingResumes}
          className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:opacity-50"
        >
          <option value="" disabled>
            {isLoadingResumes ? "Loading saved resumes..." : "Select a saved resume"}
          </option>
          {savedResumes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.filename}
            </option>
          ))}
        </select>
        {savedResumes.length === 0 && !isLoadingResumes && (
          <p className="mt-2 text-[11px] text-slate-400">
            No saved resumes yet — upload a PDF below to save one.
          </p>
        )}
      </div>

      <label className="flex flex-col items-center justify-center border border-slate-200 rounded-xl p-12 cursor-pointer hover:bg-slate-50/50 hover:border-slate-300 transition-all group">
        <div className="w-12 h-12 bg-white border border-slate-100 rounded-lg flex items-center justify-center mb-4 shadow-sm group-hover:scale-105 transition-transform">
          <svg
            className="w-6 h-6 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            ></path>
          </svg>
        </div>
        <span className="text-xs font-semibold text-slate-900 mb-1">Upload Resume</span>
        <span className="text-[11px] text-slate-400">PDF, TXT, or MD up to 10MB</span>
        <input type="file" className="hidden" onChange={handleUpload} accept=".pdf,.txt,.md" />
      </label>

      <div className="mt-6">
        <button
          onClick={() => void onAnalyzeResume()}
          disabled={!selectedResumeId || isUploading || isLoadingResumes}
          className="w-full bg-slate-900 text-white text-[12px] font-semibold py-3 rounded-lg shadow-sm hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-all"
        >
          Analyze Resume
        </button>
      </div>

      {manualResumeText && (
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
              Manual Resume JSON
            </h4>
          </div>
          <textarea
            value={manualResumeText}
            onChange={(e) => onManualResumeChange(e.target.value)}
            rows={10}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-mono text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
            placeholder="Paste edited resume JSON here..."
          />
          {manualResumeError && <div className="text-[11px] text-red-600">{manualResumeError}</div>}
          <button
            onClick={onManualSubmit}
            className="w-full bg-slate-900 text-white text-[12px] font-semibold py-2.5 rounded-lg shadow-sm hover:bg-slate-800 transition-all"
          >
            Analyze Manual Resume
          </button>
        </div>
      )}
    </div>
  );
};
