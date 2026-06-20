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

import math
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

# Input validation limits
_MAX_BULLET_LENGTH = 500
_MAX_ENTRIES_PER_SECTION = 20
_MAX_BULLETS_PER_ENTRY_LIMIT = 20
_HTML_TAG_PATTERN = re.compile(r"<[^>]+>")

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

_STEM_SUFFIXES = [
    "ational", "tional", "enci", "anci", "izer", "isation", "ization",
    "ation", "ator", "alism", "aliti", "alli", "entli", "eli", "ousli",
    "bling", "ing", "tion", "sion", "ment", "ness", "able", "ible",
    "ful", "less", "ous", "ive", "ly", "er", "or", "ed", "es", "s",
]

_MIN_STEM_LEN = 3


def _stem_word(word: str) -> str:
    """Improved suffix-stripping stemmer with ordered suffix rules."""
    word = word.lower().strip()
    if len(word) <= _MIN_STEM_LEN:
        return word
    for suffix in _STEM_SUFFIXES:
        if word.endswith(suffix):
            stem = word[: -len(suffix)]
            if len(stem) >= _MIN_STEM_LEN:
                return stem
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
_BE_VERB_PATTERN = re.compile(
    r"\b(?:" + "|".join(_BE_VERBS) + r")\b\s+(\w+)",
    re.IGNORECASE,
)

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


_PASSIVE_PARTICIPLE_SUFFIXES = ("ed", "en", "wn", "ne", "lt", "pt", "nt")
_PASSIVE_FALSE_POSITIVES = frozenset({
    "responsible", "able", "interested", "experienced", "dedicated",
    "motivated", "organized", "determined", "talented", "qualified",
    "prepared", "based", "used", "focused", "needed", "required",
    "named", "known", "given", "leading", "working", "building",
    "managing", "running", "going", "becoming", "having",
})


def _is_likely_past_participle(word: str) -> bool:
    """Heuristic check if a word is likely a past participle."""
    w = word.lower()
    if w in _PAST_PARTICIPLES:
        return True
    if w in _PASSIVE_FALSE_POSITIVES:
        return False
    if len(w) <= 3:  # noqa: PLR2004
        return False
    return any(w.endswith(suffix) for suffix in _PASSIVE_PARTICIPLE_SUFFIXES)


def _check_passive_voice(bullets: list[str]) -> dict:
    """Detect passive voice: be-verb followed by a likely past participle."""
    fail = []
    for i, b in enumerate(bullets):
        match = _BE_VERB_PATTERN.search(b)
        if match:
            next_word = match.group(1).lower()
            if _is_likely_past_participle(next_word):
                fail.append(i)
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
        normalized = b.strip().lower().rstrip(".,;:!?")
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


def _extract_ngrams(text: str, n: int) -> list[str]:
    """Extract n-grams from text after stopword removal."""
    tokens = re.findall(r"[a-zA-Z][a-zA-Z+#./-]{1,}", text.lower())
    filtered = [t for t in tokens if t not in _STOPWORDS and len(t) > 2]  # noqa: PLR2004
    if len(filtered) < n:
        return []
    return [" ".join(filtered[i : i + n]) for i in range(len(filtered) - n + 1)]


def _extract_keywords(text: str, top_n: int = 30) -> list[str]:
    """Extract top keywords with n-gram support (unigrams + bigrams + trigrams).

    Multi-word terms get a frequency boost when they appear 2+ times.
    """
    if not text or not text.strip():
        return []

    unigrams = _extract_ngrams(text, 1)
    bigrams = _extract_ngrams(text, 2)
    trigrams = _extract_ngrams(text, 3)

    counts: Counter = Counter()
    counts.update(unigrams)
    # Bigrams/trigrams: count occurrences, add with a weight boost
    for ngram_list, weight in [(bigrams, 1.5), (trigrams, 2.0)]:
        ngram_counts = Counter(ngram_list)
        for ngram, freq in ngram_counts.items():
            # Include any n-gram (weighted count > 1 ensures it ranks above rare unigrams)
            counts[ngram] = round(freq * weight)

    return [word for word, _ in counts.most_common(top_n)]


def _compute_keyword_match(
    job_description: str,
    resume: Any,
    jd_keywords: set[str] | None = None,
) -> dict:
    """Compute keyword overlap between JD and resume with stemming normalization.

    Uses simple suffix-stripping to match related word forms
    (e.g. 'developing' matches 'develop', 'engineers' matches 'engineer').

    Returns:
        ``{"matchPercentage": float, "matchedKeywords": list, "missingKeywords": list}``
    """
    if jd_keywords is None:
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
# Semantic similarity (cosine similarity)
# ---------------------------------------------------------------------------


def _tokenize_to_bag(text: str) -> dict[str, float]:
    """Tokenize text into a normalized term-frequency bag."""
    tokens = re.findall(r"[a-zA-Z][a-zA-Z+#./-]{1,}", text.lower())
    filtered = [t for t in tokens if t not in _STOPWORDS and len(t) > 2]  # noqa: PLR2004
    if not filtered:
        return {}
    counts = Counter(filtered)
    total = len(filtered)
    return {term: count / total for term, count in counts.items()}


def _cosine_similarity(a: dict[str, float], b: dict[str, float]) -> float:
    """Compute cosine similarity between two TF vectors."""
    common_keys = set(a.keys()) & set(b.keys())
    if not common_keys:
        return 0.0
    dot = sum(a[k] * b[k] for k in common_keys)
    mag_a = math.sqrt(sum(v * v for v in a.values()))
    mag_b = math.sqrt(sum(v * v for v in b.values()))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


def _collect_resume_text(resume: Any) -> str:
    """Flatten all resume text into a single string."""
    parts: list[str] = []
    for skill in (getattr(resume, "skills", None) or []):
        if getattr(skill, "name", None):
            parts.append(skill.name)
    for entry in (getattr(resume, "work", None) or []):
        for h in (getattr(entry, "highlights", None) or []):
            parts.append(h)
    for entry in (getattr(resume, "projects", None) or []):
        desc = getattr(entry, "description", None)
        if desc:
            parts.append(desc)
        for h in (getattr(entry, "highlights", None) or []):
            parts.append(h)
    return " ".join(parts)


def _compute_semantic_similarity(job_description: str, resume: Any) -> float:
    """Compute cosine similarity between JD and resume text.

    Returns a float between 0.0 and 1.0 representing semantic alignment.
    """
    if not job_description or not job_description.strip():
        return 0.0
    jd_bag = _tokenize_to_bag(job_description)
    resume_text = _collect_resume_text(resume)
    resume_bag = _tokenize_to_bag(resume_text)
    return round(_cosine_similarity(jd_bag, resume_bag), 4)


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
        elif _FILLER_PATTERN.search(b) or _phrase_in_text(_FILLER_PHRASES, b):
            suggestions.append(f"Bullet {i + 1}: Remove filler words to strengthen this point")
        # Buzzword suggestion
        elif _BUZZWORD_PATTERN.search(b) or _phrase_in_text(_BUZZWORDS, b):
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
            m = _BE_VERB_PATTERN.search(bullet)
            if m and _is_likely_past_participle(m.group(1)):
                is_passive = True
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
    """Check if the resume has substantive content beyond just metadata.

    A resume with work experience or projects is considered complete.
    A resume with only skills or education is minimal (may lack context).
    An empty resume fails.
    """
    has_work_or_projects = bool(getattr(resume, "work", None) or getattr(resume, "projects", None))
    has_skills = bool(getattr(resume, "skills", None))
    has_education = bool(getattr(resume, "education", None))

    if has_work_or_projects:
        return {"pass": "ok", "bullet_to_highlight": None, "message": "Resume has substantive content"}
    if has_skills or has_education:
        return {"pass": "min", "bullet_to_highlight": None, "message": "Resume has only skills/education; add work experience or projects for stronger ATS performance"}
    return {"pass": "no", "bullet_to_highlight": None, "message": "Resume appears empty; ensure work experience and contact info are present"}


def _check_section_ordering(resume: Any) -> dict:
    """Check if sections appear in conventional ATS-friendly order.

    Standard order: work experience → projects → skills → education.
    Note: The structured Resume model doesn't preserve original document
    section ordering. This check validates that the expected sections
    exist (presence) rather than their document-level ordering.
    A dedicated parser would be needed for true ordering validation.
    """
    expected_order = ["work", "projects", "skills", "education"]
    present_sections = [s for s in expected_order if getattr(resume, s, None)]

    if len(present_sections) < 2:  # noqa: PLR2004
        return {"pass": "ok", "bullet_to_highlight": None, "message": "Not enough sections to evaluate ordering"}

    # Without document-level order metadata, we can only confirm presence
    return {"pass": "ok", "bullet_to_highlight": None, "message": "Required sections present"}


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


def _check_skills_relevance(
    job_description: str | None,
    resume: Any,
    jd_keywords: set[str] | None = None,
) -> dict:
    """Cross-reference skills section against JD keywords.

    Returns relevant/irrelevant skill names and a pass status.
    """
    skills = getattr(resume, "skills", None) or []
    skill_names = [s.name for s in skills if getattr(s, "name", None)]

    if not skill_names:
        return {
            "pass": "min",
            "bullet_to_highlight": None,
            "message": "No skills listed",
            "relevant_skills": [],
            "irrelevant_skills": [],
        }

    if not job_description:
        return {
            "pass": "ok",
            "bullet_to_highlight": None,
            "message": "Skills listed (no JD to compare against)",
            "relevant_skills": skill_names,
            "irrelevant_skills": [],
        }

    if jd_keywords is None:
        jd_keywords_stemmed = {_stem_word(k) for k in _extract_keywords(job_description)}
    else:
        jd_keywords_stemmed = {_stem_word(k) for k in jd_keywords}
    relevant = []
    irrelevant = []
    for name in skill_names:
        skill_stems = {_stem_word(t) for t in _extract_keywords(name)}
        if skill_stems & jd_keywords_stemmed:
            relevant.append(name)
        else:
            irrelevant.append(name)

    ratio = len(relevant) / len(skill_names) if skill_names else 0
    status = "ok" if ratio >= 0.3 else "no"  # noqa: PLR2004

    return {
        "pass": status,
        "bullet_to_highlight": None,
        "message": f"{len(relevant)}/{len(skill_names)} skills match JD keywords",
        "relevant_skills": relevant,
        "irrelevant_skills": irrelevant,
    }


# ---------------------------------------------------------------------------
# Input validation
# ---------------------------------------------------------------------------


def _sanitize_text(text: str) -> str:
    """Strip HTML tags and truncate to max bullet length."""
    text = _HTML_TAG_PATTERN.sub("", text)
    if len(text) > _MAX_BULLET_LENGTH:
        text = text[:_MAX_BULLET_LENGTH]
    return text.strip()


def _validate_and_sanitize_resume(resume: Any) -> list[str]:
    """Validate and sanitize resume inputs. Returns list of warnings."""
    warnings: list[str] = []
    for section_attr in ("work", "projects"):
        entries = getattr(resume, section_attr, None) or []
        if len(entries) > _MAX_ENTRIES_PER_SECTION:
            warnings.append(
                f"{section_attr}: truncated from {len(entries)} to {_MAX_ENTRIES_PER_SECTION} entries"
            )
            setattr(resume, section_attr, entries[:_MAX_ENTRIES_PER_SECTION])
            entries = getattr(resume, section_attr)
        for entry in entries:
            highlights = getattr(entry, "highlights", None) or []
            if len(highlights) > _MAX_BULLETS_PER_ENTRY_LIMIT:
                warnings.append(
                    f"{section_attr} entry: truncated from {len(highlights)} to {_MAX_BULLETS_PER_ENTRY_LIMIT} bullets"
                )
                entry.highlights = highlights[:_MAX_BULLETS_PER_ENTRY_LIMIT]
                highlights = entry.highlights
            for i, h in enumerate(highlights):
                sanitized = _sanitize_text(h)
                if sanitized != h:
                    warnings.append("Bullet sanitized (HTML stripped or truncated)")
                    highlights[i] = sanitized
    return warnings


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
           "criticIssuesApplied": [...]|None,
           "semanticScore": float|None, "scoreBreakdown": {...} }``
    """
    sections: list[dict] = []
    detailed_results: dict[str, dict] = {}
    score = 0.0
    all_bullets: list[str] = []
    has_jd = bool(job_description)

    # --- Input validation -------------------------------------------------------
    validation_warnings = _validate_and_sanitize_resume(resume)

    # --- Score breakdown tracker -------------------------------------------
    breakdown: dict[str, float] = {
        "section_presence": 0.0,
        "bullet_quality": 0.0,
        "jd_keyword_match": 0.0,
        "semantic_match": 0.0,
        "bonuses": 0.0,
        "penalties": 0.0,
    }

    # --- Section presence bonuses -------------------------------------------
    quality = 0.0

    if resume.work:
        breakdown["section_presence"] += _SECTION_BONUSES["work"]
        quality += _process_entries(resume.work, "experience", sections, detailed_results)
        for entry in resume.work:
            all_bullets.extend(entry.highlights)

    if resume.projects:
        breakdown["section_presence"] += _SECTION_BONUSES["projects"]
        quality += _process_entries(resume.projects, "project", sections, detailed_results)
        for entry in resume.projects:
            all_bullets.extend(entry.highlights)

    # Cap total bullet quality globally
    if resume.work or resume.projects:
        capped_quality = min(quality, _BULLET_QUALITY_CAP)
        breakdown["bullet_quality"] = capped_quality

    for attr, section_name in [
        ("skills", "skills"),
        ("education", "education"),
        ("awards", "awards"),
        ("certificates", "certificates"),
    ]:
        items = getattr(resume, attr, [])
        if items:
            breakdown["section_presence"] += _SECTION_BONUSES[section_name]
            _process_simple_section(items, section_name, sections, detailed_results)

    score += breakdown["section_presence"] + breakdown["bullet_quality"]

    # --- Resume-level structural checks ------------------------------------
    contact_check = _check_contact_presence(resume)
    if contact_check["pass"] == "ok":
        breakdown["bonuses"] += _CONTACT_PRESENCE_BONUS
    sections.append({"section": "contact", "checks": {"contactPresence": contact_check}, "suggestions": []})
    detailed_results["contact_contactPresence"] = contact_check

    order_check = _check_section_ordering(resume)
    # Don't award ordering bonus — the structured model can't validate true document ordering
    sections.append({"section": "ordering", "checks": {"sectionOrdering": order_check}, "suggestions": []})
    detailed_results["ordering_sectionOrdering"] = order_check

    stuffing_check = _check_keyword_stuffing(resume)
    if stuffing_check["pass"] == "no":
        breakdown["penalties"] += _KEYWORD_STUFFING_PENALTY
    sections.append({"section": "keywords", "checks": {"keywordStuffing": stuffing_check}, "suggestions": []})
    detailed_results["keywords_keywordStuffing"] = stuffing_check

    score += breakdown["bonuses"]

    # --- JD keyword matching ------------------------------------------------
    jd_keywords_raw: list[str] = []
    if has_jd:
        jd_keywords_raw = _extract_keywords(job_description)

    keyword_result = None
    if has_jd:
        keyword_result = _compute_keyword_match(job_description, resume, jd_keywords=set(jd_keywords_raw))
        keyword_points = round(keyword_result["matchPercentage"] / 100 * _JD_KEYWORD_MAX_POINTS)
        breakdown["jd_keyword_match"] = float(keyword_points)
        score += keyword_points

    # --- Semantic similarity (when JD provided) ----------------------------
    semantic_score: float | None = None
    if has_jd:
        semantic_score = _compute_semantic_similarity(job_description, resume)
        semantic_points = round(semantic_score * 10)
        breakdown["semantic_match"] = float(semantic_points)
        score += semantic_points

    # --- Skills relevance check (when JD provided) -------------------------
    if has_jd:
        skills_check = _check_skills_relevance(job_description, resume, jd_keywords=set(jd_keywords_raw))
        sections.append({"section": "skills_relevance", "checks": {"skillsRelevance": skills_check}, "suggestions": []})
        detailed_results["skills_relevance_skillsRelevance"] = skills_check

    # --- Penalty pass -------------------------------------------------------
    # Duplicate bullets across entries
    duplicates = _count_duplicate_bullets(all_bullets)
    breakdown["penalties"] += _PENALTY_DUPLICATE_BULLETS * duplicates

    # Bullet count penalties
    for sec in sections:
        bc = sec["checks"].get("bulletCount")
        if bc and bc["pass"] == "min":
            msg = bc.get("message", "")
            if "Too few" in msg:
                breakdown["penalties"] += _PENALTY_TOO_FEW_BULLETS
            elif "Too many" in msg:
                breakdown["penalties"] += _PENALTY_TOO_MANY_BULLETS

    # --- Date and completeness checks ---------------------------------------
    for entries, prefix in [
        (resume.work or [], "experience"),
        (resume.education or [], "education"),
    ]:
        for flag in _check_date_presence(entries, prefix):
            sections.append({"section": flag["entry"], "checks": {flag["check"]: flag}, "suggestions": []})
            detailed_results[f"{flag['entry']}_{flag['check']}"] = flag
            breakdown["penalties"] += _DATE_PENALTY
        for flag in _check_date_consistency(entries, prefix):
            sections.append({"section": flag["entry"], "checks": {flag["check"]: flag}, "suggestions": []})
            detailed_results[f"{flag['entry']}_{flag['check']}"] = flag
            breakdown["penalties"] += _DATE_PENALTY

    for flag in _check_entry_completeness(resume.work or [], "experience"):
        sections.append({"section": flag["entry"], "checks": {flag["check"]: flag}, "suggestions": []})
        detailed_results[f"{flag['entry']}_{flag['check']}"] = flag
        breakdown["penalties"] += _COMPLETENESS_PENALTY

    # --- Critic issue penalties ---------------------------------------------
    critic_penalty: int | None = None
    applied_issues: list[dict] | None = None
    if critic_issues:
        critic_penalty = 0
        applied_issues = []
        for issue in critic_issues:
            sev = issue.get("severity", "LOW") if isinstance(issue, dict) else getattr(issue, "severity", "LOW")
            penalty = _CRITIC_SEVERITY_PENALTIES.get(sev, 0)
            critic_penalty += penalty
            applied_issues.append(issue if isinstance(issue, dict) else issue.model_dump())
        breakdown["penalties"] += float(critic_penalty)

    # Apply all penalties to score
    score += breakdown["penalties"]

    # --- Score normalisation -------------------------------------------------
    # Normalise to 0-100 so scores are comparable with or without a JD
    max_possible = 100.0 + _CONTACT_PRESENCE_BONUS  # ordering bonus removed
    if has_jd:
        max_possible += _JD_KEYWORD_MAX_POINTS + 10  # +10 for semantic
    ats_score = max(0, min(100, round(score / max_possible * 100)))

    breakdown["raw_score"] = score
    breakdown["max_possible"] = max_possible

    return {
        "atsScore": ats_score,
        "sections": sections,
        "detailedResults": detailed_results,
        "keywordResult": keyword_result,
        "criticPenalty": critic_penalty,
        "criticIssuesApplied": applied_issues,
        "semanticScore": semantic_score,
        "scoreBreakdown": breakdown,
        "validationWarnings": validation_warnings,
    }
