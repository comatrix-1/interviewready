import { useState, useCallback } from "react";
import type { SharedState } from "../types/workflow";
import { WorkflowStatus } from "../types/workflow";
import { DEFAULT_RESUME, STORAGE_KEY } from "../config/constants";

const loadState = (): SharedState => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return JSON.parse(saved) as SharedState;
  return {
    currentResume: DEFAULT_RESUME,
    history: [],
    jobDescription: "",
    status: WorkflowStatus.IDLE,
    criticReport: null,
    contentReport: null,
    alignmentReport: null,
    interviewHistory: [],
  };
};

export const useWorkflowState = () => {
  const [state, setState] = useState<SharedState>(loadState);

  const persistState = (newState: SharedState) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  };

  const updateState = useCallback((updater: SharedState | ((prev: SharedState) => SharedState)) => {
    setState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      persistState(next);
      return next;
    });
  }, []);

  const resetSession = useCallback(() => {
    if (!confirm("Reset current progress? This will clear all data and start over.")) return;
    localStorage.removeItem(STORAGE_KEY);
    const fresh: SharedState = {
      currentResume: DEFAULT_RESUME,
      history: [],
      jobDescription: "",
      status: WorkflowStatus.IDLE,
      criticReport: null,
      contentReport: null,
      alignmentReport: null,
      interviewHistory: [],
    };
    setState(fresh);
  }, []);

  const handleStepClick = useCallback(
    (status: WorkflowStatus) => {
      const canNavigate: Partial<Record<WorkflowStatus, boolean>> = {
        [WorkflowStatus.IDLE]: true,
        [WorkflowStatus.CRITIQUING]: !!state.currentResume,
        [WorkflowStatus.ANALYZING_CONTENT]: !!state.criticReport,
        [WorkflowStatus.ALIGNING_JD]: !!state.alignmentReport,
        [WorkflowStatus.INTERVIEWING]: !!state.alignmentReport,
      };

      if (canNavigate[status]) {
        const completedStatus: Partial<Record<WorkflowStatus, WorkflowStatus>> = {
          [WorkflowStatus.CRITIQUING]: WorkflowStatus.AWAITING_CRITIC_APPROVAL,
          [WorkflowStatus.ANALYZING_CONTENT]: WorkflowStatus.AWAITING_CONTENT_APPROVAL,
          [WorkflowStatus.ALIGNING_JD]: WorkflowStatus.AWAITING_ALIGNMENT_APPROVAL,
        };

        const reportAvailable: Partial<Record<WorkflowStatus, boolean>> = {
          [WorkflowStatus.CRITIQUING]: !!state.criticReport,
          [WorkflowStatus.ANALYZING_CONTENT]: !!state.contentReport,
          [WorkflowStatus.ALIGNING_JD]: !!state.alignmentReport,
        };

        const targetStatus = (reportAvailable[status] && completedStatus[status]) || status;
        updateState((prev) => ({ ...prev, status: targetStatus }));
      }
    },
    [
      state.currentResume,
      state.criticReport,
      state.contentReport,
      state.alignmentReport,
      updateState,
    ],
  );

  return { state, updateState, resetSession, handleStepClick };
};
