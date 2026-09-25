import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UploadStep } from "../components/workflow-steps/UploadStep";
import type { SavedResume } from "../types/resume";

afterEach(cleanup);

const savedResumes: SavedResume[] = [
  { id: "resume-1", filename: "first.pdf", createdAt: "2026-08-12T00:00:00Z", resume: {} },
  { id: "resume-2", filename: "second.pdf", createdAt: "2026-08-11T00:00:00Z", resume: {} },
];

const renderStep = (overrides: Partial<Parameters<typeof UploadStep>[0]> = {}) => {
  const props = {
    savedResumes,
    selectedResumeId: null,
    isUploading: false,
    isLoadingResumes: false,
    onSelectResume: vi.fn(),
    onUploadSubmit: vi.fn(),
    onAnalyzeResume: vi.fn(),
    manualResumeText: "",
    manualResumeError: null,
    onManualResumeChange: vi.fn(),
    onManualSubmit: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<UploadStep {...props} />) };
};

describe("UploadStep saved-resume selection", () => {
  it("starts with a blank select and a disabled Analyze CTA, enabling it after selection", async () => {
    const user = userEvent.setup();
    const onSelectResume = vi.fn();

    // UploadStep is controlled: selection state lives in the parent, so
    // re-render with the new prop to observe the CTA becoming enabled.
    const view = renderStep({ onSelectResume });
    const select = screen.getByLabelText("Saved resume") as HTMLSelectElement;
    const analyzeButton = screen.getByRole("button", {
      name: "Analyze Resume",
    }) as HTMLButtonElement;

    expect(select.value).toBe("");
    expect(analyzeButton.disabled).toBe(true);

    await user.selectOptions(select, "resume-2");
    expect(onSelectResume).toHaveBeenCalledWith("resume-2");

    view.rerender(
      <UploadStep {...view.props} selectedResumeId="resume-2" onSelectResume={onSelectResume} />,
    );
    expect(
      (screen.getByRole("button", { name: "Analyze Resume" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("shows the empty-state hint when no saved resumes exist", () => {
    renderStep({ savedResumes: [] });
    expect(screen.getByText("No saved resumes yet — upload a PDF below to save one.")).toBeTruthy();
  });

  it("keeps the file input usable without a selection and uploads the chosen file", async () => {
    const user = userEvent.setup();
    const onUploadSubmit = vi.fn();
    const file = new File(["dummy"], "resume.pdf", { type: "application/pdf" });

    renderStep({ onUploadSubmit });

    await user.upload(screen.getByLabelText(/Upload Resume/), file);
    expect(onUploadSubmit).toHaveBeenCalledWith(file);
  });
});
