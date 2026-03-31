"""Platform-level fairness detection and bias metadata enrichment."""

from __future__ import annotations

import json
import re
from typing import Any

from app.models.agent import AgentInput, AgentResponse


class FairnessService:
    """A lightweight fairness engine for agent inputs and outputs."""

    PROTECTED_ATTRIBUTE_PATTERNS: dict[str, list[str]] = {
        "gender": [
            r"\bfemale\b",
            r"\bfemales\b",
            r"\bmale\b",
            r"\bmales\b",
            r"\bnon[- ]binary\b",
            r"\btransgender\b",
            r"\bwomen\b",
            r"\bmen\b",
        ],
        "age": [
            r"\byoung\b",
            r"\bjunior\b",
            r"\bold\b",
            r"\bsenior\b",
            r"\bmature\b",
            r"\bexperienced\b",
        ],
        "race_ethnicity": [
            r"\bblack\b",
            r"\bwhite\b",
            r"\basian\b",
            r"\bhispanic\b",
            r"\bpoC\b",
            r"\bindigenous\b",
            r"\bmiddle[- ]eastern\b",
        ],
        "religion": [
            r"\bchristian\b",
            r"\bmuslim\b",
            r"\bjewish\b",
            r"\bhindu\b",
            r"\bbuddhist\b",
        ],
        "disability": [
            r"\bdisabled\b",
            r"\bblind\b",
            r"\bdeaf\b",
            r"\bwheelchair\b",
            r"\bautistic\b",
        ],
    }

    BIAS_PATTERNS: dict[str, list[str]] = {
        "gendered_language": [
            r"\bninja\b",
            r"\brockstar\b",
            r"\bdominate\b",
            r"\bcompetitive\b",
            r"\baggressive\b",
            r"\bstrong communication skills\b",
        ],
        "age_bias": [
            r"\byoung and energetic\b",
            r"\byoung professionals\b",
            r"\bover 50\b",
            r"\brecent graduate\b",
        ],
        "skill_bias": [
            r"\bnative english speaker\b",
            r"\bfast learner\b",
            r"\bself[- ]starter\b",
        ],
    }

    CONTRADICTION_PATTERNS: list[tuple[str, str]] = [
        (r"\b(always|every|all)\b", r"\bnever\b"),
        (r"\balways\b", r"\bnot\b"),
        (r"\bevery\b", r"\bno\b"),
    ]

    def scan(self, input_data: AgentInput, response: AgentResponse) -> dict[str, Any]:
        """Scan input and output artifacts for fairness and bias signals."""
        input_text = self._build_input_text(input_data)
        output_text = self._build_output_text(response)

        protected_attributes = self._detect_protected_attributes(input_text)
        bias_signals = self._detect_bias_signals(input_text)
        output_bias_signals = self._detect_bias_signals(output_text)

        label_matches = sorted(set(protected_attributes))
        signal_matches = sorted(set(bias_signals + output_bias_signals))

        fairness_issues = []
        if label_matches:
            fairness_issues.append(
                f"protected_attributes_detected: {', '.join(label_matches)}"
            )
        if signal_matches:
            fairness_issues.append(f"bias_signals_detected: {', '.join(signal_matches)}")

        nli_check_passed = self._evaluate_nli_consistency(input_text, output_text)
        if not nli_check_passed:
            fairness_issues.append("nli_inconsistency_detected")

        return {
            "fairness_scan": {
                "protected_attributes": label_matches,
                "bias_signals": signal_matches,
                "nli_consistency_check_passed": nli_check_passed,
                "fairness_issues": fairness_issues,
            },
            "fairness_check_passed": not bool(fairness_issues),
        }

    def aggregate_dataset_metrics(
        self, text_items: list[str]
    ) -> dict[str, int]:
        """Aggregate bias metrics for a collection of text items.

        This method provides a lightweight dataset-level view of how often
        protected attribute mentions and bias signals appear.
        """
        metrics: dict[str, int] = {
            "protected_attribute_mentions": 0,
            "bias_signal_mentions": 0,
            "items_scanned": len(text_items),
        }
        for text in text_items:
            if self._detect_protected_attributes(text):
                metrics["protected_attribute_mentions"] += 1
            if self._detect_bias_signals(text):
                metrics["bias_signal_mentions"] += 1
        return metrics

    def _build_input_text(self, input_data: AgentInput) -> str:
        parts: list[str] = []
        if input_data.job_description:
            parts.append(input_data.job_description)
        if input_data.resume is not None:
            parts.append(json.dumps(input_data.resume.model_dump(exclude_none=True)))
        if input_data.resume_document is not None:
            parts.append(input_data.resume_document.raw_text or "")
        if input_data.message_history:
            parts.extend(
                str(item.text or "") for item in input_data.message_history
            )
        return "\n".join(part for part in parts if part)

    def _build_output_text(self, response: AgentResponse) -> str:
        parts: list[str] = []
        if response.content:
            parts.append(str(response.content))
        if response.reasoning:
            parts.append(str(response.reasoning))
        return "\n".join(parts)

    def _detect_protected_attributes(self, text: str) -> list[str]:
        matches: list[str] = []
        normalized = text.lower()
        for label, patterns in self.PROTECTED_ATTRIBUTE_PATTERNS.items():
            if any(re.search(pattern, normalized) for pattern in patterns):
                matches.append(label)
        return matches

    def _detect_bias_signals(self, text: str) -> list[str]:
        matches: list[str] = []
        normalized = text.lower()
        for label, patterns in self.BIAS_PATTERNS.items():
            if any(re.search(pattern, normalized) for pattern in patterns):
                matches.append(label)
        return matches

    def _evaluate_nli_consistency(
        self, source: str, target: str
    ) -> bool:
        normalized_source = source.lower()
        normalized_target = target.lower()
        for positive, negative in self.CONTRADICTION_PATTERNS:
            if re.search(positive, normalized_source) and re.search(negative, normalized_target):
                return False
        return True
