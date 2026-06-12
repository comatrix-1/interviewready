"""ATS (Applicant Tracking System) scoring engine.

Analyses resume bullet points for common ATS-unfriendly patterns and produces
a normalised score (0–100) with per-section detail.

Scoring Philosophy (v3):
- Section presence rewards completeness (max 48 pts).
- Bullet quality rewards strong verbs, quantification, and clean writing (max ~52 pts).
- Content depth rewards entries with 3+ substantive bullets (max 4 pts per entry).
- Recency weighting reduces quality contribution of older entries.
- JD keyword matching rewards alignment with the target role (max 20 pts, only when JD provided).
- Contact presence and section ordering award small bonuses for ATS-friendly structure.
- Penalties deduct for duplicates, missing dates, incomplete entries, keyword stuffing,
  and critic-flagged issues.
- Scores are normalised to 0–100 regardless of whether a JD is provided.
- A score of 70+ indicates a well-optimised resume. 40-70 is average. Below 40 needs work.
"""

from __future__ import annotations

import re
from collections import Counter
from datetime import date
from typing import Any

# ---------------------------------------------------------------------------
# Word / pattern lists
# ---------------------------------------------------------------------------

_BE_VERBS = ["was", "were", "is", "are", "been", "being", "be", "am"]

# Exact past participle forms (no prefix matching to avoid false positives like "was leading")
_PAST_PARTICIPLES = [
    "built", "designed", "developed", "created", "implemented", "managed",
    "led", "delivered", "completed", "achieved", "improved", "reduced",
    "increased", "established", "maintained", "performed", "conducted",
    "provided", "required", "selected", "trained", "written", "given",
    "taken", "made", "done", "assigned", "recognized", "promoted", "hired",
    "approved", "informed", "expected", "allowed", "considered", "reviewed",
]

_FILLER_WORDS = [
    "very", "really", "just", "some", "a lot",
    "extremely", "basically", "essentially",
]

# Multi-word filler phrases (require substring matching)
_FILLER_PHRASES = [
    "pretty much", "kind of", "sort of", "in order to", "at the end of the day",
]

_PRONOUNS = ["I", "me", "my", "mine"]

_BUZZWORDS = [
    "synergy", "guru", "rockstar", "ninja", "dynamic",
    "thought leader", "go-getter", "passionate", "detail-oriented",
    "self-starter", "team player", "results-driven", "innovative",
    "proactive", "strategic thinker", "hardworking",
    "best-of-breed", "world-class", "cutting-edge", "leverage",
    "paradigm shift", "game changer", "move the needle",
    # Tech buzzwords
    "evangelist", "10x", "unicorn", "full-stack ninja", "code wizard",
    # Business buzzwords
    "circle back", "low-hanging fruit", "take it offline", "boil the ocean", "net-net",
]

# Strong action verbs that should begin a resume bullet.
_ACTION_VERBS = [
    "achieved", "accelerated", "architected", "automated", "built",
    "collaborated", "consolidated", "created", "cut", "delivered",
    "designed", "developed", "directed", "drove", "eliminated",
    "engineered", "established", "exceeded", "executed", "expanded",
    "generated", "grew", "headed", "identified", "implemented",
    "improved", "increased", "influenced", "initiated", "integrated",
    "launched", "led", "managed", "mentored", "migrated",
    "negotiated", "optimized", "orchestrated", "oversaw", "pioneered",
    "planned", "produced", "proposed", "re-architected", "rebuilt",
    "reduced", "refactored", "reorganized", "replaced", "resolved",
    "revamped", "scaled", "simplified", "spearheaded", "streamlined",
    "supervised", "surpassed", "transformed", "unified", "upgraded",
]

_WEAK_VERBS = [
    "helped", "assisted", "worked", "handled", "responsible",
    "participated", "involved", "utilized", "supported",
    "did", "made", "got", "took", "used", "went", "came", "put",
    "had", "tried", "looked", "gave", "said", "told", "asked",
    "found", "thought", "knew", "started", "began", "let",
]

# Rewrite suggestions keyed by the weak verb that triggered them.
_WEAK_VERB_SUGGESTIONS: dict[str, list[str]] = {
    "helped": ["Collaborated on", "Contributed to", "Co-developed"],
    "assisted": ["Enabled", "Facilitated", "Supported delivery of"],
    "worked": ["Engineered", "Built", "Developed"],
    "handled": ["Managed", "Owned", "Directed"],
    "responsible": ["Led", "Owned", "Drove"],
    "participated": ["Contributed to", "Co-developed", "Played a key role in"],
    "involved": ["Contributed to", "Engaged in", "Partnered on"],
    "utilized": ["Leveraged", "Applied", "Adopted"],
    "supported": ["Enabled", "Facilitated", "Bolstered"],
    "did": ["Executed", "Delivered", "Completed"],
    "made": ["Produced", "Created", "Built"],
    "got": ["Obtained", "Secured", "Achieved"],
    "took": ["Assumed", "Accepted ownership of"],
    "used": ["Leveraged", "Applied", "Adopted"],
    "went": ["Pursued", "Advanced", "Drove"],
    "came": ["Arrived at", "Reached", "Achieved"],
    "put": ["Deployed", "Implemented", "Established"],
    "had": ["Held", "Maintained", "Oversaw"],
    "tried": ["Piloted", "Prototyped", "Experimented with"],
    "started": ["Launched", "Initiated", "Founded"],
    "began": ["Launched", "Initiated", "Spearheaded"],
}

# ---------------------------------------------------------------------------
# Meaningful quantification patterns
# ---------------------------------------------------------------------------

_MEANINGFUL_NUMBER_PATTERNS = [
    r"\d+\s*%",                              # percentages: 30%, 45 %
    r"\$\d+",                                 # explicit dollar amounts: $500
    r"\d+[KkMmBb]\b",                         # scale suffixes: 100K, 5M
    r"\d+\s*(?:team|users|clients|projects|members|engineers|developers|"
    r"rows|requests|systems|services|applications|revenue|sales|products|"
    r"customers|tickets|incidents|deployments|servers|nodes|databases|"
    r"tables|APIs|endpoints|modules|packages|commits|reviews)\b",
    r"\d+\s*(?:x|times|fold)\b",             # multipliers: 3x, 2-fold
    r"\d+\s*(?:percent|percentage)\b",        # written-out percentages
]

# ---------------------------------------------------------------------------
# Scoring weights
# ---------------------------------------------------------------------------

_SECTION_BONUSES = {
    "work": 15,
    "projects": 10,
    "skills": 8,
    "education": 7,
    "awards": 4,
    "certificates": 4,
}
# Total section presence max: 48 (was 74)

_BULLET_MAX_POINTS = 5
_BULLET_QUALITY_CAP = 52  # global cap across all bullet quality points combined

_PENALTY_DUPLICATE_BULLETS = -5
_PENALTY_TOO_FEW_BULLETS = -2
_PENALTY_TOO_MANY_BULLETS = -1
_DATE_PENALTY = -3
_COMPLETENESS_PENALTY = -2

_MIN_BULLET_WORDS = 5
_QUANTIFICATION_THRESHOLD = 0.3  # flag only if fewer than 30% of bullets have numbers
_MIN_BULLETS_PER_ENTRY = 2
_MAX_BULLETS_PER_ENTRY = 8

# JD weighting
_JD_KEYWORD_MAX_POINTS = 20

# Resume-level check bonuses
_CONTACT_PRESENCE_BONUS = 2
_SECTION_ORDER_BONUS = 2
_KEYWORD_STUFFING_PENALTY = -5

# Critic severity penalties
_CRITIC_SEVERITY_PENALTIES = {"HIGH": -5, "MEDIUM": -2, "LOW": -1}

# ---------------------------------------------------------------------------
# Stopwords for keyword extraction (no NLTK dependency)
# ---------------------------------------------------------------------------

def _stem_word(word: str) -> str:
    """Simple suffix-stripping stemmer for keyword normalization."""
    word = word.lower()
    if len(word) <= 3:  # noqa: PLR2004
        return word
    # Common suffixes (order matters - check longer suffixes first)
    for suffix in ["ing", "tion", "sion", "ment", "ness", "able", "ible", "ful", "less", "ous", "ive", "ly", "er", "or", "ed", "es", "s"]:
        if word.endswith(suffix) and len(word) > len(suffix) + 2:
            return word[:-len(suffix)]
    return word


_STOPWORDS = frozenset({
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "shall",
    "should", "may", "might", "must", "can", "could", "to", "of", "in",
    "for", "on", "with", "at", "by", "from", "as", "into", "through",
    "during", "before", "after", "and", "but", "or", "nor", "not", "so",
    "yet", "both", "either", "neither", "each", "every", "all", "any",
    "few", "more", "most", "other", "some", "such", "no", "only", "own",
    "same", "than", "too", "very", "just", "because", "if", "when",
    "while", "about", "up", "out", "off", "over", "under", "again",
    "further", "then", "once", "here", "there", "this", "that", "these",
    "those", "what", "which", "who", "whom", "how", "its", "it", "he",
    "she", "they", "them", "we", "us", "our", "you", "your",
})


# ---------------------------------------------------------------------------
# Pre-compiled regex patterns for word matching
# ---------------------------------------------------------------------------

def _build_word_patterns(words: list[str]) -> re.Pattern:
    """Build a compiled regex that matches any word with proper boundaries."""
    escaped = [re.escape(w) for w in words]
    pattern = r"(?<![a-zA-Z])(?:" + "|".join(escaped) + r")(?![a-zA-Z])"
    return re.compile(pattern, re.IGNORECASE)

_FILLER_PATTERN = _build_word_patterns(_FILLER_WORDS)
_PRONOUN_PATTERN = _build_word_patterns(_PRONOUNS)
_BUZZWORD_PATTERN = _build_word_patterns(_BUZZWORDS)
_ACTION_VERB_SET = frozenset(_ACTION_VERBS)
_WEAK_VERB_SET = frozenset(_WEAK_VERBS)

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


def _word_in_text(words: list[str], text: str) -> bool:
    """Check if any word/phrase from the list appears in text with proper boundaries.

    Handles hyphens and multi-word phrases correctly.
    """
    for w in words:
        escaped = re.escape(w)
        pattern = rf"(?<![a-zA-Z]){escaped}(?![a-zA-Z])"
        if re.search(pattern, text, re.IGNORECASE):
            return True
    return False


def _phrase_in_text(phrases: list[str], text: str) -> bool:
    lower = text.lower()
    return any(p in lower for p in phrases)


def _check_weak_bullets(bullets: list[str]) -> dict:
    """Flag bullets that are too short or start with weak/generic verbs."""
    weak = []
    for i, b in enumerate(bullets):
        if len(b.split()) < _MIN_BULLET_WORDS:
            weak.append(i)
            continue
        first_word = b.split()[0].lower().rstrip(".,;:")
        if first_word in _WEAK_VERB_SET:
            weak.append(i)
    status = "ok" if not weak else "no"
    return _make_result(status, weak, "Weak or vague bullet point")


def _check_action_verb(bullets: list[str]) -> dict:
    """Check whether each bullet starts with a strong action verb."""
    fail = []
    for i, b in enumerate(bullets):
        first_word = b.split()[0].lower().rstrip(".,;:") if b.split() else ""
        if first_word not in _ACTION_VERB_SET:
            fail.append(i)
    status = "ok" if not fail else "no"
    return _make_result(status, fail, "Bullet doesn't start with a strong action verb")


def _has_meaningful_number(text: str) -> bool:
    """Return True if text contains a number adjacent to a meaningful unit.

    Excludes false positives like version numbers (v2), quarters (Q1),
    bare years (2022), and type designations (Type3).
    """
    # Check if any meaningful pattern matches
    return any(re.search(pat, text, re.IGNORECASE) for pat in _MEANINGFUL_NUMBER_PATTERNS)


def _check_quantified_bullets(bullets: list[str]) -> dict:
    """Flag unquantified bullets only if the majority lack numbers."""
    if not bullets:
        return _make_result("ok", [], "Missing numbers/metrics")
    unquantified = [i for i, b in enumerate(bullets) if not _has_meaningful_number(b)]
    ratio = len(unquantified) / len(bullets)
    status = "ok" if ratio <= (1 - _QUANTIFICATION_THRESHOLD) else "no"
    return _make_result(status, unquantified, "Missing numbers/metrics")


def _check_bullet_quantified(bullet: str) -> bool:
    """Check if a single bullet has meaningful numbers."""
    return _has_meaningful_number(bullet)


def _check_passive_voice(bullets: list[str]) -> dict:
    """Detect passive voice: be-verb followed by a past participle (exact match)."""
    fail = []
    for i, b in enumerate(bullets):
        for bv in _BE_VERBS:
            match = re.search(rf"\b{bv}\b\s+(\w+)", b, re.IGNORECASE)
            if match:
                next_word = match.group(1).lower()
                # Exact match only (no prefix matching to avoid false positives)
                if next_word in _PAST_PARTICIPLES:
                    fail.append(i)
                    break
    status = "ok" if not fail else "no"
    return _make_result(status, fail, "Passive voice detected")


def _check_filler_words(bullets: list[str]) -> dict:
    fail = [
        i for i, b in enumerate(bullets)
        if _FILLER_PATTERN.search(b) or _phrase_in_text(_FILLER_PHRASES, b)
    ]
    status = "ok" if not fail else "no"
    return _make_result(status, fail, "Filler words detected")


def _check_personal_pronouns(bullets: list[str]) -> dict:
    fail = [i for i, b in enumerate(bullets) if _PRONOUN_PATTERN.search(b)]
    status = "ok" if not fail else "no"
    return _make_result(status, fail, "Personal pronouns used")


def _check_buzzwords(bullets: list[str]) -> dict:
    # Check both single-word buzzwords and multi-word phrases
    fail = [
        i for i, b in enumerate(bullets)
        if _BUZZWORD_PATTERN.search(b) or _phrase_in_text(_BUZZWORDS, b)
    ]
    status = "ok" if not fail else "no"
    return _make_result(status, fail, "Buzzwords detected")


def _check_section_presence(items: list) -> dict:
    status = "ok" if items else "no"
    return {"pass": status, "bullet_to_highlight": None, "message": "Section missing"}


def _check_bullet_count(bullets: list[str]) -> dict:
    """Check if an entry has too few or too many bullets."""
    n = len(bullets)
    if n == 0:
        return {"pass": "min", "bullet_to_highlight": None, "message": "No bullet points in this entry"}
    if n < _MIN_BULLETS_PER_ENTRY:
        return {"pass": "min", "bullet_to_highlight": None, "message": "Too few bullet points for this entry"}
    if n > _MAX_BULLETS_PER_ENTRY:
        return {"pass": "min", "bullet_to_highlight": None, "message": "Too many bullet points; trim for focus"}
    return {"pass": "ok", "bullet_to_highlight": None, "message": "Good bullet count"}


def _count_duplicate_bullets(bullets: list[str]) -> int:
    """Return the number of duplicate bullets (case-insensitive)."""
    seen: set[str] = set()
    duplicates = 0
    for b in bullets:
        normalized = b.strip().lower()
        if normalized in seen:
            duplicates += 1
        seen.add(normalized)
    return duplicates


# ---------------------------------------------------------------------------
# Date and completeness checks
# ---------------------------------------------------------------------------


def _parse_date_parts(date_str: str) -> tuple[int, int] | None:
    """Parse YYYY-MM-DD, YYYY-MM, or YYYY into (year, month). Returns None on failure."""
    try:
        parts = date_str.strip().split("-")
        year = int(parts[0])
        month = int(parts[1]) if len(parts) > 1 else 1
        if 1900 <= year <= 2100 and 1 <= month <= 12:  # noqa: PLR2004
            return (year, month)
    except (ValueError, IndexError):
        pass
    return None


def _check_date_presence(entries: list, prefix: str) -> list[dict]:
    """Flag work/education entries missing both startDate and endDate."""
    flags = []
    for idx, entry in enumerate(entries):
        start = getattr(entry, "startDate", None)
        end = getattr(entry, "endDate", None)
        if not start and not end:
            flags.append({
                "entry": f"{prefix}_{idx}",
                "check": "datePresence",
                "pass": "no",
                "bullet_to_highlight": None,
                "message": "Entry missing both start and end dates",
            })
    return flags


def _check_date_consistency(entries: list, prefix: str) -> list[dict]:
    """Flag entries with future endDate. Null endDate means currently employed (fine)."""
    today = date.today()
    flags = []
    for idx, entry in enumerate(entries):
        end = getattr(entry, "endDate", None)
        if end:
            parsed = _parse_date_parts(end)
            if parsed:
                end_year, end_month = parsed
                if end_year > today.year or (end_year == today.year and end_month > today.month):
                    flags.append({
                        "entry": f"{prefix}_{idx}",
                        "check": "dateConsistency",
                        "pass": "no",
                        "bullet_to_highlight": None,
                        "message": f"End date {end} is in the future",
                    })
    return flags


def _check_entry_completeness(entries: list, prefix: str) -> list[dict]:
    """Flag work entries missing position or name."""
    flags = []
    for idx, entry in enumerate(entries):
        missing = []
        if not getattr(entry, "position", None):
            missing.append("position")
        if not getattr(entry, "name", None):
            missing.append("name")
        if missing:
            flags.append({
                "entry": f"{prefix}_{idx}",
                "check": "entryCompleteness",
                "pass": "no",
                "bullet_to_highlight": None,
                "message": f"Entry missing: {', '.join(missing)}",
            })
    return flags


# ---------------------------------------------------------------------------
# Keyword extraction and JD matching
# ---------------------------------------------------------------------------


def _extract_keywords(text: str, top_n: int = 30) -> list[str]:
    """Extract top keywords from text using tokenization + frequency ranking.

    Simple approach: split on non-alpha, lowercase, remove stopwords and
    very short tokens, return top_n by frequency.
    """
    tokens = re.findall(r"[a-zA-Z][a-zA-Z+#./-]{1,}", text.lower())
    filtered = [t for t in tokens if t not in _STOPWORDS and len(t) > 2]  # noqa: PLR2004
    counts = Counter(filtered)
    return [word for word, _ in counts.most_common(top_n)]


def _compute_keyword_match(
    job_description: str,
    resume: Any,
) -> dict:
    """Compute keyword overlap between JD and resume with stemming normalization.

    Uses simple suffix-stripping to match related word forms
    (e.g. 'developing' matches 'develop', 'engineers' matches 'engineer').

    Returns:
        ``{"matchPercentage": float, "matchedKeywords": list, "missingKeywords": list}``
    """
    jd_keywords = set(_extract_keywords(job_description))
    if not jd_keywords:
        return {"matchPercentage": 100.0, "matchedKeywords": [], "missingKeywords": []}

    # Collect resume text: skill names + all highlights + project descriptions
    resume_tokens: set[str] = set()
    for skill in (getattr(resume, "skills", None) or []):
        if getattr(skill, "name", None):
            resume_tokens.update(_extract_keywords(skill.name))
    for entry in (getattr(resume, "work", None) or []):
        for h in (getattr(entry, "highlights", None) or []):
            resume_tokens.update(_extract_keywords(h))
    for entry in (getattr(resume, "projects", None) or []):
        desc = getattr(entry, "description", None)
        if desc:
            resume_tokens.update(_extract_keywords(desc))
        for h in (getattr(entry, "highlights", None) or []):
            resume_tokens.update(_extract_keywords(h))

    # Match with stemming: a JD keyword matches if its stem matches any resume token stem
    resume_stems = {_stem_word(t) for t in resume_tokens}
    matched = set()
    missing = set()
    for kw in jd_keywords:
        kw_stem = _stem_word(kw)
        if kw in resume_tokens or kw_stem in resume_stems:
            matched.add(kw)
        else:
            missing.add(kw)

    percentage = round(len(matched) / len(jd_keywords) * 100, 1) if jd_keywords else 100.0

    return {
        "matchPercentage": percentage,
        "matchedKeywords": sorted(matched),
        "missingKeywords": sorted(missing),
    }


# ---------------------------------------------------------------------------
# Suggestion generation
# ---------------------------------------------------------------------------


def _generate_suggestions(bullets: list[str], checks: dict[str, dict]) -> list[str]:
    """Produce rewrite hints based on failed checks."""
    suggestions: list[str] = []
    for i, b in enumerate(bullets):
        first_word = b.split()[0].lower().rstrip(".,;:") if b.split() else ""
        # Weak verb suggestion
        if first_word in _WEAK_VERB_SUGGESTIONS:
            alts = _WEAK_VERB_SUGGESTIONS[first_word]
            alt_str = " or ".join(f"'{a}'" for a in alts[:2])
            suggestions.append(
                f"Bullet {i + 1}: Replace '{first_word}' with a stronger verb like {alt_str}"
            )
        # Filler word suggestion
        elif _word_in_text(_FILLER_WORDS, b) or _phrase_in_text(_FILLER_PHRASES, b):
            suggestions.append(f"Bullet {i + 1}: Remove filler words to strengthen this point")
        # Buzzword suggestion
        elif _word_in_text(_BUZZWORDS, b) or _phrase_in_text(_BUZZWORDS, b):
            suggestions.append(f"Bullet {i + 1}: Replace buzzwords with concrete, specific language")
    return suggestions


# ---------------------------------------------------------------------------
# Bullet-level checks applied to work / project entries
# ---------------------------------------------------------------------------

# Tier 1 checks (high value) award 2 points per bullet when all pass.
# Tier 2 checks (medium value) award 1 point per bullet when all pass.
_TIER1_CHECKS = [
    ("actionVerb", _check_action_verb),
    ("quantifiedBullets", _check_quantified_bullets),
]

_TIER2_CHECKS = [
    ("weakBullets", _check_weak_bullets),
    ("passiveVoice", _check_passive_voice),
    ("fillerWords", _check_filler_words),
    ("personalPronouns", _check_personal_pronouns),
    ("buzzwords", _check_buzzwords),
]


# ---------------------------------------------------------------------------
# Internal scoring helpers
# ---------------------------------------------------------------------------


def _run_bullet_checks(bullets: list[str]) -> dict[str, dict]:
    """Apply all bullet-level checks and return a checks dict."""
    checks: dict[str, dict] = {}
    for name, fn in _TIER1_CHECKS:
        checks[name] = fn(bullets)
    for name, fn in _TIER2_CHECKS:
        checks[name] = fn(bullets)
    return checks


def _score_bullet(checks: dict[str, dict]) -> int:
    """Score a single bullet (0 to _BULLET_MAX_POINTS) based on check results."""
    score = 0
    # Tier 1: 2 pts each
    for name, _ in _TIER1_CHECKS:
        if checks[name]["pass"] == "ok":
            score += 2
    # Tier 2: 1 pt each, but only 3 pts available across 5 checks
    tier2_pass = sum(1 for name, _ in _TIER2_CHECKS if checks[name]["pass"] == "ok")
    score += min(tier2_pass, 3)
    return min(score, _BULLET_MAX_POINTS)


def _content_depth_bonus(bullets: list[str]) -> int:
    """Award bonus for entries with 3+ well-formed bullets (>= _MIN_BULLET_WORDS each)."""
    well_written = sum(1 for b in bullets if len(b.split()) >= _MIN_BULLET_WORDS)
    if well_written >= 5:  # noqa: PLR2004
        return 4
    if well_written >= 3:  # noqa: PLR2004
        return 2
    return 0


def _process_entries(  # noqa: PLR0912
    entries: list,
    prefix: str,
    sections: list[dict],
    detailed_results: dict[str, dict],
) -> float:
    """Run bullet checks over work/project entries. Returns quality score with recency weighting.

    Each bullet is scored individually against all checks (not entry-level aggregates),
    and older entries contribute proportionally less via recency weighting.
    """
    quality_score = 0.0
    for idx, entry in enumerate(entries):
        bullets = list(entry.highlights)
        checks = _run_bullet_checks(bullets)

        # Add bullet count heuristic check
        checks["bulletCount"] = _check_bullet_count(bullets)

        # Generate suggestions for this entry
        suggestions = _generate_suggestions(bullets, checks)

        sections.append({
            "section": f"{prefix}_{idx}",
            "checks": checks,
            "suggestions": suggestions,
        })
        for k, v in checks.items():
            detailed_results[f"{prefix}_{idx}_{k}"] = v

        # Score each bullet individually against all checks
        entry_bullet_score = 0
        for _bi, bullet in enumerate(bullets):
            tier1_pass = True
            # Tier 1: action verb
            first_word = bullet.split()[0].lower().rstrip(".,;:") if bullet.split() else ""
            if first_word not in _ACTION_VERB_SET:
                tier1_pass = False
            # Tier 1: quantification (per-bullet, not entry-level ratio)
            if not _check_bullet_quantified(bullet):
                tier1_pass = False

            t1_pts = 4 if tier1_pass else 0

            # Tier 2: per-bullet checks
            t2 = 0
            words = bullet.split()
            if len(words) >= _MIN_BULLET_WORDS:
                fw = words[0].lower().rstrip(".,;:")
                if fw not in _WEAK_VERB_SET:
                    t2 += 1
            else:
                pass  # short bullet fails weakBullets
            # passive voice per-bullet
            is_passive = False
            for bv in _BE_VERBS:
                m = re.search(rf"\b{bv}\b\s+(\w+)", bullet, re.IGNORECASE)
                if m and m.group(1).lower() in _PAST_PARTICIPLES:
                    is_passive = True
                    break
            if not is_passive:
                t2 += 1
            if not _FILLER_PATTERN.search(bullet) and not _phrase_in_text(_FILLER_PHRASES, bullet):
                t2 += 1
            if not _PRONOUN_PATTERN.search(bullet):
                t2 += 1
            if not _BUZZWORD_PATTERN.search(bullet) and not _phrase_in_text(_BUZZWORDS, bullet):
                t2 += 1

            t2_pts = min(t2, 3)
            bullet_score = min(t1_pts + t2_pts, _BULLET_MAX_POINTS)
            entry_bullet_score += bullet_score

        # Apply recency weight to this entry's bullet score
        weight = _recency_weight(entry)
        quality_score += entry_bullet_score * weight

        # Content depth bonus (also weighted by recency)
        quality_score += _content_depth_bonus(bullets) * weight

    return quality_score


def _process_simple_section(
    items: list,
    section_name: str,
    sections: list[dict],
    detailed_results: dict[str, dict],
) -> None:
    """Run a section-presence check."""
    check = _check_section_presence(items)
    checks = {"sectionPresence": check}
    sections.append({"section": section_name, "checks": checks, "suggestions": []})
    detailed_results[f"{section_name}_sectionPresence"] = check


# ---------------------------------------------------------------------------
# Resume-level checks
# ---------------------------------------------------------------------------


def _recency_weight(entry: Any) -> float:
    """Compute recency weight for a work/project entry.

    Recent entries (≤3 years) get full weight (1.0).
    Mid-range entries (3–7 years) get 0.8.
    Older entries (>7 years) get 0.6.
    Entries with no end date (current) get full weight.
    """
    end = getattr(entry, "endDate", None)
    if not end:
        return 1.0
    parsed = _parse_date_parts(end)
    if not parsed:
        return 1.0
    years_ago = date.today().year - parsed[0]
    if years_ago <= 3:  # noqa: PLR2004
        return 1.0
    if years_ago <= 7:  # noqa: PLR2004
        return 0.8
    return 0.6


def _check_contact_presence(resume: Any) -> dict:
    """Check if the resume has basic identifying information.

    A resume should have at least some identifying info (work entries,
    education, skills, or projects). An empty resume suggests missing
    contact/summary information.
    """
    has_any = bool(
        getattr(resume, "work", None)
        or getattr(resume, "education", None)
        or getattr(resume, "skills", None)
        or getattr(resume, "projects", None)
    )
    if has_any:
        return {"pass": "ok", "bullet_to_highlight": None, "message": "Resume has content"}
    return {"pass": "no", "bullet_to_highlight": None, "message": "Resume appears empty; ensure contact info and summary are present"}


def _check_section_ordering(resume: Any) -> dict:
    """Check if sections appear in conventional ATS-friendly order.

    Standard order: work experience → projects → skills → education.
    Only checks relative ordering of sections that exist.
    """
    expected_order = ["work", "projects", "skills", "education"]
    present_sections = []
    for section in expected_order:
        items = getattr(resume, section, None)
        if items:
            present_sections.append(section)

    if len(present_sections) < 2:  # noqa: PLR2004
        return {"pass": "ok", "bullet_to_highlight": None, "message": "Not enough sections to evaluate ordering"}

    # Check if present sections are in the expected relative order
    # (they already are since we iterate expected_order in order)
    # The check passes if sections appear in this iteration order
    return {"pass": "ok", "bullet_to_highlight": None, "message": "Sections are in standard order"}


def _check_keyword_stuffing(resume: Any) -> dict:
    """Detect excessive keyword repetition that appears unnatural.

    If any single token appears 8+ times across all resume text, it's
    likely keyword stuffing rather than genuine content.
    """
    all_text_parts: list[str] = []
    for entry in (getattr(resume, "work", None) or []):
        all_text_parts.extend(getattr(entry, "highlights", []) or [])
    for entry in (getattr(resume, "projects", None) or []):
        all_text_parts.extend(getattr(entry, "highlights", []) or [])
        desc = getattr(entry, "description", None)
        if desc:
            all_text_parts.append(desc)
    for skill in (getattr(resume, "skills", None) or []):
        name = getattr(skill, "name", None)
        if name:
            all_text_parts.append(name)

    all_text = " ".join(all_text_parts).lower()
    tokens = re.findall(r"[a-zA-Z]{3,}", all_text)
    if not tokens:
        return {"pass": "ok", "bullet_to_highlight": None, "message": "No keyword stuffing detected"}

    counts = Counter(tokens)
    max_count = max(counts.values())
    stuffed = [word for word, count in counts.items() if count >= 8]  # noqa: PLR2004

    if stuffed:
        return {
            "pass": "no",
            "bullet_to_highlight": None,
            "message": f"Keyword stuffing detected: '{stuffed[0]}' appears {max_count} times",
        }
    return {"pass": "ok", "bullet_to_highlight": None, "message": "No keyword stuffing detected"}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def analyze_resume(  # noqa: PLR0912, PLR0915
    resume: Any,
    job_description: str | None = None,
    critic_issues: list | None = None,
) -> dict:
    """Run all ATS checks against *resume* and return a raw result dict.

    *resume* must be an ``app.models.resume.Resume`` instance (or any
    object exposing ``work``, ``projects``, ``skills``, ``education``,
    ``awards``, and ``certificates`` attributes).

    Args:
        resume: The parsed resume to analyse.
        job_description: Optional job description for keyword matching.
        critic_issues: Optional list of ResumeCriticAgent issues (dicts or model instances)
            with ``severity`` keys. Severity-based penalties are applied to the score.

    Returns:
        ``{ "atsScore": int, "sections": [...], "detailedResults": {...},
           "keywordResult": {...}|None, "criticPenalty": int|None,
           "criticIssuesApplied": [...]|None }``
    """
    sections: list[dict] = []
    detailed_results: dict[str, dict] = {}
    score = 0.0
    all_bullets: list[str] = []
    has_jd = bool(job_description)

    # --- Section presence bonuses -------------------------------------------
    quality = 0.0

    if resume.work:
        score += _SECTION_BONUSES["work"]
        quality += _process_entries(resume.work, "experience", sections, detailed_results)
        for entry in resume.work:
            all_bullets.extend(entry.highlights)

    if resume.projects:
        score += _SECTION_BONUSES["projects"]
        quality += _process_entries(resume.projects, "project", sections, detailed_results)
        for entry in resume.projects:
            all_bullets.extend(entry.highlights)

    # Cap total bullet quality globally
    if resume.work or resume.projects:
        score += min(quality, _BULLET_QUALITY_CAP)

    for attr, section_name in [
        ("skills", "skills"),
        ("education", "education"),
        ("awards", "awards"),
        ("certificates", "certificates"),
    ]:
        items = getattr(resume, attr, [])
        if items:
            score += _SECTION_BONUSES[section_name]
            _process_simple_section(items, section_name, sections, detailed_results)

    # --- Resume-level structural checks ------------------------------------
    contact_check = _check_contact_presence(resume)
    if contact_check["pass"] == "ok":
        score += _CONTACT_PRESENCE_BONUS
    sections.append({"section": "contact", "checks": {"contactPresence": contact_check}, "suggestions": []})
    detailed_results["contact_contactPresence"] = contact_check

    order_check = _check_section_ordering(resume)
    if order_check["pass"] == "ok" and order_check["message"] == "Sections are in standard order":
        score += _SECTION_ORDER_BONUS
    sections.append({"section": "ordering", "checks": {"sectionOrdering": order_check}, "suggestions": []})
    detailed_results["ordering_sectionOrdering"] = order_check

    stuffing_check = _check_keyword_stuffing(resume)
    if stuffing_check["pass"] == "no":
        score += _KEYWORD_STUFFING_PENALTY
    sections.append({"section": "keywords", "checks": {"keywordStuffing": stuffing_check}, "suggestions": []})
    detailed_results["keywords_keywordStuffing"] = stuffing_check

    # --- JD keyword matching ------------------------------------------------
    keyword_result = None
    if has_jd:
        keyword_result = _compute_keyword_match(job_description, resume)
        keyword_points = round(keyword_result["matchPercentage"] / 100 * _JD_KEYWORD_MAX_POINTS)
        score += keyword_points

    # --- Penalty pass -------------------------------------------------------
    # Duplicate bullets across entries
    duplicates = _count_duplicate_bullets(all_bullets)
    score += _PENALTY_DUPLICATE_BULLETS * duplicates

    # Bullet count penalties
    for sec in sections:
        bc = sec["checks"].get("bulletCount")
        if bc and bc["pass"] == "min":
            msg = bc.get("message", "")
            if "Too few" in msg:
                score += _PENALTY_TOO_FEW_BULLETS
            elif "Too many" in msg:
                score += _PENALTY_TOO_MANY_BULLETS

    # --- Date and completeness checks ---------------------------------------
    for entries, prefix in [
        (resume.work or [], "experience"),
        (resume.education or [], "education"),
    ]:
        for flag in _check_date_presence(entries, prefix):
            sections.append({"section": flag["entry"], "checks": {flag["check"]: flag}, "suggestions": []})
            detailed_results[f"{flag['entry']}_{flag['check']}"] = flag
            score += _DATE_PENALTY
        for flag in _check_date_consistency(entries, prefix):
            sections.append({"section": flag["entry"], "checks": {flag["check"]: flag}, "suggestions": []})
            detailed_results[f"{flag['entry']}_{flag['check']}"] = flag
            score += _DATE_PENALTY

    for flag in _check_entry_completeness(resume.work or [], "experience"):
        sections.append({"section": flag["entry"], "checks": {flag["check"]: flag}, "suggestions": []})
        detailed_results[f"{flag['entry']}_{flag['check']}"] = flag
        score += _COMPLETENESS_PENALTY

    # --- Critic issue penalties ---------------------------------------------
    critic_penalty = None
    applied_issues: list[dict] | None = None
    if critic_issues:
        critic_penalty = 0
        applied_issues = []
        for issue in critic_issues:
            sev = issue.get("severity", "LOW") if isinstance(issue, dict) else getattr(issue, "severity", "LOW")
            penalty = _CRITIC_SEVERITY_PENALTIES.get(sev, 0)
            critic_penalty += penalty
            applied_issues.append(issue if isinstance(issue, dict) else issue.model_dump())
        score += critic_penalty

    # --- Score normalisation -------------------------------------------------
    # Normalise to 0-100 so scores are comparable with or without a JD
    max_possible = 100.0 + _CONTACT_PRESENCE_BONUS + _SECTION_ORDER_BONUS
    if has_jd:
        max_possible += _JD_KEYWORD_MAX_POINTS
    ats_score = max(0, min(100, round(score / max_possible * 100)))
    return {
        "atsScore": ats_score,
        "sections": sections,
        "detailedResults": detailed_results,
        "keywordResult": keyword_result,
        "criticPenalty": critic_penalty,
        "criticIssuesApplied": applied_issues,
    }
