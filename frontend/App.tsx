
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  SharedState, 
  WorkflowStatus, 
  ResumeSchema, 
  StructuralAssessment, 
  ContentAnalysisReport, 
  AlignmentReport 
} from './types';
import { 
  extractorAgent, 
  resumeCriticAgent, 
  contentStrengthAgent, 
  alignmentAgent, 
  interviewCoachAgent 
} from './geminiService';
import { StepIndicator } from './components/StepIndicator';

const App: React.FC = () => {
  const [state, setState] = useState<SharedState>(() => {
    const saved = localStorage.getItem('interview_ready_state');
    if (saved) return JSON.parse(saved);
    return {
      currentResume: null,
      history: [],
      jobDescription: '',
      status: WorkflowStatus.IDLE,
      criticReport: null,
      contentReport: null,
      alignmentReport: null,
      interviewHistory: []
    };
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Persistence
  useEffect(() => {
    localStorage.setItem('interview_ready_state', JSON.stringify(state));
  }, [state]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [state.interviewHistory]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  // Actions
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    try {
      if (file.type === 'application/pdf') {
        const base64 = await fileToBase64(file);
        const schema = await extractorAgent({ data: base64, mimeType: file.type });
        processExtractedResume(schema);
      } else {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const text = event.target?.result as string;
          const schema = await extractorAgent(text);
          processExtractedResume(schema);
        };
        reader.readAsText(file);
      }
    } catch (err: any) {
      setError(err.message || "Failed to process resume");
    } finally {
      setIsLoading(false);
    }
  };

  const processExtractedResume = (schema: ResumeSchema) => {
    setState(prev => ({ 
      ...prev, 
      currentResume: schema, 
      history: [...prev.history, schema],
      status: WorkflowStatus.CRITIQUING 
    }));
    runCritic(schema);
  };

  const runCritic = async (resume: ResumeSchema) => {
    setIsLoading(true);
    try {
      const report = await resumeCriticAgent(resume);
      setState(prev => ({ 
        ...prev, 
        criticReport: report, 
        status: WorkflowStatus.AWAITING_CRITIC_APPROVAL 
      }));
    } catch (err: any) {
      setError("Critic Agent failed: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const approveCritic = async () => {
    setState(prev => ({ ...prev, status: WorkflowStatus.ANALYZING_CONTENT }));
    setIsLoading(true);
    try {
      const report = await contentStrengthAgent(state.currentResume!);
      setState(prev => ({ 
        ...prev, 
        contentReport: report, 
        status: WorkflowStatus.AWAITING_CONTENT_APPROVAL 
      }));
    } catch (err: any) {
      setError("Content Agent failed: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const approveContent = () => {
    setState(prev => ({ ...prev, status: WorkflowStatus.ALIGNING_JD }));
  };

  const runAlignment = async () => {
    if (!state.jobDescription) return;
    setIsLoading(true);
    try {
      const report = await alignmentAgent(state.currentResume!, state.jobDescription);
      setState(prev => ({ 
        ...prev, 
        alignmentReport: report, 
        status: WorkflowStatus.AWAITING_ALIGNMENT_APPROVAL 
      }));
    } catch (err: any) {
      setError("Alignment Agent failed: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const startInterview = async () => {
    setState(prev => ({ ...prev, status: WorkflowStatus.INTERVIEWING }));
    const firstMsg = "Hi! I'm your Interview Coach. I've analyzed your resume against the job description. Are you ready to start the mock interview?";
    setState(prev => ({
      ...prev,
      interviewHistory: [{ role: 'agent', text: firstMsg }]
    }));
  };

  const handleInterviewMessage = async (msg: string) => {
    const updatedHistory = [...state.interviewHistory, { role: 'user' as const, text: msg }];
    setState(prev => ({ ...prev, interviewHistory: updatedHistory }));
    setIsLoading(true);
    try {
      const responseText = await interviewCoachAgent(state.alignmentReport!, updatedHistory);
      setState(prev => ({
        ...prev,
        interviewHistory: [...updatedHistory, { role: 'agent', text: responseText }]
      }));
    } catch (err: any) {
      setError("Interview Coach failed: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const isStale = (timestamp: string) => {
    const months = (new Date().getTime() - new Date(timestamp).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    return months > 3;
  };

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">IR</div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">InterviewReady</h1>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => { localStorage.clear(); window.location.reload(); }}
              className="text-xs text-slate-500 hover:text-red-600 transition-colors uppercase font-bold tracking-widest"
            >
              Reset Session
            </button>
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
          </div>
        </div>
      </header>

      {/* Progress */}
      <StepIndicator currentStatus={state.status} />

      <main className="max-w-4xl mx-auto px-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 flex items-center gap-3">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {/* Dynamic Workflow Area */}
        <div className="space-y-8">
          
          {/* STEP 1: UPLOAD */}
          {state.status === WorkflowStatus.IDLE && (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center transition-all hover:border-blue-400">
              <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
              </div>
              <h2 className="text-2xl font-bold mb-2">Upload Your Resume</h2>
              <p className="text-slate-500 mb-8 max-w-sm mx-auto">Upload your resume as a PDF or text file to start the AI analysis and optimization process.</p>
              <label className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-semibold cursor-pointer transition-all inline-flex items-center gap-2">
                {isLoading ? 'Processing...' : 'Choose File'}
                <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.txt,.md" />
              </label>
            </div>
          )}

          {/* LOADING STATE */}
          {isLoading && state.status !== WorkflowStatus.INTERVIEWING && (
            <div className="flex flex-col items-center py-12">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-slate-600 font-medium animate-pulse">Our agents are processing your data...</p>
            </div>
          )}

          {/* STEP 2: CRITIC REVIEW */}
          {state.status === WorkflowStatus.AWAITING_CRITIC_APPROVAL && state.criticReport && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold">Resume Structural Assessment</h2>
                  <p className="text-slate-500 text-sm">ResumeCriticAgent evaluation of your formatting & clarity.</p>
                </div>
                <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-xl text-xl font-black">
                  {state.criticReport.score}/100
                </div>
              </div>
              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Readability</h3>
                  <p className="text-lg font-medium text-slate-800">{state.criticReport.readability}</p>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Formatting Recommendations</h3>
                  <ul className="space-y-2">
                    {state.criticReport.formattingRecommendations.map((rec, i) => (
                      <li key={i} className="flex gap-2 text-slate-600 text-sm">
                        <span className="text-blue-500">•</span> {rec}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="md:col-span-2 bg-slate-50 p-6 rounded-2xl">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Key Suggestions</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {state.criticReport.suggestions.map((s, i) => (
                      <div key={i} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-sm text-slate-700">
                        {s}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-6 bg-slate-50 flex justify-end gap-3">
                <button className="px-6 py-3 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition-all">Reject Changes</button>
                <button onClick={approveCritic} className="px-10 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-200 transition-all">Approve & Continue</button>
              </div>
            </div>
          )}

          {/* STEP 3: CONTENT REVIEW */}
          {state.status === WorkflowStatus.AWAITING_CONTENT_APPROVAL && state.contentReport && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="p-8 border-b border-slate-100">
                <h2 className="text-2xl font-bold">Content Strength Analysis</h2>
                <p className="text-slate-500 text-sm">Analyzing achievements using STAR/XYZ methodology.</p>
              </div>
              <div className="p-8 space-y-8">
                <div className="flex items-center gap-6">
                   <div className="flex-1">
                      <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500" style={{ width: `${state.contentReport.quantifiedImpactScore}%` }}></div>
                      </div>
                      <p className="mt-2 text-sm font-bold text-slate-500">Quantified Impact Score: <span className="text-green-600">{state.contentReport.quantifiedImpactScore}%</span></p>
                   </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 rounded-2xl bg-green-50 border border-green-100">
                    <h3 className="text-green-800 font-bold mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                      Identified Strengths
                    </h3>
                    <ul className="space-y-2 text-sm text-green-700">
                      {state.contentReport.strengths.map((s, i) => <li key={i}>• {s}</li>)}
                    </ul>
                  </div>
                  <div className="p-6 rounded-2xl bg-amber-50 border border-amber-100">
                    <h3 className="text-amber-800 font-bold mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                      Content Gaps
                    </h3>
                    <ul className="space-y-2 text-sm text-amber-700">
                      {state.contentReport.gaps.map((g, i) => <li key={i}>• {g}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-slate-50 flex justify-end gap-3">
                 <button onClick={approveContent} className="px-10 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-200 transition-all">Continue to JD Matching</button>
              </div>
            </div>
          )}

          {/* STEP 4: JD ALIGNMENT */}
          {state.status === WorkflowStatus.ALIGNING_JD && (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
              <h2 className="text-2xl font-bold mb-4">Job Description Alignment</h2>
              <p className="text-slate-500 mb-6">Enter the job description you are targeting. Our AlignmentAgent will calculate your fit score and suggest keyword optimizations.</p>
              <textarea 
                className="w-full h-64 p-6 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800"
                placeholder="Paste the Job Description here..."
                value={state.jobDescription}
                onChange={(e) => setState(prev => ({ ...prev, jobDescription: e.target.value }))}
              />
              <div className="mt-6 flex justify-end">
                <button 
                  onClick={runAlignment}
                  disabled={!state.jobDescription || isLoading}
                  className="bg-blue-600 disabled:opacity-50 text-white px-10 py-4 rounded-xl font-bold transition-all hover:bg-blue-700"
                >
                  Analyze Alignment
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: ALIGNMENT REPORT */}
          {state.status === WorkflowStatus.AWAITING_ALIGNMENT_APPROVAL && state.alignmentReport && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-in zoom-in-95 duration-500">
               <div className="p-8 bg-blue-600 text-white flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold">Role Fit Analysis</h2>
                    <p className="opacity-80 text-sm">Alignment scores based on semantic match.</p>
                  </div>
                  <div className="text-4xl font-black">{state.alignmentReport.overallScore}%</div>
               </div>
               <div className="p-8 space-y-8">
                  <div>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Semantic Fit Reasoning</h3>
                    <p className="text-slate-700 leading-relaxed italic border-l-4 border-blue-200 pl-4">"{state.alignmentReport.roleFitAnalysis}"</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Matching Keywords</h3>
                      <div className="flex flex-wrap gap-2">
                        {state.alignmentReport.matchingKeywords.map((k, i) => (
                          <span key={i} className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">{k}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Missing Keywords</h3>
                      <div className="flex flex-wrap gap-2">
                        {state.alignmentReport.missingKeywords.map((k, i) => (
                          <span key={i} className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-xs font-bold">{k}</span>
                        ))}
                      </div>
                    </div>
                  </div>
               </div>
               <div className="p-6 bg-slate-50 flex justify-end gap-3">
                 <button onClick={startInterview} className="px-10 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-200 transition-all">Start Mock Interview</button>
               </div>
            </div>
          )}

          {/* STEP 6: INTERVIEW CHAT */}
          {state.status === WorkflowStatus.INTERVIEWING && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[70vh] animate-in slide-in-from-bottom-8 duration-500">
               <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
                   </div>
                   <div>
                     <h2 className="font-bold">Interview Coach Agent</h2>
                     <p className="text-xs text-green-500 font-bold">Active Session</p>
                   </div>
                 </div>
               </div>
               <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {state.interviewHistory.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] p-4 rounded-2xl ${
                        msg.role === 'user' 
                          ? 'bg-blue-600 text-white rounded-tr-none' 
                          : 'bg-slate-100 text-slate-800 rounded-tl-none'
                      }`}>
                        <p className="text-sm leading-relaxed">{msg.text}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
               </div>
               <div className="p-4 border-t border-slate-100">
                  <form 
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const input = (e.target as any).message;
                      if (!input.value.trim() || isLoading) return;
                      handleInterviewMessage(input.value);
                      input.value = '';
                    }}
                  >
                    <input 
                      name="message"
                      autoFocus
                      autoComplete="off"
                      placeholder="Type your response..."
                      disabled={isLoading}
                      className="flex-1 px-6 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <button 
                      type="submit"
                      disabled={isLoading}
                      className="bg-blue-600 text-white p-4 rounded-2xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                    </button>
                  </form>
               </div>
            </div>
          )}

          {/* PERSISTENCE: HISTORY */}
          {state.history.length > 0 && state.status === WorkflowStatus.IDLE && (
            <div className="pt-12">
              <h3 className="text-lg font-bold mb-4">Previous Resumes</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {state.history.map((h) => (
                  <div key={h.id} className="bg-white border border-slate-200 p-6 rounded-2xl flex justify-between items-center group hover:border-blue-300 transition-all">
                    <div>
                      <h4 className="font-bold">{h.name}</h4>
                      <p className="text-xs text-slate-400">{new Date(h.timestamp).toLocaleDateString()}</p>
                      {isStale(h.timestamp) && (
                        <span className="inline-block mt-2 px-2 py-0.5 rounded bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-tighter border border-red-100">STALE</span>
                      )}
                    </div>
                    <button 
                      onClick={() => { setState(prev => ({ ...prev, currentResume: h, status: WorkflowStatus.CRITIQUING })); runCritic(h); }}
                      className="text-blue-600 hover:text-blue-800 font-bold text-sm opacity-0 group-hover:opacity-100 transition-all"
                    >
                      Select →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Persistent Call to Action */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 flex justify-center items-center gap-6 z-50">
        <div className="max-w-7xl w-full mx-auto flex justify-between items-center text-xs text-slate-400 font-medium">
          <div className="flex gap-4">
            <span>LangGraph Orchestration: Active</span>
            <span>Checkpointer: Persistent</span>
          </div>
          <div className="flex gap-4">
             <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="hover:text-blue-600">Gemini API Billing Doc</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
