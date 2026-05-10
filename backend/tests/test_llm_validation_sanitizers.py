import importlib.util
from pathlib import Path

here = Path(__file__).resolve().parents[1]
module_path = here / "app" / "utils" / "llm_validation.py"
spec = importlib.util.spec_from_file_location("llm_validation", module_path)
llm_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(llm_mod)

extract_json_substring = llm_mod.extract_json_substring
fix_single_quotes = llm_mod.fix_single_quotes
remove_trailing_commas = llm_mod.remove_trailing_commas
balance_brackets = llm_mod.balance_brackets


def test_extract_json_simple_object():
    text = "Response:\nHere is the payload: {\"a\": 1, \"b\": [1,2,3]}\nThanks"
    assert extract_json_substring(text) == '{"a": 1, "b": [1,2,3]}'


def test_extract_json_with_extra_text():
    text = "Ignore this {not json} but here is real: {\"x\": {\"y\": 2}} end"
    assert extract_json_substring(text) == '{"x": {"y": 2}}'


def test_extract_json_array():
    text = "Start [1, 2, {\"a\":3}] trailing"
    assert extract_json_substring(text) == '[1, 2, {"a":3}]'


def test_extract_none_when_no_json():
    assert extract_json_substring("no json here") is None


def test_fix_single_quotes_basic():
    text = "{'a': 'b', 'c': 1}"
    out = fix_single_quotes(text)
    assert '"a"' in out and '"b"' in out


def test_fix_single_quotes_values_after_colon():
    text = "{'a': 'value with spaces', 'b':'x'}"
    out = fix_single_quotes(text)
    assert '"value with spaces"' in out


def test_remove_trailing_commas():
    text = '{"a":1, "b":2,}'
    assert remove_trailing_commas(text) == '{"a":1, "b":2}'


def test_remove_trailing_commas_in_array():
    text = '[1,2,3,]'
    assert remove_trailing_commas(text) == '[1,2,3]'


def test_balance_brackets_appends_missing_closers():
    text = '{"a": [1,2'
    out = balance_brackets(text)
    # Should append ] then }
    assert out.endswith(']}')


def test_balance_brackets_no_change_on_balanced():
    text = '{"a": [1,2]}'
    assert balance_brackets(text) == text


def test_chain_fixers_on_malformed_json():
    raw = "Here is the data: {'items': [1,2,3,],} end"
    s = extract_json_substring(raw)
    assert s is not None
    s = fix_single_quotes(s)
    s = remove_trailing_commas(s)
    s = balance_brackets(s)
    assert s.startswith('{') and s.endswith('}')
    # final should be valid-ish JSON structure
    assert '"items"' in s
