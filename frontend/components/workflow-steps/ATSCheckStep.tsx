import React, { useState } from "react";
import type { ATSReport, ATSScoreBreakdown, ResumeCriticIssue } from "../../types/reports";
import type { Resume } from "../../types/resume";
import { resolveResumeLocation } from "@/utils/resolve-resume-location";
import { capitalizeFirst } from "@/utils/text";
import { ReportHeader } from "../ReportHeader";

interface ATSCheckStepProps {
  atsReport: ATSReport;
  criticIssues: ResumeCriticIssue[];
  resume?: Resume | null;
  onApprove: () => void;
  onReRun: () => void;
}

const humanizeSectionName = (section: string): string => {
  const match = section.match(/^(.+)_(\d+)$/);
  if (match) {
    const name = capitalizeFirst(match[1].replace(/_/g, " "));
    return `${name} #${Number(match[2]) + 1}`;
  }
  return capitalizeFirst(section.replace(/_/g, " "));
};

const humanizeCheckName = (name: string): string =>
  name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const severityClass = (severity: string) => {
  if (severity === "HIGH") return "bg-red-50 text-red-700 border-red-200";
  if (severity === "MEDIUM") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
};

const passStatusDot = (pass: string) => {
  if (pass === "ok") return "bg-emerald-500";
  if (pass === "no") return "bg-red-500";
  return "bg-amber-500";
};

const ScoreBreakdownBar: React.FC<{ breakdown: ATSScoreBreakdown }> = ({ breakdown }) => {
  const segments = [
    { label: "Sections", value: breakdown.section_presence, color: "bg-emerald-500" },
    { label: "Bullets", value: breakdown.bullet_quality, color: "bg-blue-500" },
    { label: "Bonuses", value: breakdown.bonuses, color: "bg-slate-400" },
    { label: "Penalties", value: breakdown.penalties, color: "bg-red-500" },
  ].filter((s) => s.value !== 0);

  if (segments.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        Score Breakdown
      </h4>
      <div className="flex h-5 rounded-full overflow-hidden bg-slate-100">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className={`${seg.color} flex items-center justify-center text-white text-[9px] font-bold px-1 min-w-0`}
            style={{
              flexBasis: `${(Math.abs(seg.value) / breakdown.max_possible) * 100}%`,
              flexGrow: 0,
              flexShrink: 0,
            }}
            title={`${seg.label}: ${seg.value > 0 ? "+" : ""}${seg.value}`}
          >
            {seg.value > 0 ? `+${seg.value}` : seg.value}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-[9px] text-slate-500">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${seg.color}`} />
            <span>{seg.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const ChevronIcon: React.FC<{ expanded: boolean }> = ({ expanded }) => (
  <svg
    className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

export const ATSCheckStep: React.FC<ATSCheckStepProps> = ({
  atsReport,
  criticIssues,
  resume,
  onApprove,
  onReRun,
}) => {
  const [issuesExpanded, setIssuesExpanded] = useState(true);
  const [sectionsExpanded, setSectionsExpanded] = useState(false);

  const score = Math.round(atsReport.ats_score);
  const issues = Array.isArray(criticIssues) ? criticIssues : [];
  const summary =
    issues.length > 0
      ? `Found ${issues.length} issue${issues.length > 1 ? "s" : ""}`
      : "No critical issues detected";

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-400 space-y-6">
      <ReportHeader title="ATS Check" summary={summary} score={score} scoreLabel="ATS Score" />

      {/* Score Breakdown Bar */}
      {atsReport.score_breakdown && <ScoreBreakdownBar breakdown={atsReport.score_breakdown} />}

      {/* Keyword Match Summary */}
      {atsReport.keyword_match && (
        <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Keyword Match
            </h4>
            <span className="text-[11px] font-semibold text-slate-700">
              {Math.round(atsReport.keyword_match.match_percentage)}%
            </span>
          </div>
          {atsReport.keyword_match.missing_keywords.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {atsReport.keyword_match.missing_keywords.slice(0, 8).map((kw) => (
                <span
                  key={kw}
                  className="text-[9px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200"
                >
                  {kw}
                </span>
              ))}
              {atsReport.keyword_match.missing_keywords.length > 8 && (
                <span className="text-[9px] text-slate-400">
                  +{atsReport.keyword_match.missing_keywords.length - 8} more
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Validation Warnings */}
      {atsReport.validation_warnings.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1">
          {atsReport.validation_warnings.map((warning, i) => (
            <div key={i} className="text-[11px] text-amber-700 flex items-start gap-2">
              <svg className="w-3 h-3 mt-0.5 flex-none" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}

      {/* Critic Issues (collapsible, default open) */}
      <div className="space-y-3">
        <button
          onClick={() => setIssuesExpanded(!issuesExpanded)}
          className="flex items-center gap-2 w-full"
        >
          <ChevronIcon expanded={issuesExpanded} />
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Critic Issues ({issues.length})
          </h4>
        </button>

        {issuesExpanded && (
          <div className="space-y-2">
            {issues.length === 0 && (
              <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-500">
                No critical issues detected. Proceed when ready.
              </div>
            )}
            {issues.map((issue, i) => (
              <div
                key={`issue-${issue.type}-${i}`}
                className="p-3 bg-white border border-slate-200 rounded-lg space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-900">
                    {issue.type?.toUpperCase?.() || "ISSUE"}
                  </span>
                  <span
                    className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${severityClass(issue.severity)}`}
                  >
                    {issue.severity}
                  </span>
                </div>
                <p className="text-[12px] text-slate-600 leading-relaxed">{issue.description}</p>
                {(() => {
                  const resolved = resolveResumeLocation(resume, issue.location);
                  return (
                    <div className="space-y-1.5 text-[10px] text-slate-400">
                      <div>
                        Section:{" "}
                        <span className="font-medium text-slate-600">
                          {capitalizeFirst(resolved.topLevel || "unknown")}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section Details (collapsible, default collapsed) */}
      {atsReport.sections && atsReport.sections.length > 0 && (
        <div className="space-y-3">
          <button
            onClick={() => setSectionsExpanded(!sectionsExpanded)}
            className="flex items-center gap-2 w-full"
          >
            <ChevronIcon expanded={sectionsExpanded} />
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Section Details ({atsReport.sections.length})
            </h4>
          </button>

          {sectionsExpanded && (
            <div className="space-y-3">
              {atsReport.sections.map((section) => (
                <div
                  key={section.section}
                  className="p-3 bg-white border border-slate-200 rounded-lg space-y-3"
                >
                  <h5 className="text-[11px] font-semibold text-slate-900">
                    {humanizeSectionName(section.section)}
                  </h5>
                  <div className="space-y-2">
                    {Object.entries(section.checks).map(([checkName, check]) => (
                      <div key={checkName} className="flex items-start gap-2">
                        <div
                          className={`w-2 h-2 rounded-full mt-1 flex-none ${passStatusDot(check.pass)}`}
                        />
                        <div className="min-w-0">
                          <div className="text-[11px] font-medium text-slate-700">
                            {humanizeCheckName(checkName)}
                          </div>
                          {check.message && (
                            <p className="text-[10px] text-slate-500 mt-0.5">{check.message}</p>
                          )}
                          {check.suggestions && check.suggestions.length > 0 && (
                            <ul className="mt-1 space-y-0.5">
                              {check.suggestions.map((s, idx) => (
                                <li
                                  key={idx}
                                  className="text-[10px] text-blue-600 list-disc list-inside"
                                >
                                  {s}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col gap-2 pt-2">
        <button
          onClick={onReRun}
          className="w-full border border-slate-200 text-slate-600 text-[13px] font-semibold py-2.5 rounded-lg hover:bg-slate-50 active:scale-[0.98] transition-all"
        >
          Re-run ATS Check
        </button>
        <button
          onClick={onApprove}
          className="w-full bg-slate-900 text-white text-[13px] font-semibold py-3 rounded-lg shadow-sm hover:bg-slate-800 active:scale-[0.98] transition-all"
        >
          Proceed to Job Alignment
        </button>
      </div>
    </div>
  );
};
