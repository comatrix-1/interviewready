"""LLM Guard scanner service for input/output security."""

from functools import lru_cache
from typing import Any

from ..core.config import settings
from ..core.logging import logger

# Optional DataFog import (may pull in spaCy). Import lazily and
# tolerate failures on environments without spaCy / incompatible pydantic.
try:
    import datafog as DataFog
except Exception:
    DataFog = None


HAS_LLM_GUARD = False

try:
    # LLM Guard: Only import PromptInjection and NoRefusal
    from llm_guard.input_scanners import PromptInjection
    from llm_guard.output_scanners import NoRefusal

    HAS_LLM_GUARD = True
    logger.info("LLM Guard loaded (PromptInjection, NoRefusal)")

except Exception as e:
    HAS_LLM_GUARD = False
    logger.warning(f"LLM Guard unavailable, disabling security scanning: {e}")


class LLMGuardScanner:
    """Scanner for detecting prompt injection and sensitive content."""

    def __init__(self):
        self.enabled = getattr(settings, "LLM_GUARD_ENABLED", True) and HAS_LLM_GUARD

        self._prompt_injection_scanner = None
        self._refusal_scanner = None

        if not HAS_LLM_GUARD:
            logger.warning("LLM Guard not installed. Security scanning disabled.")
        elif not self.enabled:
            logger.info("LLM Guard disabled via configuration.")
        else:
            logger.info("Initializing security scanners...")

            self._prompt_injection_scanner = PromptInjection()
            logger.info("Created PromptInjection scanner at startup")

            self._refusal_scanner = NoRefusal()
            logger.info("Created NoRefusal scanner at startup")

            logger.info("Security scanners initialized (PromptInjection, NoRefusal)")

    def scan_input(self, prompt: str) -> tuple[bool, str, list[dict[str, Any]]]:
        """Scan user input for prompt injection and PII."""
        if not self.enabled:
            return True, prompt, [{"note": "scanner_disabled"}]

        issues = []
        sanitized = prompt

        try:
            sanitized, is_valid, risk_score = self._prompt_injection_scanner.scan(sanitized)

            if not is_valid:
                issue = {
                    "scanner": "PromptInjection",
                    "risk_score": risk_score,
                    "reason": "Potential prompt injection detected",
                }
                logger.security_event(
                    "prompt_injection_detected",
                    risk_score=risk_score,
                    issue=issue,
                )
                return False, sanitized, [issue]

            if DataFog is not None:
                try:
                    datafog_result = DataFog.scan_prompt(sanitized, engine="regex")
                    if datafog_result.entities:
                        sanitized = DataFog.sanitize(sanitized, engine="regex")
                        issues.append(
                            {
                                "scanner": "DataFog",
                                "risk_score": min(len(datafog_result.entities) / 10, 1.0),
                                "reason": f"PII detected in input ({len(datafog_result.entities)} entities)",
                            }
                        )
                except Exception as e:
                    logger.warning(f"DataFog PII scan failed: {e}")

            return True, sanitized, issues

        except Exception as e:
            logger.exception(f"LLM Guard input scan failed: {e}")
            return True, prompt, []

    def scan_output(self, output: str) -> tuple[bool, str, list[dict[str, Any]]]:
        """Scan model output for sensitive information and refusals."""
        if not self.enabled:
            return True, output, [{"note": "scanner_disabled"}]

        issues = []
        sanitized = output

        try:
            sanitized, is_valid, risk_score = self._refusal_scanner.scan("", sanitized)

            if not is_valid:
                issues.append(
                    {
                        "scanner": "NoRefusal",
                        "risk_score": risk_score,
                        "reason": "Refusal detected",
                    }
                )

            if DataFog is not None:
                try:
                    datafog_result = DataFog.filter_output(
                        sanitized,
                        engine="regex",
                    )
                    if datafog_result.entities:
                        sanitized = datafog_result.redacted_text
                        issues.append(
                            {
                                "scanner": "DataFog",
                                "risk_score": min(len(datafog_result.entities) / 10, 1.0),
                                "reason": (f"Sensitive content detected in output ({len(datafog_result.entities)} entities)"),
                            }
                        )
                except Exception as e:
                    logger.warning(f"DataFog output scan failed: {e}")

            if issues:
                logger.security_event(
                    "output_sensitive_detected",
                    risk_count=len(issues),
                    issues=issues,
                )
                return False, sanitized, issues

            return True, sanitized, []

        except Exception as e:
            logger.exception(f"LLM Guard output scan failed: {e}")
            return True, output, []

    def scan_both(self, input_text: str, output_text: str) -> tuple[bool, bool, list[dict[str, Any]]]:
        input_safe, _, input_issues = self.scan_input(input_text)
        output_safe, _, output_issues = self.scan_output(output_text)
        return input_safe, output_safe, input_issues + output_issues


# ---- Singleton (Ruff-friendly, no globals mutation) ----

_llm_guard_scanner: LLMGuardScanner | None = None


@lru_cache(maxsize=1)
def get_llm_guard_scanner() -> LLMGuardScanner:
    """Get or create the global LLM Guard scanner instance."""
    return LLMGuardScanner()
