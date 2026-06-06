"""LLM output sanitizer helpers and centralized validation/repair utility.

Pure, well-tested helper functions for extracting and repairing JSON-like
payloads produced by LLMs. These functions are intentionally lightweight
heuristics (not a full JSON parser) intended to make common fixes such as:
- extracting the first JSON-like substring from a longer text
- converting single-quoted strings to double-quoted strings
- removing trailing commas before closing brackets/braces
- balancing unmatched opening brackets by appending closers

The top-level function ``validate_or_repair`` orchestrates strict parsing,
sanitizer heuristics, and an optional LLM reformat step into a single call.
"""

from __future__ import annotations

import json
import re
from collections.abc import Callable
from typing import Any

from pydantic import BaseModel

# ================================================================
# Character class constants
# ================================================================

STRING_QUOTES = {'"', "'"}
OPEN_BRACKETS = {"{", "["}
CLOSE_BRACKETS = {"}", "]"}


# ================================================================
# Core utilities
# ================================================================


def extract_json_substring(text: str) -> str | None:
    """Extract the first JSON-like substring (object or array) from text."""
    if not text:
        return None

    start_idxs = [(m.start(), m.group()) for m in re.finditer(r"[\{\[]", text)]
    if not start_idxs:
        return None

    def find_match(start: int, opener: str) -> str | None:
        stack = [opener]
        i = start + 1
        in_string: str | None = None
        escape = False

        while i < len(text):
            ch = text[i]

            if in_string:
                if escape:
                    escape = False
                elif ch == "\\":
                    escape = True
                elif ch == in_string:
                    in_string = None

            elif ch in STRING_QUOTES:
                in_string = ch

            elif ch in OPEN_BRACKETS:
                stack.append(ch)

            elif ch in CLOSE_BRACKETS:
                if not stack:
                    return None

                opener_top = stack[-1]

                if (opener_top == "{" and ch == "}") or (opener_top == "[" and ch == "]"):
                    stack.pop()

                    if not stack:
                        return text[start : i + 1]

                else:
                    # mismatched closer, keep original behavior
                    stack.pop()

            i += 1

        return None

    for idx, ch in start_idxs:
        matched = find_match(idx, ch)
        if not matched:
            continue

        if ch == "{":
            if ":" in matched or '"' in matched:
                return matched
            continue
        else:
            return matched

    return None


def fix_single_quotes(text: str) -> str:
    """Replace common single-quote JSON-style strings with double quotes."""
    if not text:
        return text

    text = re.sub(r"""'([^']*)'(\s*:)""", r'"\1"\2', text)
    text = re.sub(r"""(:)(\s*)'([^']*)'""", r'\1\2"\3"', text)
    text = re.sub(r"""([,\[])(\s*)'([^']*)'""", r'\1\2"\3"', text)
    text = re.sub(r"""'([^']*)'(\s*[}\]])""", r'"\1"\2', text)

    return text


def remove_trailing_commas(text: str) -> str:
    """Remove trailing commas before closing brackets/braces."""
    if not text:
        return text

    result: list[str] = []
    in_string: str | None = None
    escape = False
    i = 0
    n = len(text)

    while i < n:
        ch = text[i]

        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == in_string:
                in_string = None
            result.append(ch)
            i += 1
            continue

        if ch in STRING_QUOTES:
            in_string = ch
            result.append(ch)
            i += 1
            continue

        if ch == ",":
            j = i + 1
            while j < n and text[j] in (" ", "\t", "\n", "\r"):
                j += 1
            if j < n and text[j] in CLOSE_BRACKETS:
                i = j
                continue

        result.append(ch)
        i += 1

    return "".join(result)


def balance_brackets(text: str) -> str:
    """Append missing closing brackets/braces to balance JSON-like structure."""
    if not text:
        return text

    stack: list[str] = []
    in_string: str | None = None
    escape = False

    for ch in text:
        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == in_string:
                in_string = None
        elif ch in STRING_QUOTES:
            in_string = ch
        elif ch in OPEN_BRACKETS:
            stack.append(ch)
        elif ch in CLOSE_BRACKETS and stack:
            opener = stack[-1]

            if (opener == "{" and ch == "}") or (opener == "[" and ch == "]"):
                stack.pop()
            else:
                stack.pop()

    closer_map = {"{": "}", "[": "]"}
    return text + "".join(closer_map[o] for o in reversed(stack))


# ================================================================
# Sanitization pipeline (fix PLR0912)
# ================================================================


def _try_parse(candidate: str, schema: type[BaseModel]) -> BaseModel | None:
    fixed = fix_single_quotes(candidate)
    fixed = remove_trailing_commas(fixed)
    fixed = balance_brackets(fixed)

    try:
        data = json.loads(fixed, strict=False)
        return schema.model_validate(data)
    except Exception:
        return None


def _sanitize_and_parse(text: str, schema: type[BaseModel]) -> BaseModel | None:
    """Pipeline-based sanitizer (replaces branching-heavy logic)."""
    candidates: list[str] = []

    extracted = extract_json_substring(text)
    if extracted:
        candidates.append(extracted)

    balanced = balance_brackets(text)
    if balanced != text:
        extracted2 = extract_json_substring(balanced)
        if extracted2:
            candidates.append(extracted2)

    for c in candidates:
        parsed = _try_parse(c, schema)
        if parsed:
            return parsed

    return None


# ================================================================
# Main API
# ================================================================


def validate_or_repair(
    raw: str | dict[str, Any],
    schema: type[BaseModel],
    hint: str | None = None,
    llm_reformat: Callable[
        [str, type[BaseModel], str | None],
        BaseModel | None,
    ]
    | None = None,
) -> tuple[BaseModel, str]:
    """Validate and optionally repair an LLM output against a Pydantic schema."""
    if isinstance(raw, dict):
        try:
            return schema.model_validate(raw), "ok"
        except Exception:
            pass

    if isinstance(raw, str):
        try:
            data = json.loads(raw, strict=False)
            return schema.model_validate(data), "ok"
        except Exception:
            pass

        parsed = _sanitize_and_parse(raw, schema)
        if parsed is not None:
            return parsed, "repaired"

        if llm_reformat is not None:
            try:
                result = llm_reformat(raw, schema, hint)
                if result is not None:
                    return result, "repaired"
            except Exception:
                pass

    return schema.model_construct(), "default"


# ================================================================
# LLM reformat helper (unchanged logic, cleaned imports only)
# ================================================================


def _build_reformat_prompt(
    raw_text: str,
    schema: type[BaseModel],
    hint: str | None = None,
) -> str:
    try:
        json_schema = schema.model_json_schema()
        example = _build_example_from_json_schema(json_schema)
        example_str = json.dumps(example, indent=2)
    except Exception:
        example_str = "{}"

    hint_line = f" ({hint})" if hint else ""

    return (
        f"Reformat the text below into valid JSON conforming to this schema{hint_line}.\n"
        f"Schema example:\n{example_str}\n\n"
        f"Text:\n{raw_text}\n\n"
        f"Respond with ONLY the valid JSON payload — no prose, no markdown, no explanation."
    )


def _build_example_from_json_schema(schema: dict[str, Any]) -> Any:
    schema_type = schema.get("type", "object")

    if schema_type == "object":
        return {k: _build_example_from_json_schema(v) for k, v in schema.get("properties", {}).items()}
    if schema_type == "array":
        return [_build_example_from_json_schema(schema.get("items", {}))]
    if schema_type == "string":
        return "..."
    if schema_type == "boolean":
        return True
    if schema_type in ("integer", "number"):
        return 0
    return None


def reformat_with_llm(
    raw: str,
    schema: type[BaseModel],
    hint: str | None = None,
    *,
    generate_fn: Callable[[str, str], str],
) -> BaseModel | None:
    prompt = _build_reformat_prompt(raw, schema, hint=hint)

    try:
        response = generate_fn("", prompt)
    except Exception:
        return None

    if not response:
        return None

    try:
        data = json.loads(response.strip(), strict=False)
        return schema.model_validate(data)
    except Exception:
        pass

    return _sanitize_and_parse(response, schema)


def make_llm_reformatter(
    generate_fn: Callable[[str, str], str],
) -> Callable[[str, type[BaseModel], str | None], BaseModel | None]:
    def _reformat(
        raw: str,
        schema: type[BaseModel],
        hint: str | None = None,
    ) -> BaseModel | None:
        return reformat_with_llm(raw, schema, hint=hint, generate_fn=generate_fn)

    return _reformat


__all__ = [
    "extract_json_substring",
    "fix_single_quotes",
    "remove_trailing_commas",
    "balance_brackets",
    "validate_or_repair",
    "make_llm_reformatter",
    "reformat_with_llm",
]
