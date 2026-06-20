import { useState, useCallback } from "react";
import type { SharedState } from "../types/workflow";
import { WorkflowStatus } from "../types/workflow";
import { DEFAULT_RESUME, STORAGE_KEY } from "../config/constants";

const defaultState = (): SharedState => ({
  currentResume: DEFAULT_RESUME,
  history: [],
  jobDescription: "",
  status: WorkflowStatus.IDLE,
  atsReport: null,
  criticIssues: [],
  alignmentReport: null,
  interviewHistory: [],
});

const VALID_STATUSES = new Set(Object.values(WorkflowStatus));

const loadState = (): SharedState => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Detect stale state from before the ATS Check refactor
      if (!VALID_STATUSES.has(parsed.status) || !("atsReport" in parsed)) {
        localStorage.removeItem(STORAGE_KEY);
        return defaultState();
      }
      return parsed as SharedState;
    }
  } catch (err) {
    console.warn("[useWorkflowState] Corrupt persisted state, resetting to defaults.", err);
    localStorage.removeItem(STORAGE_KEY);
  }
  return defaultState();
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
    setState(defaultState());
  }, []);

  const handleStepClick = useCallback(
    (status: WorkflowStatus) => {
      const canNavigate: Partial<Record<WorkflowStatus, boolean>> = {
        [WorkflowStatus.IDLE]: true,
        [WorkflowStatus.ATS_CHECKING]: !!state.currentResume,
        [WorkflowStatus.ALIGNING_JD]: !!state.alignmentReport,
        [WorkflowStatus.INTERVIEWING]: !!state.alignmentReport,
      };

      if (canNavigate[status]) {
        const completedStatus: Partial<Record<WorkflowStatus, WorkflowStatus>> = {
          [WorkflowStatus.ATS_CHECKING]: WorkflowStatus.AWAITING_ATS_APPROVAL,
          [WorkflowStatus.ALIGNING_JD]: WorkflowStatus.AWAITING_ALIGNMENT_APPROVAL,
        };

        const reportAvailable: Partial<Record<WorkflowStatus, boolean>> = {
          [WorkflowStatus.ATS_CHECKING]: !!state.atsReport,
          [WorkflowStatus.ALIGNING_JD]: !!state.alignmentReport,
        };

        const targetStatus = (reportAvailable[status] && completedStatus[status]) || status;
        updateState((prev) => ({ ...prev, status: targetStatus }));
      }
    },
    [state.currentResume, state.atsReport, state.alignmentReport, updateState],
  );

  return { state, updateState, resetSession, handleStepClick };
};
