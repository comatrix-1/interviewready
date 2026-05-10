"""Tests for validate_or_repair core flow (no LLM reformat mocks).

The llm_validation module is loaded via importlib to avoid importing the
heavy backend package (which pulls in optional deps like langfuse, sqlalchemy).
"""
import importlib.util
import json
from pathlib import Path

import pytest
from pydantic import BaseModel, Field

# --- Load llm_validation module ---
here = Path(__file__).resolve().parents[1]
module_path = here / "app" / "utils" / "llm_validation.py"
spec = importlib.util.spec_from_file_location("llm_validation", module_path)
llm_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(llm_mod)

validate_or_repair = llm_mod.validate_or_repair
fix_single_quotes = llm_mod.fix_single_quotes
remove_trailing_commas = llm_mod.remove_trailing_commas
balance_brackets = llm_mod.balance_brackets


# --- Small in-module schema for isolated testing ---
class TestItem(BaseModel):
    name: str
    value: int = 0
    active: bool = False

    model_config = {"extra": "forbid"}


class TestContainer(BaseModel):
    items: list[TestItem] = Field(default_factory=list)
    label: str = "default"

    model_config = {"extra": "forbid"}


# ===============================================================
#  Valid dict input
# ===============================================================
def test_valid_dict_returns_ok():
    parsed, status = validate_or_repair(
        {"items": [{"name": "a", "value": 1}], "label": "test"},
        TestContainer,
    )
    assert status == "ok"
    assert isinstance(parsed, TestContainer)
    assert parsed.label == "test"
    assert len(parsed.items) == 1
    assert parsed.items[0].name == "a"


def test_valid_dict_with_defaults_returns_ok():
    parsed, status = validate_or_repair(
        {"label": "hello"},
        TestContainer,
    )
    assert status == "ok"
    assert parsed.label == "hello"
    assert parsed.items == []


# ===============================================================
#  Valid JSON string input
# ===============================================================
def test_valid_json_string_returns_ok():
    raw = '{"items": [{"name": "b", "value": 2, "active": true}], "label": "json"}'
    parsed, status = validate_or_repair(raw, TestContainer)
    assert status == "ok"
    assert parsed.label == "json"
    assert parsed.items[0].name == "b"
    assert parsed.items[0].value == 2


# ===============================================================
#  Malformed-but-repairable inputs -> "repaired"
# ===============================================================
def test_single_quotes_repaired():
    raw = "{'items': [{'name': 'c', 'value': 3}], 'label': 'fixed'}"
    parsed, status = validate_or_repair(raw, TestContainer)
    assert status == "repaired"
    assert parsed.label == "fixed"
    assert parsed.items[0].name == "c"
    assert parsed.items[0].value == 3


def test_trailing_comma_repaired():
    raw = '{"items": [{"name": "d", "value": 4,}], "label": "trail",}'
    parsed, status = validate_or_repair(raw, TestContainer)
    assert status == "repaired"
    assert parsed.label == "trail"
    assert parsed.items[0].value == 4


def test_balanced_brackets_repaired():
    """Missing closing braces/brackets should be appended."""
    raw = '{"items": [{"name": "e", "value": 5}]'
    parsed, status = validate_or_repair(raw, TestContainer)
    assert status == "repaired"
    assert len(parsed.items) == 1
    assert parsed.items[0].value == 5
    # label should get the default since it wasn't in the input
    assert parsed.label == "default"


def test_extract_json_from_surrounding_text():
    raw = "Here is the result: " + '{"items":[],"label":"extract"}'
    parsed, status = validate_or_repair(raw, TestContainer)
    assert status == "repaired"
    assert parsed.label == "extract"


def test_full_sanitizer_chain():
    raw = "Output: {'items': [{'name': 'f', 'value': 6,}], 'label': 'chain',}"
    parsed, status = validate_or_repair(raw, TestContainer)
    assert status == "repaired"
    assert parsed.label == "chain"
    assert parsed.items[0].value == 6


# ===============================================================
#  Unrecoverable input -> "default"
# ===============================================================
def test_unrecoverable_string_returns_default():
    parsed, status = validate_or_repair("this is not json at all", TestContainer)
    assert status == "default"
    assert isinstance(parsed, TestContainer)
    # model_construct() provides defaults
    assert parsed.label == "default"
    assert parsed.items == []


def test_empty_string_returns_default():
    parsed, status = validate_or_repair("", TestContainer)
    assert status == "default"
    assert isinstance(parsed, TestContainer)


def test_dict_with_extra_fields_returns_default():
    """dict with extra=forbid fields that violate schema -> default."""
    parsed, status = validate_or_repair(
        {"items": [{"name": "x", "extra_field": 999}], "label": "bad"},
        TestContainer,
    )
    # strict parse fails -> sanitizer extracts nothing useful -> default
    assert status == "default"
    assert isinstance(parsed, TestContainer)
