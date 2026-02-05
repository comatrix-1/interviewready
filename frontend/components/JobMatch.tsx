
import React from 'react';
import { Target, Play } from 'lucide-react';

interface Props {
  jd: string;
  onChange: (val: string) => void;
  onStart: () => void;
  canStart: boolean;
  loading: boolean;
}

const JobMatch: React.FC<Props> = ({ jd, onChange, onStart, canStart, loading }) => {
  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col">
      <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-6">
        <Target className="text-indigo-600" /> Target Job
      </h3>
      
      <textarea
        value={jd}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste the target job description here..."
        className="flex-1 min-h-[250px] p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none mb-6"
      ></textarea>

      <button
        onClick={onStart}
        disabled={!canStart || loading}
        className={`w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg ${
          canStart && !loading
            ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'
            : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
        }`}
      >
        {loading ? 'Processing...' : <><Play size={18} fill="currentColor" /> Run Match Analysis</>}
      </button>
    </div>
  );
};

export default JobMatch;
