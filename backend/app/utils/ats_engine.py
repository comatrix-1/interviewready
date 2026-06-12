"""ATS (Applicant Tracking System) scoring engine.

Analyses resume bullet points for common ATS-unfriendly patterns and produces
a numeric score (0–100) with per-section detail.

Ported from ats_engine.ts.
"""

from __future__ import annotations

import re
from typing import Any

_PASSIVE_WORDS = ["was", "were", "is", "been", "being"]
_FILLER_WORDS = ["very", "really", "just", "some", "a lot"]
_PRONOUNS = ["I", "me", "my", "mine"]
_BUZZWORDS = ["synergy", "guru", "rockstar", "ninja", "dynamic"]

# Scoring weights
_WORK_BONUS = 20
_PROJECT_BONUS = 15
_SKILL_BONUS = 15
_EDUCATION_BONUS = 10
_PENALTY_NO = -5
_PENALTY_MIN = -2
_MIN_BULLET_WORDS = 5


# ---------------------------------------------------------------------------
# Individual checks
# ---------------------------------------------------------------------------


def _make_result(
    pass_status: str,
    fail_indices: list[int],
    message: str,
) -> dict:
    return {
        "pass": pass_status,
        "bullet_to_highlight": fail_indices or None,
        "message": message,
    }


def _check_weak_bullets(bullets: list[str]) -> dict:
    weak = [i for i, b in enumerate(bullets) if len(b.split()) < _MIN_BULLET_WORDS]
    status = "ok" if not weak else "no"
    return _make_result(status, weak, "Bullets too short")


def _check_quantified_bullets(bullets: list[str]) -> dict:
    fail = [i for i, b in enumerate(bullets) if not re.search(r"\d+", b)]
    status = "ok" if not fail else "no"
    return _make_result(status, fail, "Missing numbers/metrics")


def _word_in_text(words: list[str], text: str) -> bool:
    return any(re.search(rf"\b{w}\b", text, re.IGNORECASE) for w in words)


def _check_passive_voice(bullets: list[str]) -> dict:
    fail = [i for i, b in enumerate(bullets) if _word_in_text(_PASSIVE_WORDS, b)]
    status = "ok" if not fail else "no"
    return _make_result(status, fail, "Passive voice detected")


def _check_filler_words(bullets: list[str]) -> dict:
    fail = [i for i, b in enumerate(bullets) if _word_in_text(_FILLER_WORDS, b)]
    status = "ok" if not fail else "no"
    return _make_result(status, fail, "Filler words detected")


def _check_personal_pronouns(bullets: list[str]) -> dict:
    fail = [i for i, b in enumerate(bullets) if _word_in_text(_PRONOUNS, b)]
    status = "ok" if not fail else "no"
    return _make_result(status, fail, "Personal pronouns used")


def _check_buzzwords(bullets: list[str]) -> dict:
    fail = [i for i, b in enumerate(bullets) if _word_in_text(_BUZZWORDS, b)]
    status = "ok" if not fail else "no"
    return _make_result(status, fail, "Buzzwords detected")


def _check_section_presence(items: list) -> dict:
    status = "ok" if items else "no"
    return {"pass": status, "bullet_to_highlight": None, "message": "Section missing"}


# ---------------------------------------------------------------------------
# Bullet-level checks applied to work / project entries
# ---------------------------------------------------------------------------

_BULLET_CHECKS = [
    ("weakBullets", _check_weak_bullets),
    ("quantifiedBullets", _check_quantified_bullets),
    ("passiveVoice", _check_passive_voice),
    ("fillerWords", _check_filler_words),
    ("personalPronouns", _check_personal_pronouns),
    ("buzzwords", _check_buzzwords),
]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def _run_bullet_checks(bullets: list[str]) -> dict[str, dict]:
    """Apply all bullet-level checks and return a checks dict."""
    return {name: fn(bullets) for name, fn in _BULLET_CHECKS}


def _process_entries(
    entries: list,
    prefix: str,
    sections: list[dict],
    detailed_results: dict[str, dict],
) -> None:
    """Run bullet checks over a list of work/project entries."""
    for idx, entry in enumerate(entries):
        bullets = list(entry.highlights)
        checks = _run_bullet_checks(bullets)
        sections.append({"section": f"{prefix}_{idx}", "checks": checks})
        for k, v in checks.items():
            detailed_results[f"{prefix}_{idx}_{k}"] = v


def _process_simple_section(
    items: list,
    section_name: str,
    sections: list[dict],
    detailed_results: dict[str, dict],
) -> None:
    """Run a section-presence check."""
    check = _check_section_presence(items)
    checks = {"sectionPresence": check}
    sections.append({"section": section_name, "checks": checks})
    detailed_results[f"{section_name}_sectionPresence"] = check


def analyze_resume(resume: Any) -> dict:
    """Run all ATS checks against *resume* and return a raw result dict.

    *resume* should be an ``app.models.resume.Resume`` instance (or any
    object exposing ``work``, ``projects``, ``skills``, and ``education``
    attributes).

    The dict shape mirrors the TypeScript ATSResult:
    ``{ "atsScore": int, "sections": [...], "detailedResults": {...} }``
    """
    sections: list[dict] = []
    detailed_results: dict[str, dict] = {}
    score = 0

    if resume.work:
        _process_entries(resume.work, "experience", sections, detailed_results)
        score += _WORK_BONUS

    if resume.projects:
        _process_entries(resume.projects, "project", sections, detailed_results)
        score += _PROJECT_BONUS

    if resume.skills:
        _process_simple_section(resume.skills, "skills", sections, detailed_results)
        score += _SKILL_BONUS

    if resume.education:
        _process_simple_section(resume.education, "education", sections, detailed_results)
        score += _EDUCATION_BONUS

    # --- Penalty pass --------------------------------------------------------
    for sec in sections:
        for check in sec["checks"].values():
            if check["pass"] == "no":
                score += _PENALTY_NO
            if check["pass"] == "min":
                score += _PENALTY_MIN

    ats_score = max(0, min(100, score))
    return {
        "atsScore": ats_score,
        "sections": sections,
        "detailedResults": detailed_results,
    }
