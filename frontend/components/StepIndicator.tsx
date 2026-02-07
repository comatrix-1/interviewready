
import React from 'react';
import { WorkflowStatus } from '../types';

interface StepIndicatorProps {
  currentStatus: WorkflowStatus;
}

const steps = [
  { status: WorkflowStatus.IDLE, label: 'Upload' },
  { status: WorkflowStatus.CRITIQUING, label: 'Critic' },
  { status: WorkflowStatus.ANALYZING_CONTENT, label: 'Content' },
  { status: WorkflowStatus.ALIGNING_JD, label: 'Alignment' },
  { status: WorkflowStatus.INTERVIEWING, label: 'Interview' },
];

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStatus }) => {
  const getStepIndex = (status: WorkflowStatus) => {
    if (status === WorkflowStatus.AWAITING_CRITIC_APPROVAL) return 1;
    if (status === WorkflowStatus.AWAITING_CONTENT_APPROVAL) return 2;
    if (status === WorkflowStatus.AWAITING_ALIGNMENT_APPROVAL) return 3;
    if (status === WorkflowStatus.COMPLETED) return 4;
    return steps.findIndex(s => s.status === status);
  };

  const currentIndex = getStepIndex(currentStatus);

  return (
    <div className="flex items-center justify-between w-full max-w-4xl mx-auto px-4 py-8">
      {steps.map((step, idx) => {
        const isActive = idx <= currentIndex;
        const isCurrent = idx === currentIndex;
        
        return (
          <div key={step.label} className="flex flex-col items-center relative flex-1">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
              isCurrent ? 'border-blue-600 bg-blue-50 text-blue-600 scale-110 z-10' : 
              isActive ? 'border-blue-600 bg-blue-600 text-white' : 
              'border-slate-300 bg-white text-slate-400'
            }`}>
              {isActive && !isCurrent && idx < currentIndex ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              ) : (
                <span className="text-sm font-semibold">{idx + 1}</span>
              )}
            </div>
            <span className={`mt-2 text-xs font-medium uppercase tracking-wider ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>
              {step.label}
            </span>
            {idx < steps.length - 1 && (
              <div className={`absolute top-5 left-[50%] w-full h-0.5 -z-0 transition-colors duration-300 ${idx < currentIndex ? 'bg-blue-600' : 'bg-slate-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
};
