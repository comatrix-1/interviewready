import { useEffect, useState } from "react";
import type { SavedResume } from "../types/resume";
import { listSavedResumes } from "../api/resumes";

/**
 * Load the current identity's saved resumes. Keyed on *username* so the list
 * tracks login/logout — previously it was fetched once on mount and never
 * refreshed, showing one user's resumes to everyone else.
 */
export const useSavedResumes = (username: string) => {
  const [savedResumes, setSavedResumes] = useState<SavedResume[]>([]);
  const [isLoadingResumes, setIsLoadingResumes] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSavedResumes([]); // Never flash the previous identity's resumes.
    setIsLoadingResumes(true);
    listSavedResumes()
      .then((resumes) => {
        if (!cancelled) setSavedResumes(resumes);
      })
      .catch(() => {
        // Non-blocking: without DATABASE_URL the call 503s; keep the list
        // empty and the manual JSON flow usable.
        if (!cancelled) setSavedResumes([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingResumes(false);
      });
    return () => {
      cancelled = true;
    };
  }, [username]);

  return { savedResumes, setSavedResumes, isLoadingResumes };
};
