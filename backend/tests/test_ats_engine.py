"""Tests for the ATS scoring engine and endpoint."""

import os

os.environ["DEBUG"] = "false"
os.environ.setdefault("GEMINI_API_KEY", "test-gemini-api-key")

from fastapi.testclient import TestClient

from app.main import app
from app.models.base import Award, Certificate, Education, Project, Skill, Work
from app.models.resume import Resume
from app.utils.ats_engine import (
    _check_action_verb,
    _check_bullet_count,
    _check_bullet_quantified,
    _check_buzzwords,
    _check_contact_presence,
    _check_date_consistency,
    _check_date_presence,
    _check_entry_completeness,
    _check_filler_words,
    _check_keyword_stuffing,
    _check_passive_voice,
    _check_personal_pronouns,
    _check_quantified_bullets,
    _check_section_ordering,
    _check_section_presence,
    _check_weak_bullets,
    _compute_keyword_match,
    _compute_semantic_similarity,
    _count_duplicate_bullets,
    _extract_keywords,
    _generate_suggestions,
    _has_meaningful_number,
    _recency_weight,
    _sanitize_text,
    _stem_word,
    analyze_resume,
)

# ---------------------------------------------------------------------------
# Individual check unit tests
# ---------------------------------------------------------------------------


class TestCheckWeakBullets:
    def test_good_bullets(self):
        result = _check_weak_bullets(["Managed a team of 5 engineers", "Built ETL pipelines processing 1M rows daily"])
        assert result["pass"] == "ok"
        assert result["bullet_to_highlight"] is None

    def test_short_bullet_flagged(self):
        result = _check_weak_bullets(["Short", "Also short text", "This bullet is long enough"])
        assert result["pass"] == "no"
        assert result["bullet_to_highlight"] == [0, 1]

    def test_empty_list(self):
        result = _check_weak_bullets([])
        assert result["pass"] == "ok"

    def test_new_weak_verbs_flagged(self):
        result = _check_weak_bullets(["Did the project for the client team", "Used the framework across services"])
        assert result["pass"] == "no"
        assert result["bullet_to_highlight"] == [0, 1]


class TestCheckQuantifiedBullets:
    def test_all_quantified(self):
        result = _check_quantified_bullets(["Increased revenue by 30%", "Managed 12 engineers"])
        assert result["pass"] == "ok"

    def test_missing_numbers(self):
        result = _check_quantified_bullets(["Increased revenue significantly", "Managed a large team"])
        assert result["pass"] == "no"
        assert result["bullet_to_highlight"] == [0, 1]

    def test_mixed(self):
        # 1 of 2 bullets unquantified = 50%, below the 70% threshold → ok
        result = _check_quantified_bullets(["Grew sales by 25%", "Led team building activities"])
        assert result["pass"] == "ok"

    def test_version_number_not_quantified(self):
        assert not _has_meaningful_number("Migrated to v2 architecture")

    def test_percentage_is_quantified(self):
        assert _has_meaningful_number("Increased throughput by 40%")

    def test_team_size_is_quantified(self):
        assert _has_meaningful_number("Managed 12 engineers")

    def test_bare_year_not_quantified(self):
        assert not _has_meaningful_number("Joined in 2022")

    def test_quarter_not_quantified(self):
        assert not _has_meaningful_number("Delivered in Q3")

    def test_monetary_is_quantified(self):
        assert _has_meaningful_number("Generated $5M in revenue")


class TestCheckPassiveVoice:
    def test_active_voice(self):
        result = _check_passive_voice(["Built the system", "Designed the architecture"])
        assert result["pass"] == "ok"

    def test_passive_detected(self):
        result = _check_passive_voice(["The system was built", "Architecture is designed"])
        assert result["pass"] == "no"
        assert result["bullet_to_highlight"] == [0, 1]


class TestCheckFillerWords:
    def test_no_fillers(self):
        result = _check_filler_words(["Built robust system", "Delivered on time"])
        assert result["pass"] == "ok"

    def test_fillers_detected(self):
        result = _check_filler_words(["Very effective solution", "Just a simple fix"])
        assert result["pass"] == "no"
        assert result["bullet_to_highlight"] == [0, 1]

    def test_a_lot(self):
        result = _check_filler_words(["Improved a lot of processes"])
        assert result["pass"] == "no"
        assert result["bullet_to_highlight"] == [0]

    def test_new_filler_words_flagged(self):
        result = _check_filler_words(["Basically a simple approach to the problem"])
        assert result["pass"] == "no"
        assert result["bullet_to_highlight"] == [0]

    def test_filler_phrases_flagged(self):
        result = _check_filler_words(["Pretty much completed the entire project work"])
        assert result["pass"] == "no"
        assert result["bullet_to_highlight"] == [0]


class TestCheckPersonalPronouns:
    def test_no_pronouns(self):
        result = _check_personal_pronouns(["Built the system", "Designed APIs"])
        assert result["pass"] == "ok"

    def test_pronouns_detected(self):
        result = _check_personal_pronouns(["I managed the team", "My project delivered results"])
        assert result["pass"] == "no"
        assert result["bullet_to_highlight"] == [0, 1]


class TestCheckBuzzwords:
    def test_no_buzzwords(self):
        result = _check_buzzwords(["Built the platform", "Led engineering team"])
        assert result["pass"] == "ok"

    def test_buzzwords_detected(self):
        result = _check_buzzwords(["A true rockstar developer", "Created synergy across teams"])
        assert result["pass"] == "no"
        assert result["bullet_to_highlight"] == [0, 1]

    def test_tech_buzzwords_flagged(self):
        result = _check_buzzwords(["Hired as a 10x developer evangelist for the team"])
        assert result["pass"] == "no"
        assert result["bullet_to_highlight"] == [0]


class TestCheckSectionPresence:
    def test_present(self):
        result = _check_section_presence([Skill(name="Python")])
        assert result["pass"] == "ok"

    def test_missing(self):
        result = _check_section_presence([])
        assert result["pass"] == "no"


class TestCheckActionVerb:
    def test_strong_verbs(self):
        result = _check_action_verb(["Built the platform", "Led engineering team"])
        assert result["pass"] == "ok"

    def test_weak_start(self):
        result = _check_action_verb(["Helped with the project", "Worked on the system"])
        assert result["pass"] == "no"
        assert result["bullet_to_highlight"] == [0, 1]

    def test_mixed(self):
        result = _check_action_verb(["Designed the API", "Responsible for deployments"])
        assert result["pass"] == "no"
        assert result["bullet_to_highlight"] == [1]


class TestCheckBulletCount:
    def test_good_count(self):
        result = _check_bullet_count(["a", "b", "c"])
        assert result["pass"] == "ok"

    def test_too_few(self):
        result = _check_bullet_count(["only one"])
        assert result["pass"] == "min"
        assert "Too few" in result["message"]

    def test_too_many(self):
        result = _check_bullet_count(["a"] * 10)
        assert result["pass"] == "min"
        assert "Too many" in result["message"]

    def test_empty(self):
        result = _check_bullet_count([])
        assert result["pass"] == "min"
        assert "No bullet" in result["message"]


# ---------------------------------------------------------------------------
# Date and completeness checks
# ---------------------------------------------------------------------------


class TestDatePresence:
    def test_missing_dates_flagged(self):
        flags = _check_date_presence([Work(highlights=["Did something"])], "experience")
        assert len(flags) == 1
        assert flags[0]["pass"] == "no"

    def test_has_start_date_ok(self):
        flags = _check_date_presence([Work(startDate="2020-01", highlights=["Did something"])], "experience")
        assert len(flags) == 0

    def test_has_end_date_ok(self):
        flags = _check_date_presence([Work(endDate="2023-06", highlights=["Did something"])], "experience")
        assert len(flags) == 0


class TestDateConsistency:
    def test_future_date_flagged(self):
        flags = _check_date_consistency([Work(endDate="2030-01-01", highlights=["x"])], "experience")
        assert len(flags) == 1
        assert flags[0]["pass"] == "no"

    def test_null_end_date_ok(self):
        """Currently employed (endDate=null) should not be flagged."""
        flags = _check_date_consistency([Work(endDate=None, highlights=["x"])], "experience")
        assert len(flags) == 0

    def test_past_date_ok(self):
        flags = _check_date_consistency([Work(endDate="2023-06", highlights=["x"])], "experience")
        assert len(flags) == 0


class TestEntryCompleteness:
    def test_missing_position_flagged(self):
        flags = _check_entry_completeness([Work(name="Acme", highlights=["x"])], "experience")
        assert len(flags) == 1
        assert "position" in flags[0]["message"]

    def test_missing_name_flagged(self):
        flags = _check_entry_completeness([Work(position="Engineer", highlights=["x"])], "experience")
        assert len(flags) == 1
        assert "name" in flags[0]["message"]

    def test_complete_entry_ok(self):
        flags = _check_entry_completeness([Work(name="Acme", position="Engineer", highlights=["x"])], "experience")
        assert len(flags) == 0


# ---------------------------------------------------------------------------
# Keyword extraction and JD matching
# ---------------------------------------------------------------------------


class TestKeywordExtraction:
    def test_extracts_keywords(self):
        kws = _extract_keywords("We need a Python developer with AWS and Docker experience")
        assert "python" in kws
        assert "developer" in kws
        assert "aws" in kws
        assert "docker" in kws

    def test_filters_stopwords(self):
        kws = _extract_keywords("the and for with")
        assert kws == []

    def test_filters_short_tokens(self):
        kws = _extract_keywords("a an to")
        assert kws == []


class TestKeywordMatch:
    def test_high_overlap(self):
        jd = "Looking for a Python developer with AWS and Docker experience"
        resume = Resume(
            skills=[Skill(name="Python"), Skill(name="AWS")],
            work=[Work(highlights=["Built Docker-based microservices"])],
        )
        result = _compute_keyword_match(jd, resume)
        # N-gram extraction adds bigrams to JD keywords, lowering exact-match %
        assert result["matchPercentage"] > 10
        assert len(result["matchedKeywords"]) > 0

    def test_no_overlap(self):
        jd = "Looking for a Java developer with Spring Boot experience"
        resume = Resume(
            skills=[Skill(name="Python")],
            work=[Work(highlights=["Built REST APIs with FastAPI"])],
        )
        result = _compute_keyword_match(jd, resume)
        # Some incidental overlap possible but should be low
        assert result["matchPercentage"] < 50

    def test_empty_jd(self):
        resume = Resume(skills=[Skill(name="Python")])
        result = _compute_keyword_match("", resume)
        assert result["matchPercentage"] == 100.0


# ---------------------------------------------------------------------------
# Suggestion generation
# ---------------------------------------------------------------------------


class TestSuggestions:
    def test_suggestions_for_weak_verb(self):
        bullets = ["Helped with the project management process daily"]
        checks = {"weakBullets": _check_weak_bullets(bullets)}
        suggestions = _generate_suggestions(bullets, checks)
        assert len(suggestions) > 0
        assert "Helped" in suggestions[0] or "helped" in suggestions[0]

    def test_no_suggestions_for_strong_bullet(self):
        bullets = ["Architected the platform serving 1M users daily"]
        checks = {"weakBullets": _check_weak_bullets(bullets)}
        suggestions = _generate_suggestions(bullets, checks)
        assert len(suggestions) == 0

    def test_filler_suggestion(self):
        bullets = ["Basically implemented the entire backend system properly"]
        checks = {"weakBullets": _check_weak_bullets(bullets), "fillerWords": _check_filler_words(bullets)}
        suggestions = _generate_suggestions(bullets, checks)
        assert len(suggestions) > 0
        assert "filler" in suggestions[0].lower()


# ---------------------------------------------------------------------------
# analyze_resume integration tests
# ---------------------------------------------------------------------------


class TestAnalyzeResume:
    def test_empty_resume(self):
        resume = Resume()
        result = analyze_resume(resume)
        assert result["atsScore"] == 0
        # Resume-level checks (contact, ordering, keyword stuffing) are always present
        section_names = [s["section"] for s in result["sections"]]
        assert "contact" in section_names
        assert "ordering" in section_names
        assert "keywords" in section_names

    def test_work_only_good_bullets(self):
        resume = Resume(
            work=[
                Work(
                    name="Acme",
                    highlights=[
                        "Increased revenue by 30% through new pipelines",
                        "Led team of 12 engineers building microservices",
                    ],
                ),
            ],
        )
        result = analyze_resume(resume)
        # Raw: work bonus 15 + 2 good bullets × 5 pts = 10
        # + contact(2) - date(-3) - completeness(-2) = 22
        # Normalised: round(22/102*100) = 22
        assert result["atsScore"] == 22
        assert len(result["sections"]) >= 1

    def test_full_resume_perfect(self):
        resume = Resume(
            work=[
                Work(
                    highlights=[
                        "Increased revenue by 30% through new pipelines",
                        "Led team of 12 engineers building microservices",
                    ],
                ),
            ],
            projects=[
                Project(
                    highlights=[
                        "Built ETL pipeline processing 1M rows daily",
                        "Reduced latency by 45% via caching layer",
                    ],
                ),
            ],
            skills=[Skill(name="Python")],
            education=[Education(institution="MIT")],
        )
        result = analyze_resume(resume)
        # section bonuses: 15+10+8+7 = 40
        # quality: 4 bullets × 5pts = 20
        # contact: +2 (no ordering bonus — structured model can't validate ordering)
        # date penalties: work(-3) + education(-3) = -6
        # completeness: work missing name+position = -2
        # raw: 40+20+2-6-2 = 54, normalised: round(54/102*100) = 53
        assert result["atsScore"] == 53
        assert len(result["sections"]) >= 4

    def test_score_penalties(self):
        resume = Resume(
            work=[
                Work(
                    highlights=[
                        "Short",  # weak + no numbers + no action verb
                    ],
                ),
            ],
        )
        result = analyze_resume(resume)
        # work bonus 15, bullet gets 3 tier2 pts (weak/quant fail, but passive/filler/pronoun/buzz ok)
        # contact: +2 (ordering: n/a, only 1 section)
        # bulletCount penalty: 1 bullet < MIN_BULLETS_PER_ENTRY (2) -> -2
        # date presence: -3, completeness (missing name+position): -2
        # raw: 15+3+2-2-3-2 = 13, normalised: round(13/102*100) = 13
        assert result["atsScore"] == 13

    def test_score_clamped_to_zero(self):
        # Many entries with weak bullets; duplicates trigger heavy penalties
        resume = Resume(
            work=[
                Work(highlights=["Short"]),
                Work(highlights=["Short"]),
            ],
            projects=[
                Project(highlights=["Short"]),
            ],
            skills=[Skill(name="Python")],
            education=[Education(institution="MIT")],
        )
        result = analyze_resume(resume)
        # section bonuses: 15+10+8+7 = 40
        # quality: 3 bullets × 3 tier2 pts = 9
        # contact: +2, ordering: +2
        # duplicate penalty: "Short" appears 3x, 2 duplicates × -5 = -10
        # too-few-bullets penalty: 3 entries × -2 = -6
        # date penalties: 2 work + 1 education = -9
        # completeness: 2 work entries missing name+position = -4
        # raw: 40+9+2-10-6-9-4 = 22, normalised: round(22/102*100) = 22
        assert result["atsScore"] >= 0
        assert result["atsScore"] == 22

    def test_backward_compat_no_extras(self):
        """Without JD or critic_issues, keywordResult and criticPenalty are None."""
        resume = Resume(work=[Work(highlights=["Built a platform"])])
        result = analyze_resume(resume)
        assert result["keywordResult"] is None
        assert result["criticPenalty"] is None
        assert result["criticIssuesApplied"] is None


# ---------------------------------------------------------------------------
# JD-aware scoring
# ---------------------------------------------------------------------------


class TestJDAwareScoring:
    def test_keyword_match_with_jd(self):
        jd = "Python developer with FastAPI and PostgreSQL experience"
        resume = Resume(
            skills=[Skill(name="Python"), Skill(name="FastAPI")],
            work=[Work(highlights=["Built REST APIs with FastAPI and PostgreSQL"])],
        )
        result = analyze_resume(resume, job_description=jd)
        assert result["keywordResult"] is not None
        assert result["keywordResult"]["matchPercentage"] > 0
        assert len(result["keywordResult"]["matchedKeywords"]) > 0

    def test_keyword_match_without_jd(self):
        resume = Resume(skills=[Skill(name="Python")])
        result = analyze_resume(resume)
        assert result["keywordResult"] is None

    def test_keyword_match_no_overlap(self):
        jd = "Java Spring Boot Hibernate enterprise developer"
        resume = Resume(
            skills=[Skill(name="Python")],
            work=[Work(highlights=["Built machine learning models with PyTorch"])],
        )
        result = analyze_resume(resume, job_description=jd)
        assert result["keywordResult"]["matchPercentage"] < 50

    def test_jd_boosts_score(self):
        jd = "Python developer with FastAPI experience building REST APIs"
        resume = Resume(
            skills=[Skill(name="Python"), Skill(name="FastAPI")],
            work=[Work(highlights=["Built REST APIs with FastAPI serving 1M requests"])],
        )
        score_without_jd = analyze_resume(resume)["atsScore"]
        score_with_jd = analyze_resume(resume, job_description=jd)["atsScore"]
        # With a matching JD, the keyword bonus should boost the score
        assert score_with_jd > score_without_jd


# ---------------------------------------------------------------------------
# Critic integration
# ---------------------------------------------------------------------------


class TestCriticIntegration:
    def test_critic_penalty_high(self):
        resume = Resume(
            work=[Work(name="Acme", position="Eng", startDate="2020-01", endDate="2023-01",
                       highlights=["Built platform serving 1M users daily", "Led team of 8 engineers"])],
            skills=[Skill(name="Python")],
        )
        base_score = analyze_resume(resume)["atsScore"]
        issues = [{"location": "work[0]", "type": "ats", "severity": "HIGH", "description": "Missing keywords"}]
        penalized = analyze_resume(resume, critic_issues=issues)
        assert penalized["atsScore"] == base_score - 5
        assert penalized["criticPenalty"] == -5

    def test_critic_penalty_mixed(self):
        resume = Resume(
            work=[Work(name="Acme", position="Eng", startDate="2020-01", endDate="2023-01",
                       highlights=["Built platform serving 1M users daily", "Led team of 8 engineers"])],
            skills=[Skill(name="Python")],
        )
        base_score = analyze_resume(resume)["atsScore"]
        issues = [
            {"location": "work[0]", "type": "ats", "severity": "HIGH", "description": "Missing keywords"},
            {"location": "work[0]", "type": "impact", "severity": "MEDIUM", "description": "Weak metrics"},
            {"location": "skills", "type": "structure", "severity": "LOW", "description": "Too few skills"},
        ]
        penalized = analyze_resume(resume, critic_issues=issues)
        # HIGH=-5, MEDIUM=-2, LOW=-1 → total -8
        assert penalized["atsScore"] == base_score - 8
        assert penalized["criticPenalty"] == -8

    def test_critic_none_no_change(self):
        resume = Resume(work=[Work(highlights=["Built a platform"])])
        score_none = analyze_resume(resume)["atsScore"]
        score_empty = analyze_resume(resume, critic_issues=None)["atsScore"]
        assert score_none == score_empty


# ---------------------------------------------------------------------------
# Endpoint integration tests
# ---------------------------------------------------------------------------


class TestATSEndpoint:
    def test_analyze_endpoint(self):
        client = TestClient(app)
        payload = {
            "resume": {
                "work": [
                    {
                        "name": "Acme",
                        "highlights": [
                            "Increased revenue by 30% through new pipelines",
                            "Led team of 12 engineers building microservices",
                        ],
                    },
                ],
                "skills": [{"name": "Python"}],
                "education": [{"institution": "MIT"}],
            },
        }
        response = client.post("/api/v1/ats/analyze", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "ats_score" in data
        assert "sections" in data
        assert "detailed_results" in data
        assert isinstance(data["ats_score"], int)
        assert 0 <= data["ats_score"] <= 100
        # Backward compat: new fields are null when not provided
        assert data["keyword_match"] is None
        assert data["critic_penalty"] is None

    def test_analyze_endpoint_empty_resume(self):
        client = TestClient(app)
        payload = {"resume": {}}
        response = client.post("/api/v1/ats/analyze", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["ats_score"] == 0
        # Resume-level checks are always present
        assert len(data["sections"]) >= 3

    def test_analyze_endpoint_invalid_body(self):
        client = TestClient(app)
        response = client.post("/api/v1/ats/analyze", json={"bad": "data"})
        assert response.status_code == 422

    def test_analyze_with_awards_and_certificates(self):
        """Awards and certificates contribute to the score."""
        resume = Resume(
            work=[
                Work(
                    highlights=[
                        "Increased revenue by 30% through new pipelines",
                        "Led team of 12 engineers building microservices",
                    ],
                ),
            ],
            skills=[Skill(name="Python")],
            awards=[Award(title="Employee of the Year")],
            certificates=[Certificate(name="AWS Solutions Architect")],
        )
        result = analyze_resume(resume)
        # work 15 + skills 8 + awards 4 + certificates 4 + quality 10
        # contact: +2, ordering: +2
        # date penalty -3, completeness (missing name+position) -2
        # raw: 15+8+4+4+10+2-3-2 = 38, normalised: round(38/102*100) = 37
        assert result["atsScore"] == 37
        section_names = [s["section"] for s in result["sections"]]
        assert "awards" in section_names
        assert "certificates" in section_names

    def test_duplicate_bullets_penalized(self):
        """Duplicate bullets across entries are penalized."""
        resume = Resume(
            work=[
                Work(highlights=["Built ETL pipeline processing 1M rows daily", "Led team of 5 engineers"]),
                Work(highlights=["Built ETL pipeline processing 1M rows daily", "Designed caching layer"]),
            ],
        )
        result = analyze_resume(resume)
        # duplicate "Built ETL..." → -5 penalty applied
        assert result["atsScore"] < 50  # penalty is applied

    def test_proportional_quantification(self):
        """Quantification passes when >= 30% of bullets have numbers."""
        # 2 of 3 bullets have numbers = 67% quantified → should pass
        result = _check_quantified_bullets([
            "Increased revenue by 30%",
            "Led team building activities",
            "Managed 12 engineers",
        ])
        assert result["pass"] == "ok"

    def test_passive_voice_robust(self):
        """Passive voice uses be-verb + past-participle pattern, not just word presence."""
        # "Built the system" has no be-verb → not passive
        result = _check_passive_voice(["Built the system"])
        assert result["pass"] == "ok"
        # "Was built by the team" → classic passive
        result = _check_passive_voice(["Was built by the team"])
        assert result["pass"] == "no"

    def test_endpoint_with_jd(self):
        """Endpoint accepts optional job_description and returns keyword_match."""
        client = TestClient(app)
        payload = {
            "resume": {
                "skills": [{"name": "Python"}, {"name": "FastAPI"}],
                "work": [{"highlights": ["Built REST APIs with FastAPI"]}],
            },
            "job_description": "Python developer with FastAPI experience building REST APIs",
        }
        response = client.post("/api/v1/ats/analyze", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["keyword_match"] is not None
        assert data["keyword_match"]["match_percentage"] > 0
        assert len(data["keyword_match"]["matched_keywords"]) > 0

    def test_endpoint_with_critic_issues(self):
        """Endpoint accepts optional critic_issues and returns critic_penalty."""
        client = TestClient(app)
        payload = {
            "resume": {
                "work": [{"name": "Acme", "position": "Eng", "startDate": "2020-01",
                          "endDate": "2023-01",
                          "highlights": ["Built platform serving 1M users daily",
                                         "Led team of 8 engineers"]}],
                "skills": [{"name": "Python"}],
            },
            "critic_issues": [
                {"location": "work[0]", "type": "ats", "severity": "HIGH",
                 "description": "Missing keywords"},
                {"location": "skills", "type": "structure", "severity": "LOW",
                 "description": "Too few skills"},
            ],
        }
        response = client.post("/api/v1/ats/analyze", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["critic_penalty"] == -6  # HIGH=-5 + LOW=-1
        assert len(data["critic_issues_applied"]) == 2


# ---------------------------------------------------------------------------
# New check tests
# ---------------------------------------------------------------------------


class TestStemWord:
    def test_ing_suffix(self):
        assert _stem_word("developing") == "develop"

    def test_ed_suffix(self):
        assert _stem_word("designed") == "design"

    def test_er_suffix(self):
        assert _stem_word("developer") == "develop"

    def test_short_word_unchanged(self):
        assert _stem_word("api") == "api"

    def test_no_suffix(self):
        assert _stem_word("python") == "python"


class TestCheckBulletQuantified:
    def test_quantified(self):
        assert _check_bullet_quantified("Increased revenue by 30%")

    def test_not_quantified(self):
        assert not _check_bullet_quantified("Led team building activities")


class TestRecencyWeight:
    def test_current_entry_full_weight(self):
        entry = Work(endDate=None)
        assert _recency_weight(entry) == 1.0

    def test_recent_entry_full_weight(self):
        entry = Work(endDate="2024-06")
        assert _recency_weight(entry) == 1.0

    def test_old_entry_reduced_weight(self):
        entry = Work(endDate="2015-01")
        assert _recency_weight(entry) == 0.6

    def test_no_date_full_weight(self):
        entry = Work()
        assert _recency_weight(entry) == 1.0


class TestContactPresence:
    def test_empty_resume_fails(self):
        result = _check_contact_presence(Resume())
        assert result["pass"] == "no"

    def test_resume_with_work_passes(self):
        result = _check_contact_presence(Resume(work=[Work(highlights=["Built stuff"])]))
        assert result["pass"] == "ok"


class TestSectionOrdering:
    def test_single_section_ok(self):
        result = _check_section_ordering(Resume(work=[Work(highlights=["x"])]))
        assert result["pass"] == "ok"

    def test_standard_order_passes(self):
        result = _check_section_ordering(Resume(
            work=[Work(highlights=["x"])],
            skills=[Skill(name="Python")],
            education=[Education(institution="MIT")],
        ))
        assert result["pass"] == "ok"
        assert result["message"] == "Required sections present"


class TestKeywordStuffing:
    def test_no_stuffing(self):
        result = _check_keyword_stuffing(Resume(
            work=[Work(highlights=["Built platform", "Led team"])],
        ))
        assert result["pass"] == "ok"

    def test_stuffing_detected(self):
        # Repeat a keyword 8+ times
        result = _check_keyword_stuffing(Resume(
            work=[Work(highlights=["Python Python Python Python Python Python Python Python"])],
        ))
        assert result["pass"] == "no"
        assert "stuffing" in result["message"].lower()


class TestPassiveVoiceFalsePositives:
    def test_was_leading_not_passive(self):
        """Prefix matching used to flag 'was leading' as passive. Fixed now."""
        result = _check_passive_voice(["Was leading the engineering team"])
        assert result["pass"] == "ok"

    def test_was_designing_not_passive(self):
        result = _check_passive_voice(["Was designing the new architecture"])
        assert result["pass"] == "ok"


class TestBuzzwordHyphenMatching:
    def test_self_starter_detected(self):
        """Hyphenated buzzwords should be detected correctly."""
        result = _check_buzzwords(["Described as a self-starter in the industry"])
        assert result["pass"] == "no"

    def test_detail_oriented_detected(self):
        result = _check_buzzwords(["A detail-oriented professional with experience"])
        assert result["pass"] == "no"


class TestPerBulletScoring:
    def test_mixed_quantification(self):
        """Entry with one quantified and one unquantified bullet scores correctly."""
        resume = Resume(
            work=[
                Work(
                    name="Acme",
                    position="Engineer",
                    startDate="2024-01",
                    highlights=[
                        "Increased revenue by 30% through new pipelines",
                        "Led team building activities for the department",
                    ],
                ),
            ],
        )
        result = analyze_resume(resume)
        # Should produce a valid score with breakdown
        assert 0 <= result["atsScore"] <= 100
        assert "scoreBreakdown" in result


# ---------------------------------------------------------------------------
# Stemmer improvements and n-gram extraction
# ---------------------------------------------------------------------------


class TestStemmerImprovements:
    def test_ed_suffix(self):
        assert _stem_word("refactored") == "refactor"

    def test_ing_suffix(self):
        assert _stem_word("managing") == "manag"

    def test_tion_suffix(self):
        assert _stem_word("reduction") == "reduc"

    def test_short_word_preserved(self):
        assert _stem_word("aws") == "aws"

    def test_ly_suffix(self):
        assert _stem_word("quickly") == "quick"

    def test_er_suffix(self):
        assert _stem_word("developer") == "develop"


class TestNGramExtraction:
    def test_extracts_bigrams(self):
        kws = _extract_keywords("machine learning and deep learning models", top_n=10)
        assert "machine learning" in kws or "deep learning" in kws

    def test_extracts_trigrams(self):
        kws = _extract_keywords("continuous integration and deployment pipeline for continuous delivery", top_n=10)
        # Should find some multi-word terms
        assert any(" " in kw for kw in kws)

    def test_single_words_still_work(self):
        kws = _extract_keywords("Python Docker Kubernetes AWS")
        assert "python" in kws or "docker" in kws

    def test_empty_text(self):
        assert _extract_keywords("") == []


# ---------------------------------------------------------------------------
# Semantic similarity (cosine similarity)
# ---------------------------------------------------------------------------


class TestSemanticSimilarity:
    def test_high_similarity(self):
        jd = "Python developer with AWS Docker microservices experience"
        resume = Resume(
            skills=[Skill(name="Python"), Skill(name="AWS")],
            work=[Work(highlights=["Built Docker-based microservices on AWS"])],
        )
        score = _compute_semantic_similarity(jd, resume)
        assert score > 0.3

    def test_low_similarity(self):
        jd = "Java developer with Spring Boot and Hibernate experience"
        resume = Resume(
            skills=[Skill(name="Python")],
            work=[Work(highlights=["Built REST APIs with FastAPI"])],
        )
        score = _compute_semantic_similarity(jd, resume)
        assert score < 0.5

    def test_empty_jd_returns_zero(self):
        resume = Resume(skills=[Skill(name="Python")])
        score = _compute_semantic_similarity("", resume)
        assert score == 0.0

    def test_identical_text_high_score(self):
        text = "Python developer with machine learning experience"
        resume = Resume(
            work=[Work(highlights=["Python developer with machine learning experience"])]
        )
        score = _compute_semantic_similarity(text, resume)
        assert score > 0.5


# ---------------------------------------------------------------------------
# Section ordering fix
# ---------------------------------------------------------------------------


class TestSectionOrderingFixed:
    def test_empty_resume_no_ordering(self):
        resume = Resume()
        result = _check_section_ordering(resume)
        assert result["pass"] == "ok"

    def test_single_section_no_ordering(self):
        resume = Resume(work=[Work(highlights=["Did stuff"])])
        result = _check_section_ordering(resume)
        assert result["pass"] == "ok"

    def test_standard_order_passes(self):
        resume = Resume(
            work=[Work(highlights=["Built things"])],
            skills=[Skill(name="Python")],
            education=[Education(institution="MIT")],
        )
        result = _check_section_ordering(resume)
        assert result["pass"] == "ok"


# ---------------------------------------------------------------------------
# Improved contact presence
# ---------------------------------------------------------------------------


class TestContactPresenceImproved:
    def test_empty_resume_fails(self):
        resume = Resume()
        result = _check_contact_presence(resume)
        assert result["pass"] == "no"

    def test_resume_with_work_passes(self):
        resume = Resume(work=[Work(name="Acme", position="Engineer", highlights=["Built APIs"])])
        result = _check_contact_presence(resume)
        assert result["pass"] == "ok"

    def test_resume_with_only_skills_warns(self):
        resume = Resume(skills=[Skill(name="Python")])
        result = _check_contact_presence(resume)
        assert result["pass"] == "min"

    def test_resume_with_education_only_warns(self):
        resume = Resume(education=[Education(institution="MIT")])
        result = _check_contact_presence(resume)
        assert result["pass"] == "min"


# ---------------------------------------------------------------------------
# Passive voice improvements
# ---------------------------------------------------------------------------


class TestPassiveVoiceImproved:
    def test_detected_refactored(self):
        result = _check_passive_voice(["The system was refactored by the team"])
        assert result["pass"] == "no"

    def test_detected_automated(self):
        result = _check_passive_voice(["Tests were automated for CI"])
        assert result["pass"] == "no"

    def test_detected_maintained(self):
        result = _check_passive_voice(["The API is maintained by the platform team"])
        assert result["pass"] == "no"

    def test_active_voice_passes(self):
        result = _check_passive_voice(["Refactored the legacy system to microservices"])
        assert result["pass"] == "ok"

    def test_be_verb_without_participle_passes(self):
        result = _check_passive_voice(["Was responsible for team leadership"])
        assert result["pass"] == "ok"


# ---------------------------------------------------------------------------
# Score breakdown
# ---------------------------------------------------------------------------


class TestScoreBreakdown:
    def test_breakdown_present(self):
        resume = Resume(
            work=[Work(highlights=["Built APIs processing 1M requests"])],
            skills=[Skill(name="Python")],
        )
        result = analyze_resume(resume)
        assert "scoreBreakdown" in result
        bd = result["scoreBreakdown"]
        assert bd["section_presence"] > 0
        assert bd["max_possible"] > 0

    def test_breakdown_with_jd(self):
        resume = Resume(
            skills=[Skill(name="Python")],
            work=[Work(highlights=["Built Python APIs"])],
        )
        result = analyze_resume(resume, job_description="Python developer needed")
        bd = result["scoreBreakdown"]
        assert bd["jd_keyword_match"] >= 0
        assert "semanticScore" in result
        assert result["semanticScore"] is not None


# ---------------------------------------------------------------------------
# Input validation
# ---------------------------------------------------------------------------


class TestInputValidation:
    def test_html_tags_stripped(self):
        resume = Resume(
            work=[Work(highlights=["<script>alert('xss')</script>Built platform serving 1M users"])],
        )
        result = analyze_resume(resume)
        assert result["atsScore"] >= 0
        assert "validationWarnings" in result
        assert len(result["validationWarnings"]) > 0

    def test_long_bullet_truncated(self):
        long_bullet = "Built " + "x" * 1000
        resume = Resume(
            work=[Work(highlights=[long_bullet])],
        )
        result = analyze_resume(resume)
        assert result["atsScore"] >= 0
        assert len(result["validationWarnings"]) > 0

    def test_excessive_entries_truncated(self):
        entries = [Work(highlights=["Built something useful for the team"]) for _ in range(30)]
        resume = Resume(work=entries)
        result = analyze_resume(resume)
        assert result["atsScore"] >= 0
        assert any("truncated" in w for w in result["validationWarnings"])

    def test_excessive_bullets_truncated(self):
        bullets = [f"Bullet point number {i} with enough words here" for i in range(30)]
        resume = Resume(work=[Work(highlights=bullets)])
        result = analyze_resume(resume)
        assert result["atsScore"] >= 0
        assert any("truncated" in w for w in result["validationWarnings"])

    def test_empty_string_bullet(self):
        resume = Resume(work=[Work(highlights=[""])] )
        result = analyze_resume(resume)
        assert result["atsScore"] >= 0

    def test_clean_resume_no_warnings(self):
        resume = Resume(
            work=[Work(highlights=["Built platform serving 1M users daily"])],
        )
        result = analyze_resume(resume)
        assert result["validationWarnings"] == []

    def test_sanitize_text_strips_html(self):
        assert "<script>" not in _sanitize_text("<script>alert(1)</script>Built APIs")
        assert "Built APIs" in _sanitize_text("<script>alert(1)</script>Built APIs")

    def test_sanitize_text_truncates(self):
        assert len(_sanitize_text("x" * 600)) == 500

    def test_sanitize_text_clean_unchanged(self):
        assert _sanitize_text("Built platform serving 1M users") == "Built platform serving 1M users"


# ---------------------------------------------------------------------------
# Duplicate normalization
# ---------------------------------------------------------------------------


class TestDuplicateNormalization:
    def test_punctuation_normalized(self):
        count = _count_duplicate_bullets(["Built platform", "Built platform.", "Built platform!"])
        assert count == 2  # all three are the same after normalization

    def test_exact_duplicates(self):
        count = _count_duplicate_bullets(["Built platform", "Built platform"])
        assert count == 1

    def test_different_bullets(self):
        count = _count_duplicate_bullets(["Built platform", "Different thing"])
        assert count == 0
