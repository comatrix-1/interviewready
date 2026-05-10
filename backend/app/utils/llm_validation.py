"""LLM output sanitizer helpers and centralized validation/repair utility.

Pure, well-tested helper functions for extracting and repairing JSON-like
payloads produced by LLMs. These functions are intentionally lightweight
heuristics (not a full JSON parser) intended to make common fixes such as:
- extracting the first JSON-like substring from a longer text
- converting single-quoted strings to double-quoted strings
- removing trailing commas before closing brackets/braces
- balancing unmatched opening brackets by appending closers

The top-level function ``validate_or_repair`` orchestrates strict parsing,
sanitizer heuristics, and an optional LLM reformat step into a single
call::

    parsed, status = validate_or_repair(raw_text, OrchestrationResult)
    # status in {"ok", "repaired", "default"}

Each function is pure (no side effects) and documented.
"""
from __future__ import annotations

import json
import re
from typing import Any, Callable, Optional, Tuple, Type

from pydantic import BaseModel


def extract_json_substring(text: str) -> Optional[str]:
    """Extract the first JSON-like substring (object or array) from text.

    This finds occurrences of '{' or '[' and returns the minimally
    balanced substring that forms a top-level JSON object or array. The
    scanner respects string literals (skips brackets inside quotes) and
    simple escape sequences.

    For objects ({...}) this is conservative and only returns a match if
    the candidate contains evidence of JSON structure (a ':' or a double-quote).
    Arrays ([...]) are accepted as-is.

    Returns the substring if found, otherwise None.
    """
    if not text:
        return None

    start_idxs = [(m.start(), m.group()) for m in re.finditer(r"[\{\[]", text)]
    if not start_idxs:
        return None

    def find_match(start: int, opener: str) -> Optional[str]:
        stack = [opener]
        i = start + 1
        in_string = False
        escape = False
        while i < len(text):
            ch = text[i]
            if in_string:
                if escape:
                    escape = False
                elif ch == "\\":
                    escape = True
                elif ch == in_string:
                    in_string = False
            else:
                if ch == '"' or ch == "'":
                    in_string = ch
                elif ch == "{" or ch == "[":
                    stack.append(ch)
                elif ch == "}" or ch == "]":
                    if not stack:
                        return None
                    opener_top = stack[-1]
                    if (opener_top == "{" and ch == "}") or (opener_top == "[" and ch == "]"):
                        stack.pop()
                        if not stack:
                            return text[start : i + 1]
                    else:
                        # mismatched closer -- try to continue
                        stack.pop()
            i += 1
        return None

    for idx, ch in start_idxs:
        matched = find_match(idx, ch)
        if not matched:
            continue
        # Heuristic: if it's an object, ensure it looks JSON-like (has ':' or '"')
        if ch == "{":
            if ":" in matched or '"' in matched:
                return matched
            else:
                # Skip this candidate and continue searching for a later JSON
                continue
        else:
            # array - accept
            return matched

    return None


def fix_single_quotes(text: str) -> str:
    """Replace common single-quote JSON-style strings with double-quote strings.

    Heuristic rules applied:
    - Replace single quotes surrounding keys or values with double quotes when
      they appear in JSON-like contexts.

    The function returns the transformed string.
    """
    if not text:
        return text

    # Strategy: replace single-quoted strings that appear in JSON-like contexts.
    # A single-quoted string is a candidate when it is:
    #   preceded by a JSON separator ({, [, ,, :) or whitespace or start,
    #   and followed by a JSON separator (:, ,, }, ]) or whitespace or end.

    # Step 1: replace 'key': -> "key":
    # Matches a single-quoted key before a colon.
    text = re.sub(r"""'([^']*)'(\s*:)""", r'"\1"\2', text)

    # Step 2: replace : 'value' -> : "value"  (values after colon)
    text = re.sub(r"""(:)(\s*)'([^']*)'""", r'\1\2"\3"', text)

    # Step 3: replace , 'value' -> , "value"  (values after comma in lists, before close)
    text = re.sub(r"""([,\[])(\s*)'([^']*)'""", r'\1\2"\3"', text)

    # Step 4: replace trailing array/object items like 'value'] -> "value"]
    text = re.sub(r"""'([^']*)'(\s*[}\]])""", r'"\1"\2', text)

    return text



def remove_trailing_commas(text: str) -> str:
    """Remove trailing commas before a closing ']' or '}' in JSON-like text.

    This removes instances like '[1,2,]' -> '[1,2]' and '{"a":1,}' -> '{"a":1}'.
    Tracks string literal boundaries so commas inside quoted strings are
    never touched. The operation is idempotent.
    """
    if not text:
        return text

    result: list[str] = []
    in_string: Optional[str] = None
    escape = False
    i = 0
    n = len(text)

    while i < n:
        ch = text[i]

        # Track string boundaries
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

        # String start
        if ch == '"' or ch == "'":
            in_string = ch
            result.append(ch)
            i += 1
            continue

        # Comma followed by optional whitespace then } or ]
        if ch == ",":
            # Look ahead past whitespace for a closer
            j = i + 1
            while j < n and text[j] in (" ", "\t", "\n", "\r"):
                j += 1
            if j < n and text[j] in ("}", "]"):
                # Skip this comma entirely (don't append it)
                i = j
                continue

        result.append(ch)
        i += 1

    return "".join(result)


def balance_brackets(text: str) -> str:
    """Append missing closing brackets/braces to balance the top-level JSON.

    Scans the text and tracks unclosed '{' and '[' outside of string literals
    and appends the corresponding closing characters in the correct order.

    This function does not attempt to remove extraneous closers.
    """
    if not text:
        return text

    stack: list[str] = []
    in_string: Optional[str] = None
    escape = False

    for ch in text:
        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == in_string:
                in_string = None
        else:
            if ch == '"' or ch == "'":
                in_string = ch
            elif ch == "{" or ch == "[":
                stack.append(ch)
            elif ch == "}" or ch == "]":
                if stack:
                    opener = stack[-1]
                    if (opener == "{" and ch == "}") or (opener == "[" and ch == "]"):
                        stack.pop()
                    else:
                        # mismatched closer - try to pop anyway
                        stack.pop()
                else:
                    # extra closer; ignore
                    pass

    # Append closers for any unmatched openers in reverse order
    closer_map = {"{": "}", "[": "]"}
    to_append = "".join(closer_map[o] for o in reversed(stack))
    return text + to_append


def _sanitize_and_parse(text: str, schema: Type[BaseModel]) -> Optional[BaseModel]:
    """Apply sanitizer heuristics and attempt to parse.

    Attempts: extract_json_substring -> fix_single_quotes ->
    remove_trailing_commas -> balance_brackets -> json.loads -> model_validate.

    If extraction fails due to unbalanced input, tries balancing first then
    re-extracts.
    """
    def _try_parse(candidate: str) -> Optional[BaseModel]:
        """Apply fix chain and parse a candidate string."""
        fixed = fix_single_quotes(candidate)
        fixed = remove_trailing_commas(fixed)
        fixed = balance_brackets(fixed)
        try:
            data = json.loads(fixed, strict=False)
            return schema.model_validate(data)
        except Exception:
            return None

    # Strategy 1: extract JSON substring, apply fixes, parse
    extracted = extract_json_substring(text)
    if extracted is not None:
        result = _try_parse(extracted)
        if result is not None:
            return result

    # Strategy 2: balance raw text first (handles unclosed outer brackets),
    # then re-extract and parse
    balanced = balance_brackets(text)
    if balanced != text:
        extracted2 = extract_json_substring(balanced)
        if extracted2 is not None:
            result = _try_parse(extracted2)
            if result is not None:
                return result

    return None


def validate_or_repair(
    raw: str | dict[str, Any],
    schema: Type[BaseModel],
    hint: Optional[str] = None,
    llm_reformat: Optional[Callable[[str, Type[BaseModel], Optional[str]], Optional[BaseModel]]] = None,
) -> Tuple[BaseModel, str]:
    """Validate and optionally repair an LLM output against a Pydantic schema.

    The flow is:
    1. **Strict parse** — if *raw* is a dict, try ``model_validate`` directly.
       If it is a string, try ``json.loads`` then ``model_validate``.
    2. **Sanitizer heuristics** — extract JSON substring, fix single quotes,
       remove trailing commas, balance brackets. Re-attempt parse.
    3. **LLM reformat** (optional) — if *llm_reformat* is provided and the
       sanitizers fail, invoke the callable to get a repaired instance.
    4. **Safe default** — if everything fails, return ``model_construct()``
       with defaults.

    Args:
        raw: Raw LLM output (string or dict) to parse.
        schema: The Pydantic ``BaseModel`` subclass to validate against.
        hint: Optional context hint (e.g. agent name) for logging.
        llm_reformat: Optional callable ``(raw, schema, hint) -> instance | None``
            that invokes the LLM to re-output a valid payload. Only called when
            strict parse and sanitizers both fail.

    Returns:
        Tuple of ``(parsed_instance, status)`` where *status* is one of:
        - ``"ok"`` — parsed directly without repair
        - ``"repaired"`` — parsed after sanitizer or LLM repair
        - ``"default"`` — returned a safe default; parsing failed entirely
    """
    # --- Step 1: Strict parse ---
    if isinstance(raw, dict):
        try:
            return schema.model_validate(raw), "ok"
        except Exception:
            pass  # fall through to sanitizers

    if isinstance(raw, str):
        # Try direct json.loads + model_validate
        try:
            data = json.loads(raw, strict=False)
            return schema.model_validate(data), "ok"
        except Exception:
            pass

        # --- Step 2: Sanitizer heuristics ---
        parsed = _sanitize_and_parse(raw, schema)
        if parsed is not None:
            return parsed, "repaired"

        # --- Step 3: LLM reformat (if available) ---
        if llm_reformat is not None:
            try:
                result = llm_reformat(raw, schema, hint)
                if result is not None:
                    return result, "repaired"
            except Exception:
                pass

    # --- Step 4: Safe default ---
    return schema.model_construct(), "default"


__all__ = [
    "extract_json_substring",
    "fix_single_quotes",
    "remove_trailing_commas",
    "balance_brackets",
    "validate_or_repair",
    "make_llm_reformatter",
    "reformat_with_llm",
]


# ===============================================================
#  LLM reformat helper (Task 3)
# ===============================================================


def _build_reformat_prompt(
    raw_text: str,
    schema: Type[BaseModel],
    hint: Optional[str] = None,
) -> str:
    """Build a concise reformat prompt for the LLM.

    The prompt asks the model to return ONLY valid JSON conforming to
    the schema, with no prose or explanation.
    """
    # Build a compact example from the JSON schema
    try:
        json_schema = schema.model_json_schema()
        example = _build_example_from_json_schema(json_schema)
        example_str = json.dumps(example, indent=2)
    except Exception:
        example_str = "{}"

    hint_line = f" ({hint})" if hint else ""
    prompt = (
        f"Reformat the text below into valid JSON conforming to this schema{hint_line}.\n"
        f"Schema example:\n{example_str}\n\n"
        f"Text:\n{raw_text}\n\n"
        f"Respond with ONLY the valid JSON payload — no prose, no markdown, no explanation."
    )
    return prompt


def _build_example_from_json_schema(schema: dict[str, Any]) -> Any:
    """Build an example value from a JSON schema."""
    schema_type = schema.get("type", "object")

    if schema_type == "object":
        result = {}
        properties = schema.get("properties", {})
        for name, prop_schema in properties.items():
            result[name] = _build_example_from_json_schema(prop_schema)
        return result
    elif schema_type == "array":
        items_schema = schema.get("items", {})
        return [_build_example_from_json_schema(items_schema)]
    elif schema_type == "string":
        return "..."
    elif schema_type == "boolean":
        return True
    elif schema_type in ("integer", "number"):
        return 0
    else:
        return None


def reformat_with_llm(
    raw: str,
    schema: Type[BaseModel],
    hint: Optional[str] = None,
    *,
    generate_fn: Callable[[str, str], str],
) -> Optional[BaseModel]:
    """Use an LLM to reformat *raw* into valid JSON matching *schema*.

    Args:
        raw: Raw LLM output that failed strict parse and sanitizers.
        schema: Pydantic model to validate against.
        hint: Optional label for the prompt (e.g. agent name).
        generate_fn: A callable ``(system_prompt, user_prompt) -> str``
            that invokes an LLM. This keeps the function testable without
            importing real LLM clients.

    Returns:
        A parsed ``BaseModel`` instance on success, or ``None`` if the
        LLM response could not be parsed.
    """
    prompt = _build_reformat_prompt(raw, schema, hint=hint)
    try:
        response = generate_fn("", prompt)
    except Exception:
        return None

    if not response:
        return None

    # Try parsing the LLM response directly
    try:
        data = json.loads(response.strip(), strict=False)
        return schema.model_validate(data)
    except Exception:
        pass

    # If that fails, try the full sanitizer chain on the LLM output
    return _sanitize_and_parse(response, schema)


def make_llm_reformatter(
    generate_fn: Callable[[str, str], str],
) -> Callable[[str, Type[BaseModel], Optional[str]], Optional[BaseModel]]:
    """Create a reformatter callable for use with ``validate_or_repair``.

    Usage::

        reformatter = make_llm_reformatter(gemini_service.generate_response)
        parsed, status = validate_or_repair(raw, Schema, llm_reformat=reformatter)

    Args:
        generate_fn: A callable ``(system_prompt, user_prompt) -> str``.

    Returns:
        A callable ``(raw, schema, hint) -> instance | None`` suitable
        as the ``llm_reformat`` argument to ``validate_or_repair``.
    """
    def _reformat(raw: str, schema: Type[BaseModel], hint: Optional[str] = None) -> Optional[BaseModel]:
        return reformat_with_llm(raw, schema, hint=hint, generate_fn=generate_fn)

    return _reformat
