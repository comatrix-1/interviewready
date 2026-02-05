
import React from 'react';
import { OptimizationSuggestion } from '../types';
import { Check, X, Sparkles, BrainCircuit, ArrowRight } from 'lucide-react';

interface Props {
  suggestions: OptimizationSuggestion[];
  onAction: (id: string, approved: boolean) => void;
  onFinalize: () => void;
  loading: boolean;
}

const OptimizationView: React.FC<Props> = ({ suggestions, onAction, onFinalize, loading }) => {
  const pendingCount = suggestions.filter(s => s.status === 'pending').length;

  return (
    <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Optimizer Agent Feedback</h2>
          <p className="text-slate-500">Review suggested rewrites and approve them for your new resume.</p>
        </div>
        <button 
          onClick={onFinalize}
          disabled={pendingCount > 0 || loading}
          className={`px-8 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${
            pendingCount === 0 
              ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          Finalize & Interview <ArrowRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {suggestions.map((s) => (
          <div 
            key={s.id} 
            className={`bg-white p-6 rounded-3xl border-2 transition-all shadow-sm ${
              s.status === 'approved' ? 'border-emerald-500 bg-emerald-50/10' :
              s.status === 'rejected' ? 'border-rose-100 opacity-60' :
              'border-slate-100'
            }`}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Original Context</span>
                <p className="text-slate-600 text-sm leading-relaxed italic">"{s.originalBullet}"</p>
              </div>
              <div className="relative">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block mb-2">Optimized Suggestion</span>
                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                  <p className="text-slate-800 text-sm font-bold leading-relaxed">{s.suggestedBullet}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-50 pt-4">
              <div className="flex items-center gap-2 text-slate-500">
                <BrainCircuit size={16} />
                <span className="text-xs font-medium italic">{s.reasoning}</span>
              </div>
              
              {s.status === 'pending' ? (
                <div className="flex gap-2">
                  <button 
                    onClick={() => onAction(s.id, false)}
                    className="p-3 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 transition-all"
                  >
                    <X size={20} />
                  </button>
                  <button 
                    onClick={() => onAction(s.id, true)}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                  >
                    <Check size={20} /> Approve Suggestion
                  </button>
                </div>
              ) : (
                <span className={`text-xs font-bold uppercase ${s.status === 'approved' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {s.status === 'approved' ? 'Merged to State' : 'Rejected'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OptimizationView;
