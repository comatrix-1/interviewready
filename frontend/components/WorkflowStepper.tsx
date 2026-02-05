
import React from 'react';
import { PipelineStep } from '../types';
import { CheckCircle2, Circle, Clock } from 'lucide-react';

interface Props {
  currentStep: PipelineStep;
}

const WorkflowStepper: React.FC<Props> = ({ currentStep }) => {
  const steps = [
    { label: 'Data Input', step: PipelineStep.IDLE },
    { label: 'Analysis', step: PipelineStep.AWAITING_ANALYSIS_CONFIRMATION },
    { label: 'Optimization', step: PipelineStep.AWAITING_EDIT_REVIEW },
    { label: 'Mock Interview', step: PipelineStep.INTERVIEWING },
  ];

  const getStepStatus = (index: number) => {
    const currentIndex = steps.findIndex(s => s.step === currentStep);
    if (index < currentIndex) return 'completed';
    if (index === currentIndex) return 'active';
    return 'pending';
  };

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
      <h3 className="text-sm font-bold text-slate-400 uppercase mb-6">Workflow Pipeline</h3>
      <div className="space-y-6">
        {steps.map((s, idx) => {
          const status = getStepStatus(idx);
          return (
            <div key={s.label} className="flex items-start gap-3 relative">
              {idx !== steps.length - 1 && (
                <div className={`absolute left-3 top-7 w-[2px] h-10 ${status === 'completed' ? 'bg-indigo-600' : 'bg-slate-100'}`}></div>
              )}
              <div className={`mt-1 transition-colors duration-500 ${
                status === 'completed' ? 'text-indigo-600' : 
                status === 'active' ? 'text-indigo-400 animate-pulse' : 'text-slate-200'
              }`}>
                {status === 'completed' ? <CheckCircle2 size={24} fill="currentColor" className="text-white" /> : 
                 status === 'active' ? <Clock size={24} /> : <Circle size={24} />}
              </div>
              <div className="flex flex-col">
                <span className={`text-sm font-bold ${status === 'active' ? 'text-indigo-600' : status === 'completed' ? 'text-slate-700' : 'text-slate-400'}`}>
                  {s.label}
                </span>
                <span className="text-[10px] text-slate-400 uppercase font-medium">
                  {status === 'active' ? 'Currently Running' : status === 'completed' ? 'Agent Finalized' : 'Queued'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WorkflowStepper;
