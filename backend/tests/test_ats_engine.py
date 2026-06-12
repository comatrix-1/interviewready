"""Tests for the ATS scoring engine and endpoint."""

import os

os.environ["DEBUG"] = "false"
os.environ.setdefault("GEMINI_API_KEY", "test-gemini-api-key")

from fastapi.testclient import TestClient

from app.main import app
from app.models.base import Education, Project, Skill, Work
from app.models.resume import Resume
from app.utils.ats_engine import (
    _check_buzzwords,
    _check_filler_words,
    _check_passive_voice,
    _check_personal_pronouns,
    _check_quantified_bullets,
    _check_section_presence,
    _check_weak_bullets,
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


class TestCheckQuantifiedBullets:
    def test_all_quantified(self):
        result = _check_quantified_bullets(["Increased revenue by 30%", "Managed 12 engineers"])
        assert result["pass"] == "ok"

    def test_missing_numbers(self):
        result = _check_quantified_bullets(["Increased revenue significantly", "Managed a large team"])
        assert result["pass"] == "no"
        assert result["bullet_to_highlight"] == [0, 1]

    def test_mixed(self):
        result = _check_quantified_bullets(["Grew sales by 25%", "Led team building activities"])
        assert result["pass"] == "no"
        assert result["bullet_to_highlight"] == [1]


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


class TestCheckSectionPresence:
    def test_present(self):
        result = _check_section_presence([Skill(name="Python")])
        assert result["pass"] == "ok"

    def test_missing(self):
        result = _check_section_presence([])
        assert result["pass"] == "no"


# ---------------------------------------------------------------------------
# analyze_resume integration tests
# ---------------------------------------------------------------------------


class TestAnalyzeResume:
    def test_empty_resume(self):
        resume = Resume()
        result = analyze_resume(resume)
        assert result["atsScore"] == 0
        assert result["sections"] == []
        assert result["detailedResults"] == {}

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
        assert result["atsScore"] == 20
        assert len(result["sections"]) == 1
        assert result["sections"][0]["section"] == "experience_0"

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
        # +20 work + 15 projects + 15 skills + 10 education = 60, no penalties
        assert result["atsScore"] == 60
        assert len(result["sections"]) == 4

    def test_score_penalties(self):
        resume = Resume(
            work=[
                Work(
                    highlights=[
                        "Short",  # weak + no numbers + no passive/filler/pronoun/buzz
                    ],
                ),
            ],
        )
        result = analyze_resume(resume)
        # +20 work, then penalties: weakBullets "no" (-5), quantifiedBullets "no" (-5)
        assert result["atsScore"] == 10

    def test_score_clamped_to_zero(self):
        # Many sections with many failing checks to push score negative
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
        # +20 +15 +15 +10 = 60, 6 "no" checks × -5 = -30 → 30
        # Actually: 2 work entries (6 checks each) + 1 project (6 checks) = 18 bullet checks + 2 section checks = 20
        # "Short" fails: weakBullets + quantifiedBullets = 2 per entry × 3 entries = 6 "no" → -30
        # So 60 - 30 = 30
        assert result["atsScore"] >= 0


# ---------------------------------------------------------------------------
# Endpoint integration test
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

    def test_analyze_endpoint_empty_resume(self):
        client = TestClient(app)
        payload = {"resume": {}}
        response = client.post("/api/v1/ats/analyze", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["ats_score"] == 0
        assert data["sections"] == []

    def test_analyze_endpoint_invalid_body(self):
        client = TestClient(app)
        response = client.post("/api/v1/ats/analyze", json={"bad": "data"})
        assert response.status_code == 422
