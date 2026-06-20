import React, { useState, useRef } from "react";
import { WorkflowStatus, InterviewMode } from "./types/workflow";
import type { SharedState } from "./types/workflow";
import type { Resume } from "./types/resume";
import type { ChatRequest } from "./types/api";
import { DEFAULT_RESUME } from "./config/constants";
import { fileToBase64, isInterviewCompleteResponse } from "./utils/fileUtils";
import { toErrorMessage } from "./utils/errors";
import { callChatEndpoint, fetchCurrentResume } from "./api";
import { resumeCriticAgent } from "@/api/chat-endpoints/resumeCritic";
import { atsEngineAnalyze } from "@/api/ats";
import { alignmentAgent } from "@/api/chat-endpoints/alignment";
import { interviewCoachAgent, sendAudioMessage } from "@/api/chat-endpoints/interviewCoach";
import { BackendServiceProvider, useBackendService } from "./providers/BackendServiceProvider";
import { useWorkflowState } from "./hooks/useWorkflowState";
import { StepIndicator } from "./components/StepIndicator";
import { ResumePreview } from "./components/ResumePreview";
import { LoadingState } from "./components/LoadingState";
import { LoadingProvider, useLoading } from "./contexts/LoadingContext";
import {
  UploadStep,
  ATSCheckStep,
  AlignmentStep,
  AlignmentReportStep,
  InterviewStep,
  InterviewModeSelectionStep,
} from "./components/WorkflowSteps";

const AppContent: React.FC = () => {
  const {
    sessionId,
    authToken,
    sessionReady,
    sessionError: sessionInitError,
  } = useBackendService();
  const { state, updateState, resetSession, handleStepClick } = useWorkflowState();
  const [error, setError] = useState<string | null>(sessionInitError);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const displayError = error || sessionInitError;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white text-slate-950">
      {/* 1. Primary SaaS Navbar */}
      <nav className="h-16 flex-none bg-white border-b border-slate-200 px-6 flex items-center justify-between z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white font-bold text-lg">
            IR
          </div>
          <div>
            <span className="font-bold text-sm">InterviewReady</span>
            <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-medium uppercase tracking-wider">
              Beta
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={resetSession}
            className="text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            Reset Session
          </button>
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500 border border-slate-300">
            JD
          </div>
        </div>
      </nav>

      {/* 2. Secondary Workflow Indicator Bar - Centered width */}
      <div className="h-14 flex-none bg-slate-50/50 border-b border-slate-200 flex items-center px-6 z-30">
        <div className="w-full max-w-4xl mx-auto flex justify-center overflow-x-auto no-scrollbar">
          <StepIndicator currentStatus={state.status} onStepClick={handleStepClick} />
        </div>
      </div>

      {/* 3. Main Split Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Analysis & Actions */}
        <aside className="w-[450px] border-r border-slate-200 bg-white flex flex-col z-20 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-thin scrollbar-thumb-slate-200">
            {displayError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start justify-between gap-3 text-red-700 animate-in fade-in slide-in-from-top-1">
                <div className="flex items-start gap-3 flex-1">
                  <div className="mt-0.5 text-red-500">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293-1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="text-xs font-medium">{displayError}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  aria-label="Close notification"
                  className="text-red-500 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-200 rounded-full"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            )}

            {sessionReady && (
              <div className="relative">
                <WorkflowController
                  state={state}
                  updateState={updateState}
                  setError={setError}
                  chatEndRef={chatEndRef}
                  sessionId={sessionId}
                  authToken={authToken}
                />
              </div>
            )}
            {!sessionReady && (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between text-[10px] text-slate-400 font-medium uppercase tracking-tight">
            <span>System Status: Operational</span>
            <span className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
              Cloud Sync Active
            </span>
          </div>
        </aside>

        {/* Right Panel: Resume Preview */}
        <main className="flex-1 bg-slate-100/30 overflow-hidden flex flex-col relative">
          <div className="flex-1 overflow-y-auto">
            <ResumePreview resume={state.currentResume ?? DEFAULT_RESUME} />
          </div>
        </main>
      </div>

      {/* Centralized Loading Overlay */}
      <LoadingStateWrapper />
    </div>
  );
};

const WorkflowController: React.FC<{
  state: SharedState;
  updateState: (updater: SharedState | ((prev: SharedState) => SharedState)) => void;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  sessionId: string;
  authToken: string;
}> = ({ state, updateState, setError, chatEndRef, sessionId, authToken }) => {
  const { startLoading, updateProgress, stopLoading } = useLoading();
  const [manualResumeText, setManualResumeText] = useState("");
  const [manualResumeError, setManualResumeError] = useState<string | null>(null);

  const processPdfFile = async (file: File) => {
    updateProgress(25, 0);
    const base64 = await fileToBase64(file);
    updateProgress(50, 1);

    const request: ChatRequest = {
      intent: "RESUME_CRITIC",
      resumeData: null,
      jobDescription: "",
      messageHistory: [],
      resumeFile: { data: base64, fileType: "pdf" },
    };

    updateProgress(75, 2);
    const response = await callChatEndpoint(sessionId, authToken, request);
    const parsedResume = await fetchCurrentResume(sessionId, authToken);

    let responseData;
    try {
      responseData = response.payload || JSON.parse(response.content || "{}");
    } catch (parseErr) {
      throw new Error(`Invalid response from backend: ${toErrorMessage(parseErr)}`, {
        cause: parseErr,
      });
    }

    updateProgress(90, 3);
    return { responseData, parsedResume };
  };

  const handleSuccessfulProcessing = async (
    _responseData: unknown,
    parsedResume: Resume | null,
  ) => {
    const resumeToUse = parsedResume || state.currentResume!;
    const [atsResult, criticResult] = await Promise.all([
      atsEngineAnalyze(authToken, resumeToUse),
      resumeCriticAgent(sessionId, authToken, resumeToUse),
    ]);
    updateState((prev) => ({
      ...prev,
      currentResume: parsedResume || prev.currentResume,
      history: parsedResume ? [...prev.history, parsedResume] : prev.history,
      atsReport: atsResult,
      criticIssues: criticResult.issues || [],
      status: WorkflowStatus.AWAITING_ATS_APPROVAL,
    }));
    setManualResumeText("");
    updateProgress(100, 3);
  };

  const processExistingResume = async () => {
    startLoading("Analyzing your resume...", [
      "Validating resume",
      "Running ATS engine",
      "Analyzing resume structure",
      "Generating insights",
    ]);

    try {
      updateProgress(50, 1);
      if (!state.currentResume) throw new Error("Current resume is null");
      const [atsResult, criticResult] = await Promise.all([
        atsEngineAnalyze(authToken, state.currentResume),
        resumeCriticAgent(sessionId, authToken, state.currentResume),
      ]);
      updateProgress(100, 2);

      updateState((prev) => ({
        ...prev,
        atsReport: atsResult,
        criticIssues: criticResult.issues || [],
        status: WorkflowStatus.AWAITING_ATS_APPROVAL,
      }));
    } catch (err: unknown) {
      setError(toErrorMessage(err) || "Failed to analyze resume");
    } finally {
      stopLoading();
    }
  };

  const handleUploadSubmit = async (file: File | null) => {
    setError(null);
    setManualResumeError(null);

    if (file) {
      startLoading("Analyzing your resume...", [
        "Uploading file",
        "Running ATS engine",
        "Analyzing resume structure",
        "Generating insights",
      ]);

      try {
        const isPdf =
          file.type === "application/pdf" ||
          file.type === "application/x-pdf" ||
          file.name.toLowerCase().endsWith(".pdf");

        if (!isPdf) {
          setError("Unsupported file type. Please upload a PDF resume.");
          stopLoading();
          return;
        }

        const { responseData, parsedResume } = await processPdfFile(file);
        await handleSuccessfulProcessing(responseData, parsedResume);
      } catch (err: unknown) {
        setError(toErrorMessage(err) || "Failed to process resume");
      } finally {
        stopLoading();
      }
      return;
    }

    if (!state.currentResume) {
      setError("No resume available. Please upload or edit your resume.");
      return;
    }

    await processExistingResume();
  };

  const submitManualResume = async () => {
    setManualResumeError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(manualResumeText);
    } catch {
      setManualResumeError("Manual resume data must be valid JSON.");
      return;
    }

    if (!parsed || typeof parsed !== "object") {
      setManualResumeError("Manual resume data must be a JSON object.");
      return;
    }

    startLoading("Analyzing your resume...", [
      "Validating manual input",
      "Running ATS engine",
      "Analyzing resume structure",
      "Generating insights",
    ]);
    try {
      updateProgress(35, 0);
      const resumeToUse = parsed as Resume;
      const [atsResult, criticResult] = await Promise.all([
        atsEngineAnalyze(authToken, resumeToUse),
        resumeCriticAgent(sessionId, authToken, resumeToUse),
      ]);
      updateProgress(100, 2);
      updateState((prev) => ({
        ...prev,
        currentResume: resumeToUse,
        history: [...prev.history, resumeToUse],
        atsReport: atsResult,
        criticIssues: criticResult.issues || [],
        status: WorkflowStatus.AWAITING_ATS_APPROVAL,
      }));
      setManualResumeText("");
    } catch (err: unknown) {
      setManualResumeError(toErrorMessage(err) || "Failed to process manual resume data.");
    } finally {
      stopLoading();
    }
  };

  const approveATSCheck = () =>
    updateState((prev) => ({ ...prev, status: WorkflowStatus.ALIGNING_JD }));

  const reRunATSCheck = async () => {
    if (!state.currentResume) return;
    startLoading("Re-running ATS check...", [
      "Analyzing resume",
      "Running ATS engine",
      "Checking critic issues",
    ]);
    try {
      const [atsResult, criticResult] = await Promise.all([
        atsEngineAnalyze(authToken, state.currentResume),
        resumeCriticAgent(sessionId, authToken, state.currentResume),
      ]);
      updateState((prev) => ({
        ...prev,
        atsReport: atsResult,
        criticIssues: criticResult.issues || [],
      }));
    } catch (err: unknown) {
      setError(toErrorMessage(err) || "Failed to re-run ATS check");
    } finally {
      stopLoading();
    }
  };

  const runAlignment = async () => {
    if (!state.jobDescription) return;
    startLoading("Analyzing job alignment...", [
      "Parsing job description",
      "Matching skills",
      "Calculating fit score",
      "Generating insights",
    ]);
    try {
      updateProgress(25, 0);
      const report = await alignmentAgent(
        sessionId,
        authToken,
        state.currentResume,
        state.jobDescription,
      );
      updateProgress(100, 3);
      updateState((prev) => ({
        ...prev,
        alignmentReport: report,
        status: WorkflowStatus.AWAITING_ALIGNMENT_APPROVAL,
      }));
    } catch (err: unknown) {
      setError(toErrorMessage(err) || "Failed to run alignment");
    } finally {
      stopLoading();
    }
  };

  const startInterviewSelection = () => {
    updateState((prev) => ({
      ...prev,
      status: WorkflowStatus.SELECTING_INTERVIEW_MODE,
      interviewHistory: [],
    }));
  };

  const startInterview = async (mode: InterviewMode) => {
    updateState((prev) => ({
      ...prev,
      interviewMode: mode,
      status: WorkflowStatus.INTERVIEWING,
      interviewHistory: [],
    }));

    if (mode === "VOICE") {
      setError(null);
      return;
    }

    startLoading("Starting interview...", [
      "Preparing first question",
      "Personalizing coach guidance",
    ]);
    setError(null);
    try {
      updateProgress(50, 0);
      const openingQuestion = await interviewCoachAgent(
        sessionId,
        authToken,
        state.currentResume,
        state.jobDescription,
        [],
      );
      updateProgress(100, 1);
      updateState((prev) => ({
        ...prev,
        status: WorkflowStatus.INTERVIEWING,
        interviewHistory: [{ role: "agent", text: openingQuestion }],
      }));
    } catch (err: unknown) {
      setError(toErrorMessage(err) || "Failed to start interview");
      updateState((prev) => ({
        ...prev,
        status: WorkflowStatus.SELECTING_INTERVIEW_MODE,
        interviewHistory: [],
      }));
    } finally {
      stopLoading();
    }
  };

  const handleInterviewMessage = async (msg: string) => {
    const updatedHistory = [...state.interviewHistory, { role: "user" as const, text: msg }];
    updateState((prev) => ({ ...prev, interviewHistory: updatedHistory }));
    startLoading("Coach is thinking...", ["Analyzing your response", "Generating feedback"]);
    try {
      updateProgress(50, 0);
      const responseText = await interviewCoachAgent(
        sessionId,
        authToken,
        state.currentResume,
        state.jobDescription,
        updatedHistory,
      );
      const interviewComplete = isInterviewCompleteResponse(responseText);
      updateProgress(100, 1);
      updateState((prev) => ({
        ...prev,
        interviewHistory: [...updatedHistory, { role: "agent", text: responseText }],
        status: interviewComplete ? WorkflowStatus.COMPLETED : prev.status,
      }));
    } catch (err: unknown) {
      setError(toErrorMessage(err) || "Failed to get interview response");
    } finally {
      stopLoading();
    }
  };

  const handleInterviewAudioMessage = async (audio: Uint8Array) => {
    const updatedHistory = [
      ...state.interviewHistory,
      { role: "user" as const, text: "[Analyzing audio...]" },
    ];
    updateState((prev) => ({ ...prev, interviewHistory: updatedHistory }));

    try {
      const { responseText, transcription } = await sendAudioMessage(
        sessionId,
        authToken,
        state.currentResume,
        state.jobDescription,
        updatedHistory,
        audio,
      );
      const interviewComplete = isInterviewCompleteResponse(responseText);

      updateState((prev) => {
        const newHistory = prev.interviewHistory.map((msg, i) =>
          i === prev.interviewHistory.length - 1 && msg.text === "[Analyzing audio...]"
            ? { ...msg, text: transcription || "[Audio response]" }
            : msg,
        );
        return {
          ...prev,
          interviewHistory: [...newHistory, { role: "agent", text: responseText }],
          status: interviewComplete ? WorkflowStatus.COMPLETED : prev.status,
        };
      });
    } catch (err: unknown) {
      setError(toErrorMessage(err) || "Failed to process audio");
      updateState((prev) => ({
        ...prev,
        interviewHistory: prev.interviewHistory.filter(
          (msg) => msg.text !== "[Analyzing audio...]",
        ),
      }));
    }
  };

  const handleLiveEvent = (event: { type: string; text?: string }) => {
    if (!event.text) return;

    if (event.type === "user") {
      updateState((prev) => {
        const history = [...prev.interviewHistory];
        const last = history.at(-1);
        if (last?.role === "user") {
          return {
            ...prev,
            interviewHistory: [...history.slice(0, -1), { role: "user", text: event.text! }],
          };
        }
        return {
          ...prev,
          interviewHistory: [...history, { role: "user", text: event.text! }],
        };
      });
    } else if (event.type === "gemini") {
      updateState((prev) => {
        const history = [...prev.interviewHistory];
        const last = history.at(-1);
        if (last?.role === "agent") {
          return {
            ...prev,
            interviewHistory: [...history.slice(0, -1), { role: "agent", text: event.text! }],
          };
        }
        return {
          ...prev,
          interviewHistory: [...history, { role: "agent", text: event.text! }],
        };
      });
    }
  };

  return (
    <>
      {(state.status === WorkflowStatus.IDLE || state.status === WorkflowStatus.EXTRACTING) && (
        <UploadStep
          onUploadSubmit={handleUploadSubmit}
          manualResumeText={manualResumeText}
          manualResumeError={manualResumeError}
          onManualResumeChange={setManualResumeText}
          onManualSubmit={submitManualResume}
        />
      )}
      {(state.status === WorkflowStatus.ATS_CHECKING ||
        state.status === WorkflowStatus.AWAITING_ATS_APPROVAL) &&
        state.atsReport && (
          <ATSCheckStep
            atsReport={state.atsReport}
            criticIssues={state.criticIssues}
            resume={state.currentResume}
            onApprove={approveATSCheck}
            onReRun={reRunATSCheck}
          />
        )}
      {state.status === WorkflowStatus.ALIGNING_JD && (
        <AlignmentStep
          jd={state.jobDescription}
          onChangeJD={(val) => updateState((prev) => ({ ...prev, jobDescription: val }))}
          onAnalyze={runAlignment}
          isLoading={false}
        />
      )}
      {state.status === WorkflowStatus.AWAITING_ALIGNMENT_APPROVAL && state.alignmentReport && (
        <AlignmentReportStep
          report={state.alignmentReport}
          resume={state.currentResume}
          onStartInterview={startInterviewSelection}
        />
      )}
      {state.status === WorkflowStatus.SELECTING_INTERVIEW_MODE && (
        <InterviewModeSelectionStep onSelect={startInterview} />
      )}
      {(state.status === WorkflowStatus.INTERVIEWING ||
        state.status === WorkflowStatus.DEBUG_VOICE ||
        state.status === WorkflowStatus.COMPLETED) && (
        <InterviewStep
          history={state.interviewHistory}
          onSend={handleInterviewMessage}
          onSendAudio={handleInterviewAudioMessage}
          isLoading={false}
          chatEndRef={chatEndRef}
          mode={
            state.status === WorkflowStatus.DEBUG_VOICE ? "VOICE" : state.interviewMode || "CHAT"
          }
          sessionId={sessionId}
          isComplete={state.status === WorkflowStatus.COMPLETED}
          onExit={() =>
            updateState((prev) => ({ ...prev, status: WorkflowStatus.SELECTING_INTERVIEW_MODE }))
          }
          onLiveEvent={handleLiveEvent}
        />
      )}
    </>
  );
};

const LoadingStateWrapper: React.FC = () => {
  const { isLoading, message, progress, steps, currentStep } = useLoading();

  return (
    <LoadingState
      isLoading={isLoading}
      message={message}
      progress={progress}
      steps={steps}
      currentStep={currentStep}
    />
  );
};

const App: React.FC = () => {
  return (
    <BackendServiceProvider>
      <LoadingProvider>
        <AppContent />
      </LoadingProvider>
    </BackendServiceProvider>
  );
};

export default App;
import React, { useState, useRef } from "react";
import { WorkflowStatus, InterviewMode } from "./types/workflow";
import type { SharedState } from "./types/workflow";
import type { Resume } from "./types/resume";
import type { ChatRequest } from "./types/api";
import { DEFAULT_RESUME } from "./config/constants";
import { fileToBase64, isInterviewCompleteResponse } from "./utils/fileUtils";
import { toErrorMessage } from "./utils/errors";
import { callChatEndpoint, fetchCurrentResume } from "./api";
import { resumeCriticAgent } from "@/api/chat-endpoints/resumeCritic";
import { contentStrengthAgent } from "@/api/chat-endpoints/contentStrength";
import { alignmentAgent } from "@/api/chat-endpoints/alignment";
import { interviewCoachAgent, sendAudioMessage } from "@/api/chat-endpoints/interviewCoach";
import { BackendServiceProvider, useBackendService } from "./providers/BackendServiceProvider";
import { useWorkflowState } from "./hooks/useWorkflowState";
import { StepIndicator } from "./components/StepIndicator";
import { ResumePreview } from "./components/ResumePreview";
import { LoadingState } from "./components/LoadingState";
import { LoadingProvider, useLoading } from "./contexts/LoadingContext";
import {
  UploadStep,
  CriticStep,
  ContentStep,
  AlignmentStep,
  AlignmentReportStep,
  InterviewStep,
  InterviewModeSelectionStep,
} from "./components/WorkflowSteps";

const AppContent: React.FC = () => {
  const {
    sessionId,
    authToken,
    sessionReady,
    sessionError: sessionInitError,
  } = useBackendService();
  const { state, updateState, resetSession, handleStepClick } = useWorkflowState();
  const [error, setError] = useState<string | null>(sessionInitError);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const displayError = error || sessionInitError;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white text-slate-950">
      {/* 1. Primary SaaS Navbar */}
      <nav className="h-16 flex-none bg-white border-b border-slate-200 px-6 flex items-center justify-between z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white font-bold text-lg">
            IR
          </div>
          <div>
            <span className="font-bold text-sm">InterviewReady</span>
            <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-medium uppercase tracking-wider">
              Beta
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={resetSession}
            className="text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            Reset Session
          </button>
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500 border border-slate-300">
            JD
          </div>
        </div>
      </nav>

      {/* 2. Secondary Workflow Indicator Bar - Centered width */}
      <div className="h-14 flex-none bg-slate-50/50 border-b border-slate-200 flex items-center px-6 z-30">
        <div className="w-full max-w-4xl mx-auto flex justify-center overflow-x-auto no-scrollbar">
          <StepIndicator currentStatus={state.status} onStepClick={handleStepClick} />
        </div>
      </div>

      {/* 3. Main Split Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Analysis & Actions */}
        <aside className="w-[450px] border-r border-slate-200 bg-white flex flex-col z-20 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-thin scrollbar-thumb-slate-200">
            {displayError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start justify-between gap-3 text-red-700 animate-in fade-in slide-in-from-top-1">
                <div className="flex items-start gap-3 flex-1">
                  <div className="mt-0.5 text-red-500">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="text-xs font-medium">{displayError}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  aria-label="Close notification"
                  className="text-red-500 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-200 rounded-full"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            )}

            {sessionReady && (
              <div className="relative">
                <WorkflowController
                  state={state}
                  updateState={updateState}
                  setError={setError}
                  chatEndRef={chatEndRef}
                  sessionId={sessionId}
                  authToken={authToken}
                />
              </div>
            )}
            {!sessionReady && (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between text-[10px] text-slate-400 font-medium uppercase tracking-tight">
            <span>System Status: Operational</span>
            <span className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
              Cloud Sync Active
            </span>
          </div>
        </aside>

        {/* Right Panel: Resume Preview */}
        <main className="flex-1 bg-slate-100/30 overflow-hidden flex flex-col relative">
          <div className="flex-1 overflow-y-auto">
            <ResumePreview resume={state.currentResume ?? DEFAULT_RESUME} />
          </div>
        </main>
      </div>

      {/* Centralized Loading Overlay */}
      <LoadingStateWrapper />
    </div>
  );
};

const WorkflowController: React.FC<{
  state: SharedState;
  updateState: (updater: SharedState | ((prev: SharedState) => SharedState)) => void;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  sessionId: string;
  authToken: string;
}> = ({ state, updateState, setError, chatEndRef, sessionId, authToken }) => {
  const { startLoading, updateProgress, stopLoading } = useLoading();
  const [manualResumeText, setManualResumeText] = useState("");
  const [manualResumeError, setManualResumeError] = useState<string | null>(null);

  const processPdfFile = async (file: File) => {
    updateProgress(25, 0);
    const base64 = await fileToBase64(file);
    updateProgress(50, 1);

    const request: ChatRequest = {
      intent: "RESUME_CRITIC",
      resumeData: null,
      jobDescription: "",
      messageHistory: [],
      resumeFile: { data: base64, fileType: "pdf" },
    };

    updateProgress(75, 2);
    const response = await callChatEndpoint(sessionId, authToken, request);
    const parsedResume = await fetchCurrentResume(sessionId, authToken);

    let responseData;
    try {
      responseData = response.payload || JSON.parse(response.content || "{}");
    } catch (parseErr) {
      throw new Error(`Invalid response from backend: ${toErrorMessage(parseErr)}`, {
        cause: parseErr,
      });
    }

    updateProgress(90, 3);
    return { responseData, parsedResume };
  };

  const handleSuccessfulProcessing = (responseData: unknown, parsedResume: Resume | null) => {
    updateState((prev) => ({
      ...prev,
      currentResume: parsedResume || prev.currentResume,
      history: parsedResume ? [...prev.history, parsedResume] : prev.history,
      criticReport: responseData as SharedState["criticReport"],
      status: WorkflowStatus.AWAITING_CRITIC_APPROVAL,
    }));
    setManualResumeText("");
    updateProgress(100, 3);
  };

  const processExistingResume = async () => {
    startLoading("Analyzing your resume...", [
      "Validating resume",
      "Analyzing structure",
      "Generating insights",
    ]);

    try {
      updateProgress(50, 1);
      if (!state.currentResume) throw new Error("Current resume is null");
      const report = await resumeCriticAgent(sessionId, authToken, state.currentResume);
      updateProgress(100, 2);

      updateState((prev) => ({
        ...prev,
        criticReport: report,
        status: WorkflowStatus.AWAITING_CRITIC_APPROVAL,
      }));
    } catch (err: unknown) {
      setError(toErrorMessage(err) || "Failed to analyze resume");
    } finally {
      stopLoading();
    }
  };

  const handleUploadSubmit = async (file: File | null) => {
    setError(null);
    setManualResumeError(null);

    if (file) {
      startLoading("Analyzing your resume...", [
        "Uploading file",
        "Extracting content",
        "Analyzing structure",
        "Generating insights",
      ]);

      try {
        const isPdf =
          file.type === "application/pdf" ||
          file.type === "application/x-pdf" ||
          file.name.toLowerCase().endsWith(".pdf");

        if (!isPdf) {
          setError("Unsupported file type. Please upload a PDF resume.");
          stopLoading();
          return;
        }

        const { responseData, parsedResume } = await processPdfFile(file);
        handleSuccessfulProcessing(responseData, parsedResume);
      } catch (err: unknown) {
        setError(toErrorMessage(err) || "Failed to process resume");
      } finally {
        stopLoading();
      }
      return;
    }

    if (!state.currentResume) {
      setError("No resume available. Please upload or edit your resume.");
      return;
    }

    await processExistingResume();
  };

  const submitManualResume = async () => {
    setManualResumeError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(manualResumeText);
    } catch {
      setManualResumeError("Manual resume data must be valid JSON.");
      return;
    }

    if (!parsed || typeof parsed !== "object") {
      setManualResumeError("Manual resume data must be a JSON object.");
      return;
    }

    startLoading("Analyzing your resume...", [
      "Validating manual input",
      "Analyzing structure",
      "Generating insights",
    ]);
    try {
      updateProgress(35, 0);
      const report = await resumeCriticAgent(sessionId, authToken, parsed as Resume);
      updateProgress(100, 2);
      updateState((prev) => ({
        ...prev,
        currentResume: parsed as Resume,
        history: [...prev.history, parsed as Resume],
        criticReport: report,
        status: WorkflowStatus.AWAITING_CRITIC_APPROVAL,
      }));
      setManualResumeText("");
    } catch (err: unknown) {
      setManualResumeError(toErrorMessage(err) || "Failed to process manual resume data.");
    } finally {
      stopLoading();
    }
  };

  const approveCritic = async () => {
    updateState((prev) => ({ ...prev, status: WorkflowStatus.ANALYZING_CONTENT }));
    startLoading("Analyzing content strength...", [
      "Extracting skills",
      "Analyzing achievements",
      "Generating suggestions",
    ]);
    try {
      updateProgress(50, 1);
      const report = await contentStrengthAgent(sessionId, authToken, state.currentResume);
      updateProgress(100, 2);
      updateState((prev) => ({
        ...prev,
        contentReport: report,
        status: WorkflowStatus.AWAITING_CONTENT_APPROVAL,
      }));
    } catch (err: unknown) {
      setError(toErrorMessage(err) || "Failed to analyze content");
    } finally {
      stopLoading();
    }
  };

  const approveContent = () =>
    updateState((prev) => ({ ...prev, status: WorkflowStatus.ALIGNING_JD }));

  const runAlignment = async () => {
    if (!state.jobDescription) return;
    startLoading("Analyzing job alignment...", [
      "Parsing job description",
      "Matching skills",
      "Calculating fit score",
      "Generating insights",
    ]);
    try {
      updateProgress(25, 0);
      const report = await alignmentAgent(
        sessionId,
        authToken,
        state.currentResume,
        state.jobDescription,
      );
      updateProgress(100, 3);
      updateState((prev) => ({
        ...prev,
        alignmentReport: report,
        status: WorkflowStatus.AWAITING_ALIGNMENT_APPROVAL,
      }));
    } catch (err: unknown) {
      setError(toErrorMessage(err) || "Failed to run alignment");
    } finally {
      stopLoading();
    }
  };

  const startInterviewSelection = () => {
    updateState((prev) => ({
      ...prev,
      status: WorkflowStatus.SELECTING_INTERVIEW_MODE,
      interviewHistory: [],
    }));
  };

  const startInterview = async (mode: InterviewMode) => {
    updateState((prev) => ({
      ...prev,
      interviewMode: mode,
      status: WorkflowStatus.INTERVIEWING,
      interviewHistory: [],
    }));

    if (mode === "VOICE") {
      setError(null);
      return;
    }

    startLoading("Starting interview...", [
      "Preparing first question",
      "Personalizing coach guidance",
    ]);
    setError(null);
    try {
      updateProgress(50, 0);
      const openingQuestion = await interviewCoachAgent(
        sessionId,
        authToken,
        state.currentResume,
        state.jobDescription,
        [],
      );
      updateProgress(100, 1);
      updateState((prev) => ({
        ...prev,
        status: WorkflowStatus.INTERVIEWING,
        interviewHistory: [{ role: "agent", text: openingQuestion }],
      }));
    } catch (err: unknown) {
      setError(toErrorMessage(err) || "Failed to start interview");
      updateState((prev) => ({
        ...prev,
        status: WorkflowStatus.SELECTING_INTERVIEW_MODE,
        interviewHistory: [],
      }));
    } finally {
      stopLoading();
    }
  };

  const handleInterviewMessage = async (msg: string) => {
    const updatedHistory = [...state.interviewHistory, { role: "user" as const, text: msg }];
    updateState((prev) => ({ ...prev, interviewHistory: updatedHistory }));
    startLoading("Coach is thinking...", ["Analyzing your response", "Generating feedback"]);
    try {
      updateProgress(50, 0);
      const responseText = await interviewCoachAgent(
        sessionId,
        authToken,
        state.currentResume,
        state.jobDescription,
        updatedHistory,
      );
      const interviewComplete = isInterviewCompleteResponse(responseText);
      updateProgress(100, 1);
      updateState((prev) => ({
        ...prev,
        interviewHistory: [...updatedHistory, { role: "agent", text: responseText }],
        status: interviewComplete ? WorkflowStatus.COMPLETED : prev.status,
      }));
    } catch (err: unknown) {
      setError(toErrorMessage(err) || "Failed to get interview response");
    } finally {
      stopLoading();
    }
  };

  const handleInterviewAudioMessage = async (audio: Uint8Array) => {
    const updatedHistory = [
      ...state.interviewHistory,
      { role: "user" as const, text: "[Analyzing audio...]" },
    ];
    updateState((prev) => ({ ...prev, interviewHistory: updatedHistory }));

    try {
      const { responseText, transcription } = await sendAudioMessage(
        sessionId,
        authToken,
        state.currentResume,
        state.jobDescription,
        updatedHistory,
        audio,
      );
      const interviewComplete = isInterviewCompleteResponse(responseText);

      updateState((prev) => {
        const newHistory = prev.interviewHistory.map((msg, i) =>
          i === prev.interviewHistory.length - 1 && msg.text === "[Analyzing audio...]"
            ? { ...msg, text: transcription || "[Audio response]" }
            : msg,
        );
        return {
          ...prev,
          interviewHistory: [...newHistory, { role: "agent", text: responseText }],
          status: interviewComplete ? WorkflowStatus.COMPLETED : prev.status,
        };
      });
    } catch (err: unknown) {
      setError(toErrorMessage(err) || "Failed to process audio");
      updateState((prev) => ({
        ...prev,
        interviewHistory: prev.interviewHistory.filter(
          (msg) => msg.text !== "[Analyzing audio...]",
        ),
      }));
    }
  };

  const handleLiveEvent = (event: { type: string; text?: string }) => {
    if (!event.text) return;

    if (event.type === "user") {
      updateState((prev) => {
        const history = [...prev.interviewHistory];
        const last = history.at(-1);
        if (last?.role === "user") {
          return {
            ...prev,
            interviewHistory: [...history.slice(0, -1), { role: "user", text: event.text! }],
          };
        }
        return {
          ...prev,
          interviewHistory: [...history, { role: "user", text: event.text! }],
        };
      });
    } else if (event.type === "gemini") {
      updateState((prev) => {
        const history = [...prev.interviewHistory];
        const last = history.at(-1);
        if (last?.role === "agent") {
          return {
            ...prev,
            interviewHistory: [...history.slice(0, -1), { role: "agent", text: event.text! }],
          };
        }
        return {
          ...prev,
          interviewHistory: [...history, { role: "agent", text: event.text! }],
        };
      });
    }
  };

  return (
    <>
      {(state.status === WorkflowStatus.IDLE || state.status === WorkflowStatus.EXTRACTING) && (
        <UploadStep
          onUploadSubmit={handleUploadSubmit}
          manualResumeText={manualResumeText}
          manualResumeError={manualResumeError}
          onManualResumeChange={setManualResumeText}
          onManualSubmit={submitManualResume}
        />
      )}
      {(state.status === WorkflowStatus.CRITIQUING ||
        state.status === WorkflowStatus.AWAITING_CRITIC_APPROVAL) &&
        state.criticReport && (
          <CriticStep
            report={state.criticReport}
            resume={state.currentResume}
            onApprove={approveCritic}
          />
        )}
      {(state.status === WorkflowStatus.ANALYZING_CONTENT ||
        state.status === WorkflowStatus.AWAITING_CONTENT_APPROVAL) &&
        state.contentReport && (
          <ContentStep
            report={state.contentReport}
            resume={state.currentResume}
            onApprove={approveContent}
          />
        )}
      {state.status === WorkflowStatus.ALIGNING_JD && (
        <AlignmentStep
          jd={state.jobDescription}
          onChangeJD={(val) => updateState((prev) => ({ ...prev, jobDescription: val }))}
          onAnalyze={runAlignment}
          isLoading={false}
        />
      )}
      {state.status === WorkflowStatus.AWAITING_ALIGNMENT_APPROVAL && state.alignmentReport && (
        <AlignmentReportStep
          report={state.alignmentReport}
          resume={state.currentResume}
          onStartInterview={startInterviewSelection}
        />
      )}
      {state.status === WorkflowStatus.SELECTING_INTERVIEW_MODE && (
        <InterviewModeSelectionStep onSelect={startInterview} />
      )}
      {(state.status === WorkflowStatus.INTERVIEWING ||
        state.status === WorkflowStatus.DEBUG_VOICE ||
        state.status === WorkflowStatus.COMPLETED) && (
        <InterviewStep
          history={state.interviewHistory}
          onSend={handleInterviewMessage}
          onSendAudio={handleInterviewAudioMessage}
          isLoading={false}
          chatEndRef={chatEndRef}
          mode={
            state.status === WorkflowStatus.DEBUG_VOICE ? "VOICE" : state.interviewMode || "CHAT"
          }
          sessionId={sessionId}
          isComplete={state.status === WorkflowStatus.COMPLETED}
          onExit={() =>
            updateState((prev) => ({ ...prev, status: WorkflowStatus.SELECTING_INTERVIEW_MODE }))
          }
          onLiveEvent={handleLiveEvent}
        />
      )}
    </>
  );
};

const LoadingStateWrapper: React.FC = () => {
  const { isLoading, message, progress, steps, currentStep } = useLoading();

  return (
    <LoadingState
      isLoading={isLoading}
      message={message}
      progress={progress}
      steps={steps}
      currentStep={currentStep}
    />
  );
};

const App: React.FC = () => {
  return (
    <BackendServiceProvider>
      <LoadingProvider>
        <AppContent />
      </LoadingProvider>
    </BackendServiceProvider>
  );
};

export default App;
