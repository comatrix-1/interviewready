"""Tests for the LLM reformat helper (reformat_with_llm, make_llm_reformatter).

The llm_validation module is loaded via importlib to avoid importing the
heavy backend package.
"""
import importlib.util
from pathlib import Path

import pytest
from pydantic import BaseModel, Field

# --- Load llm_validation module ---
here = Path(__file__).resolve().parents[1]
module_path = here / "app" / "utils" / "llm_validation.py"
spec = importlib.util.spec_from_file_location("llm_validation", module_path)
llm_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(llm_mod)

reformat_with_llm = llm_mod.reformat_with_llm
make_llm_reformatter = llm_mod.make_llm_reformatter
validate_or_repair = llm_mod.validate_or_repair


# --- Small schema for isolated testing ---
class TestItem(BaseModel):
    name: str
    value: int = 0

    model_config = {"extra": "forbid"}


class TestContainer(BaseModel):
    items: list[TestItem] = Field(default_factory=list)
    label: str = "default"

    model_config = {"extra": "forbid"}


# ===============================================================
#  reformat_with_llm — mock generate_fn
# ===============================================================

def test_llm_returns_valid_json():
    """When the LLM returns valid JSON, return the parsed instance."""
    def _generate(system: str, user: str) -> str:
        return '{"items": [{"name": "from-llm", "value": 42}], "label": "llm-ok"}'

    parsed = reformat_with_llm(
        "some garbled text here",
        TestContainer,
        generate_fn=_generate,
    )
    assert parsed is not None
    assert isinstance(parsed, TestContainer)
    assert parsed.label == "llm-ok"
    assert parsed.items[0].name == "from-llm"


def test_llm_returns_non_json_uses_sanitizer_fallback():
    """When the LLM returns text with embedded JSON, the sanitizer should
    fall back to extracting the JSON substring and parsing it."""
    def _generate(system: str, user: str) -> str:
        return "Sure! Here's the data: {'items': [{'name': 'cleaned'}], 'label': 'fix'}"

    parsed = reformat_with_llm(
        "garbage",
        TestContainer,
        generate_fn=_generate,
    )
    assert parsed is not None
    assert isinstance(parsed, TestContainer)
    assert parsed.label == "fix"
    assert parsed.items[0].name == "cleaned"


def test_llm_returns_empty():
    """Empty LLM response -> None."""
    def _generate(system: str, user: str) -> str:
        return ""

    parsed = reformat_with_llm("garbage", TestContainer, generate_fn=_generate)
    assert parsed is None


def test_llm_generate_fn_raises():
    """When generate_fn raises, reformat_with_llm returns None (no crash)."""
    def _generate(system: str, user: str) -> str:
        raise RuntimeError("API timeout")

    parsed = reformat_with_llm("garbage", TestContainer, generate_fn=_generate)
    assert parsed is None


# ===============================================================
#  make_llm_reformatter factory
# ===============================================================

def test_make_llm_reformatter_creates_callable():
    """Factory returns a function with the right signature."""
    def _generate(system: str, user: str) -> str:
        return '{"items":[],"label":"factory"}'

    reformatter = make_llm_reformatter(_generate)
    assert callable(reformatter)

    parsed = reformatter("raw", TestContainer, None)
    assert parsed is not None
    assert parsed.label == "factory"


def test_make_llm_reformatter_with_hint():
    """Hint is passed through; the prompt includes it."""
    captured = {}

    def _generate(system: str, user: str) -> str:
        captured["user"] = user
        return '{"label":"ok"}'

    reformatter = make_llm_reformatter(_generate)
    reformatter("raw", TestContainer, "test-agent")

    assert "test-agent" in captured["user"]


# ===============================================================
#  Integration: validate_or_repair with llm_reformat fallback
# ===============================================================

def test_validate_or_repair_invokes_reformat_on_failure():
    """When strict parse and sanitizers fail, validate_or_repair calls
    the llm_reformat callback."""
    def _generate(system: str, user: str) -> str:
        return '{"items": [], "label": "recovered-by-llm"}'

    reformatter = make_llm_reformatter(_generate)
    # Completely garbled input that sanitizers cannot fix
    parsed, status = validate_or_repair(
        "this is complete nonsense without any JSON structure",
        TestContainer,
        llm_reformat=reformatter,
    )
    assert status == "repaired"
    assert parsed.label == "recovered-by-llm"


def test_validate_or_repair_llm_fails_falls_to_default():
    """When LLM reformat also fails, status is 'default'."""
    def _generate(system: str, user: str) -> str:
        raise RuntimeError("API failed")

    reformatter = make_llm_reformatter(_generate)
    parsed, status = validate_or_repair(
        "total nonsense",
        TestContainer,
        llm_reformat=reformatter,
    )
    assert status == "default"
    assert isinstance(parsed, TestContainer)
    # model_construct() defaults
    assert parsed.label == "default"
    assert parsed.items == []


def test_validate_or_repair_ok_does_not_invoke_llm():
    """When strict parse succeeds, llm_reformat should NOT be called."""
    def _generate(system: str, user: str) -> str:
        raise RuntimeError("should not be called")

    reformatter = make_llm_reformatter(_generate)
    parsed, status = validate_or_repair(
        '{"label": "direct"}',
        TestContainer,
        llm_reformat=reformatter,
    )
    assert status == "ok"
    assert parsed.label == "direct"
