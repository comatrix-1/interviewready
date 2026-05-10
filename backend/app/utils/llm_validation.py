"""LLM output sanitizer helpers.

Pure, well-tested helper functions for extracting and repairing JSON-like
payloads produced by LLMs. These functions are intentionally lightweight
heuristics (not a full JSON parser) intended to make common fixes such as:
- extracting the first JSON-like substring from a longer text
- converting single-quoted strings to double-quoted strings
- removing trailing commas before closing brackets/braces
- balancing unmatched opening brackets by appending closers

Each function is pure (no side effects) and documented.
"""
from __future__ import annotations

import re
from typing import Optional


def extract_json_substring(text: str) -> Optional[str]:
    """Extract the first JSON-like substring (object or array) from text.

    This finds occurrences of '{' or '[' and returns the minimally
    balanced substring that forms a top-level JSON object or array. The
    scanner respects string literals (skips brackets inside quotes) and
    simple escape sequences.

    For objects ({{...}}) this is conservative and only returns a match if
    the candidate contains evidence of JSON structure (a ':' or a double-quote).
    Arrays (\[...\]) are accepted as-is.

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
        if ch == '{':
            if ':' in matched or '"' in matched:
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
      they appear in JSON-like contexts (after separators like '{', ',', ':', '[').
    - This is conservative and avoids touching common contractions inside words.

    The function returns the transformed string.
    """
    if not text:
        return text

    # Quick heuristic: if text contains double quotes already, be conservative
    # and only replace single-quoted keys/values that look JSON-like.
    # Pattern: (?<=[:\[{,]\s*)'([^']*)'(?=\s*[:,}\]])
    pattern = re.compile(r"(?<=[:\[\{,])\s*'([^']*)'(?=\s*(?:[:,\]\}]))")

    new_text = pattern.sub(r'"\1"', text)

    # Also replace values following ':' like: : 'value' or :    'value',
    pattern2 = re.compile(r"(:\s*)'([^']*)'")
    new_text = pattern2.sub(r"\1\"\2\"", new_text)

    return new_text


def remove_trailing_commas(text: str) -> str:
    """Remove trailing commas before a closing ']' or '}' in JSON-like text.

    This removes instances like '[1,2,]' -> '[1,2]' and '{"a":1,}' -> '{"a":1}'.
    The operation is idempotent.
    """
    if not text:
        return text

    # Remove commas followed only by whitespace then a closing bracket/brace
    new_text = re.sub(r",\s*(?=[\]}])", "", text)
    return new_text


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
