import React, { useState } from 'react';
import { ResumeSchema } from '../../types';

export const UploadStep: React.FC<{
  onUploadSubmit: (file: File | null) => void; // null = use manual resume from preview panel
  manualResumeText: string;
  manualResumeError?: string | null;
  onManualResumeChange: (value: string) => void;
  onManualSubmit: () => void;
}> = ({
  onUploadSubmit,
  manualResumeText,
  manualResumeError,
  onManualResumeChange,
  onManualSubmit,
}) => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    onUploadSubmit(file);
  };

  const handleDeleteFile = () => {
    setUploadedFile(null);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-400">
      <div className="mb-8">
        <h3 className="text-xl font-semibold text-slate-900 mb-1.5">
          Resume Discovery
        </h3>
        <p className="text-[13px] text-slate-500 leading-relaxed">
          Upload a resume or use your edited resume preview. Analysis only runs
          when you trigger it.
        </p>
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
        <span className="text-xs font-semibold text-slate-900 mb-1">
          Upload Resume
        </span>
        <span className="text-[11px] text-slate-400">
          PDF, TXT, or MD up to 10MB
        </span>
        <input
          type="file"
          className="hidden"
          onChange={handleUpload}
          accept=".pdf,.txt,.md"
        />
      </label>

      {uploadedFile && (
        <div className="mt-4 flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
          <span className="text-[12px] text-slate-700 font-medium truncate">
            {uploadedFile.name}
          </span>
          <button
            onClick={handleDeleteFile}
            className="text-[11px] text-red-500 hover:text-red-700 font-semibold"
          >
            Remove
          </button>
        </div>
      )}

      {/* CTA - only show when no file uploaded */}
      {!uploadedFile && (
        <div className="mt-6">
          <button
            onClick={() => onUploadSubmit(null)}
            className="w-full bg-slate-900 text-white text-[12px] font-semibold py-3 rounded-lg shadow-sm hover:bg-slate-800 transition-all"
          >
            Analyze Resume
          </button>
        </div>
      )}

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
          {manualResumeError && (
            <div className="text-[11px] text-red-600">{manualResumeError}</div>
          )}
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
