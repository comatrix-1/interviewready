
import React, { useRef } from 'react';
import { ResumeSchema } from '../types';
import { Upload, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';

interface Props {
  resumes: ResumeSchema[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onUpload: (text: string) => void;
  loading: boolean;
}

const ResumeManager: React.FC<Props> = ({ resumes, selectedId, onSelect, onUpload, loading }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        onUpload(ev.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const isStale = (ts: number) => {
    return (Date.now() - ts) > (90 * 24 * 60 * 60 * 1000);
  };

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <FileText className="text-indigo-600" /> Resume Store
        </h3>
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
        >
          <Upload size={16} /> New Upload
        </button>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".txt,.md" />
      </div>

      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {resumes.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-3xl">
            <p className="text-slate-400 text-sm">No resumes uploaded yet.</p>
          </div>
        ) : (
          resumes.map(r => (
            <div 
              key={r.id}
              onClick={() => onSelect(r.id)}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                selectedId === r.id 
                  ? 'border-indigo-600 bg-indigo-50/30' 
                  : 'border-slate-50 hover:border-slate-200 bg-slate-50/50'
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="font-bold text-slate-800 text-sm truncate max-w-[150px]">{r.name}</span>
                {selectedId === r.id && <CheckCircle2 size={16} className="text-indigo-600" />}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase">
                  {new Date(r.timestamp).toLocaleDateString()}
                </span>
                {isStale(r.timestamp) && (
                  <div className="flex items-center gap-1 text-[10px] text-amber-600 font-bold uppercase">
                    <AlertTriangle size={10} /> Stale
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ResumeManager;
