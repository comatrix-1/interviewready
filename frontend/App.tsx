
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  ResumeSchema, 
  AppState, 
  PipelineStep, 
  GapReport, 
  OptimizationSuggestion, 
  InterviewMessage 
} from './types';
import { 
  ExtractorAgent, 
  ScorerAgent, 
  OptimizerAgent, 
  InterviewerAgent, 
  ValidatorAgent 
} from './services/geminiService';
import WorkflowStepper from './components/WorkflowStepper';
import ResumeManager from './components/ResumeManager';
import JobMatch from './components/JobMatch';
import OptimizationView from './components/OptimizationView';
import InterviewView from './components/InterviewView';
import { Layout, FileText, Target, Sparkles, MessageSquare, Save } from 'lucide-react';

const STORAGE_KEY = 'career_copilot_state_v1';

const App: React.FC = () => {
  console.log('App()')
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Check for stale resumes (3 months = ~7.8e9 ms)
      const now = Date.now();
      const threeMonths = 90 * 24 * 60 * 60 * 1000;
      parsed.isStale = parsed.resumes.some((r: ResumeSchema) => (now - r.timestamp) > threeMonths);
      return parsed;
    }
    return {
      resumes: [],
      selectedResumeId: null,
      currentJD: '',
      currentStep: PipelineStep.IDLE,
      gapReport: null,
      suggestions: [],
      interviewHistory: [],
      isStale: false
    };
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Persistence
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const handleUploadResume = async (text: string) => {
    setLoading(true);
    setError(null);
    try {
      const extracted = await ExtractorAgent(text);
      setState(prev => ({
        ...prev,
        resumes: [extracted, ...prev.resumes],
        selectedResumeId: extracted.id,
        currentStep: PipelineStep.IDLE
      }));
    } catch (err) {
      setError('Failed to extract resume. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartAnalysis = async () => {
    if (!state.selectedResumeId || !state.currentJD) return;
    
    setLoading(true);
    setState(prev => ({ ...prev, currentStep: PipelineStep.SCORING }));
    
    try {
      const resume = state.resumes.find(r => r.id === state.selectedResumeId);
      if (!resume) throw new Error("Resume not found");
      
      const report = await ScorerAgent(resume, state.currentJD);
      setState(prev => ({ 
        ...prev, 
        gapReport: report, 
        currentStep: PipelineStep.AWAITING_ANALYSIS_CONFIRMATION 
      }));
    } catch (err) {
      setError('Analysis failed. Please check your inputs.');
      setState(prev => ({ ...prev, currentStep: PipelineStep.IDLE }));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAnalysis = async () => {
    setLoading(true);
    setState(prev => ({ ...prev, currentStep: PipelineStep.OPTIMIZING }));
    
    try {
      const resume = state.resumes.find(r => r.id === state.selectedResumeId)!;
      const suggestions = await OptimizerAgent(resume, state.gapReport!);
      
      // Validator HITL check
      const validatedSuggestions = await Promise.all(suggestions.map(async (s) => {
        const isValid = await ValidatorAgent(s.suggestedBullet, JSON.stringify(resume.experience));
        return isValid ? s : { ...s, reasoning: `[SYSTEM WARNING: Low Grounding Confidence] ${s.reasoning}` };
      }));

      setState(prev => ({ 
        ...prev, 
        suggestions: validatedSuggestions, 
        currentStep: PipelineStep.AWAITING_EDIT_REVIEW 
      }));
    } catch (err) {
      setError('Optimization failed.');
      setState(prev => ({ ...prev, currentStep: PipelineStep.AWAITING_ANALYSIS_CONFIRMATION }));
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionAction = (id: string, approved: boolean) => {
    setState(prev => ({
      ...prev,
      suggestions: prev.suggestions.map(s => 
        s.id === id ? { ...s, status: approved ? 'approved' : 'rejected' } : s
      )
    }));
  };

  const handleStartInterview = async () => {
    setLoading(true);
    setState(prev => ({ ...prev, currentStep: PipelineStep.INTERVIEWING, interviewHistory: [] }));
    
    try {
      const firstQuestion = await InterviewerAgent([], state.gapReport!);
      setState(prev => ({
        ...prev,
        interviewHistory: [{ role: 'assistant', content: firstQuestion }]
      }));
    } catch (err) {
      setError('Failed to start interview.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendInterviewMessage = async (msg: string) => {
    const newUserMsg: InterviewMessage = { role: 'user', content: msg };
    const updatedHistory = [...state.interviewHistory, newUserMsg];
    
    setState(prev => ({ ...prev, interviewHistory: updatedHistory }));
    setLoading(true);

    try {
      const nextQuestion = await InterviewerAgent(updatedHistory, state.gapReport!);
      setState(prev => ({
        ...prev,
        interviewHistory: [...updatedHistory, { role: 'assistant', content: nextQuestion }]
      }));
    } catch (err) {
      setError('Interview engine error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
              <Sparkles size={24} />
            </div>
            <div>
              <h1 className="font-bold text-lg text-slate-800 tracking-tight">Career Co-Pilot</h1>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Multi-Agent System</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
             {state.isStale && (
               <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                 STALE RESUMES DETECTED
               </span>
             )}
             <button 
                onClick={() => { localStorage.removeItem(STORAGE_KEY); window.location.reload(); }}
                className="text-slate-400 hover:text-red-500 transition-colors"
                title="Reset Session"
             >
               <Save size={20} />
             </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Sidebar: Workflow & Status */}
        <div className="lg:col-span-3 space-y-6">
          <WorkflowStepper currentStep={state.currentStep} />
          
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">System State</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Resume:</span>
                <span className="font-medium text-slate-800">
                  {state.selectedResumeId ? state.resumes.find(r => r.id === state.selectedResumeId)?.name : 'None'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">JD Length:</span>
                <span className="font-medium text-slate-800">
                  {state.currentJD ? `${state.currentJD.length} chars` : '0'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Main Workflow Area */}
        <div className="lg:col-span-9 space-y-8">
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex justify-between items-center">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="font-bold">&times;</button>
            </div>
          )}

          {/* Step-based Views */}
          {state.currentStep === PipelineStep.IDLE && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <ResumeManager 
                resumes={state.resumes} 
                selectedId={state.selectedResumeId}
                onSelect={(id) => setState(p => ({ ...p, selectedResumeId: id }))}
                onUpload={handleUploadResume}
                loading={loading}
              />
              <JobMatch 
                jd={state.currentJD}
                onChange={(val) => setState(p => ({ ...p, currentJD: val }))}
                onStart={handleStartAnalysis}
                canStart={!!state.selectedResumeId && !!state.currentJD}
                loading={loading}
              />
            </div>
          )}

          {state.currentStep === PipelineStep.AWAITING_ANALYSIS_CONFIRMATION && state.gapReport && (
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 animate-in zoom-in-95 duration-500">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Gap Analysis Complete</h2>
                  <p className="text-slate-500">Validator confirmed integrity. Review the diagnostic report.</p>
                </div>
                <div className="bg-indigo-600 text-white w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-xl shadow-lg shadow-indigo-200">
                  {state.gapReport.overallScore}%
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <h4 className="font-bold text-emerald-800 flex items-center gap-2 mb-3">
                    <Target size={18} /> Matching Strengths
                  </h4>
                  <ul className="space-y-2">
                    {state.gapReport.matchingSkills.map(s => (
                      <li key={s} className="text-sm text-emerald-700 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span> {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-6 bg-rose-50 rounded-2xl border border-rose-100">
                  <h4 className="font-bold text-rose-800 flex items-center gap-2 mb-3">
                    <FileText size={18} /> Identified Gaps
                  </h4>
                  <ul className="space-y-2">
                    {state.gapReport.missingSkills.map(s => (
                      <li key={s} className="text-sm text-rose-700 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-rose-400 rounded-full"></span> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={handleConfirmAnalysis}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                >
                  <Sparkles size={20} /> Proceed to Resume Optimization
                </button>
                <button 
                  onClick={() => setState(p => ({ ...p, currentStep: PipelineStep.IDLE }))}
                  className="px-8 border border-slate-200 hover:bg-slate-50 font-bold text-slate-600 rounded-2xl transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {state.currentStep === PipelineStep.AWAITING_EDIT_REVIEW && (
            <OptimizationView 
              suggestions={state.suggestions}
              onAction={handleSuggestionAction}
              onFinalize={handleStartInterview}
              loading={loading}
            />
          )}

          {state.currentStep === PipelineStep.INTERVIEWING && (
            <InterviewView 
              history={state.interviewHistory}
              onSend={handleSendInterviewMessage}
              onClose={() => setState(p => ({ ...p, currentStep: PipelineStep.IDLE }))}
              loading={loading}
            />
          )}

          {loading && state.currentStep !== PipelineStep.INTERVIEWING && (
            <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-indigo-800 font-bold animate-pulse text-lg">Agents are processing state...</p>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default App;
