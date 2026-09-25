"""LLM Guard scanner service.

Policy: fail-closed. If a scan cannot run, content is blocked. The scanner
is a hard dependency: if it cannot initialize, the app refuses to boot.
LLM_GUARD_ENABLED=false turns scanning off explicitly — never ship that
config to production (startup logs a loud warning if set).
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from functools import cache

from llm_guard.input_scanners import PromptInjection
from llm_guard.output_scanners import NoRefusal

from ..core.config import settings
from ..core.logging import logger


class ScanStatus(StrEnum):
    PASSED = "passed"
    BLOCKED = "blocked"
    SKIPPED = "skipped"  # only when LLM_GUARD_ENABLED=false
    ERROR = "error"

@dataclass(frozen=True)
class Issue:
    scanner: str
    risk_score: float
    reason: str

@dataclass(frozen=True)
class ScanResult:
    status: ScanStatus
    text: str
    allowed: bool
    issues: tuple[Issue, ...] = ()

class LLMGuardScanner:
    def __init__(self, *, enabled: bool, injection_scanner, refusal_scanner) -> None:
        self.enabled = enabled
        self._injection_scanner = injection_scanner
        self._refusal_scanner = refusal_scanner

    def scan_input(self, prompt: str) -> ScanResult:
        if not self.enabled:
            return ScanResult(ScanStatus.SKIPPED, prompt, True)

        try:
            sanitized, is_valid, risk_score = self._injection_scanner.scan(prompt)
        except Exception:
            logger.exception("PromptInjection scan failed")
            logger.security_event("scan_error", scanner="PromptInjection")
            return ScanResult(ScanStatus.ERROR, prompt, False)

        if not is_valid:
            issue = Issue("PromptInjection", risk_score, "Potential prompt injection detected")
            logger.security_event(
                "prompt_injection_detected", scanner="PromptInjection", risk_score=risk_score
            )
            return ScanResult(ScanStatus.BLOCKED, sanitized, False, issues=(issue,))

        return ScanResult(ScanStatus.PASSED, sanitized, True)

    def scan_output(self, output: str) -> ScanResult:
        if not self.enabled:
            return ScanResult(ScanStatus.SKIPPED, output, True)

        try:
            sanitized, is_valid, risk_score = self._refusal_scanner.scan("", output)
        except Exception:
            logger.exception("NoRefusal scan failed")
            logger.security_event("scan_error", scanner="NoRefusal")
            return ScanResult(ScanStatus.ERROR, output, False)

        if not is_valid:
            issue = Issue("NoRefusal", risk_score, "Refusal detected")
            logger.security_event(
                "model_refusal_detected", scanner="NoRefusal", risk_score=risk_score
            )
            return ScanResult(ScanStatus.BLOCKED, sanitized, False, issues=(issue,))

        return ScanResult(ScanStatus.PASSED, sanitized, True)


@cache
def get_llm_guard_scanner() -> LLMGuardScanner:
    """Build the process-wide scanner. Raises on init failure so the deploy
    fails fast rather than serving unscanned traffic."""
    if not settings.LLM_GUARD_ENABLED:
        logger.warning(
            "LLM Guard DISABLED via config — all traffic is unscanned. "
            "This must never be enabled in production."
        )
        return LLMGuardScanner(enabled=False, injection_scanner=None, refusal_scanner=None)

    injection = PromptInjection(threshold=settings.LLM_GUARD_INJECTION_THRESHOLD)
    refusal = NoRefusal()
    logger.info("LLM Guard scanners initialized (PromptInjection, NoRefusal)")
    return LLMGuardScanner(enabled=True, injection_scanner=injection, refusal_scanner=refusal)
