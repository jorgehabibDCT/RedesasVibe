"""
Recover truncated / malformed JSON lines from theft-payloads.json, merge with strict parses,
and write a combined file.

Typical failures: Slack line-length truncation, trailing commas, ellipsis (…), Slack noise lines.

Note: Do not use f-strings for JSON suffixes — ``}}`` in f-strings becomes a single ``}``.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

INPUT = "theft-payloads.json"
OUTPUT_MERGED = "theft-payloads-all.json"
OUTPUT_STILL_BAD = "theft-payloads-still-bad.txt"

PREFIX = "Encontrack Log:"


def strip_prefix(line: str) -> str:
    line = line.strip()
    if PREFIX in line:
        line = line.split(PREFIX, 1)[1].strip()
    return line


def extract_reporter_phone(s: str) -> str:
    m = re.search(r'"reporter_phone"\s*:\s*"((?:[^"\\]|\\.)*)"', s)
    return m.group(1) if m else ""


def extract_reporter_name(s: str) -> str:
    m = re.search(r'"reporter_name"\s*:\s*"((?:[^"\\]|\\.)*)"', s)
    return m.group(1) if m else ""


def jesc(s: str) -> str:
    return json.dumps(s)[1:-1]


def remove_trailing_commas(s: str) -> str:
    prev = None
    while prev != s:
        prev = s
        s = re.sub(r",(\s*})", r"\1", s)
        s = re.sub(r",(\s*])", r"\1", s)
    s = re.sub(r",\s*$", "", s)
    return s


def strip_slack_ellipsis(s: str) -> str:
    s = s.rstrip()
    while s.endswith("\u2026") or s.endswith("…"):
        s = s[:-1].rstrip()
    if s.endswith("..."):
        s = s[:-3].rstrip()
    return s


def balance_outer_braces(s: str) -> str:
    """Append ``}`` until ``{`` and ``}`` counts match (ignores braces inside JSON strings)."""
    depth = 0
    i = 0
    in_str = False
    esc = False
    while i < len(s):
        c = s[i]
        if esc:
            esc = False
            i += 1
            continue
        if c == "\\" and in_str:
            esc = True
            i += 1
            continue
        if c == '"':
            in_str = not in_str
            i += 1
            continue
        if not in_str:
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
        i += 1
    if in_str:
        s = s + '"'
        depth = 0
        in_str = False
        esc = False
        i = 0
        while i < len(s):
            c = s[i]
            if esc:
                esc = False
                i += 1
                continue
            if c == "\\" and in_str:
                esc = True
                i += 1
                continue
            if c == '"':
                in_str = not in_str
                i += 1
                continue
            if not in_str:
                if c == "{":
                    depth += 1
                elif c == "}":
                    depth -= 1
            i += 1
    while depth > 0:
        s += "}"
        depth -= 1
    return s


def try_parse(s: str):
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        return None


def suffix_after_emergency_name(phone_esc: str) -> list[str]:
    """Literal suffixes (no f-string brace mangling)."""
    p = '"phone":"' + phone_esc + '"'
    return [
        p + "}}}}," + '"env":"qa"' + "}",
        p + "}}}}," + '"env":"production"' + "}",
        p + "}}}}}",
    ]


def suffix_data_registered(name_esc: str, phone_esc: str) -> list[str]:
    """When ``data`` ends after ``"status":"registered",``."""
    inner = (
        '"emergency_contact":{"name":"'
        + name_esc
        + '","phone":"'
        + phone_esc
        + '"}'
    )
    return [
        inner + "}}}," + '"env":"qa"' + "}",
        inner + "}}}," + '"env":"production"' + "}",
        inner + "}}}}",
    ]


def suffix_emergency_contact_object(name_esc: str, phone_esc: str) -> list[str]:
    """After ``"emergency_contact":`` with no ``{`` (truncated)."""
    inner = '{"name":"' + name_esc + '","phone":"' + phone_esc + '"}'
    return [
        inner + "}}}," + '"env":"qa"' + "}",
        inner + "}}}," + '"env":"production"' + "}",
        inner + "}}}}",
    ]


def repair_payload_contacts_only(s: str) -> dict | None:
    """
    ``{"payload":{...,"contacts":[...`` cut mid-array (Slack); no ``result`` on the line.
    """
    if '"contacts"' not in s or '"result"' in s:
        return None
    t = s
    changed = True
    while changed:
        changed = False
        t2 = re.sub(r",\s*\{[^}]*$", "", t)
        if t2 != t:
            t = t2
            changed = True
    t = t.rstrip().rstrip(",")
    t = re.sub(r',\s*"email"\s*:\s*"[^"]*$', "", t)
    t = re.sub(r',\s*"email"\s*:\s*"\s*$', "", t)
    t = re.sub(r',\s*"phone"\s*:\s*$', "", t)
    t = re.sub(r',\s*"phone"\s*:\s*"\s*$', "", t)
    t = t.rstrip().rstrip(",")
    for suf in ("]}}", "]}}}", "]}}}}"):
        if (obj := try_parse(t + suf)) is not None and "payload" in obj:
            return obj
    return None


def repair_line(raw: str) -> tuple[dict | None, str | None]:
    s = strip_prefix(raw)
    if not s or not s.startswith("{"):
        return None, "not_json_object"

    if (obj := try_parse(s)) is not None:
        return obj, None

    s = strip_slack_ellipsis(s)
    if (obj := try_parse(s)) is not None:
        return obj, None

    s = remove_trailing_commas(s)
    if (obj := try_parse(s)) is not None:
        return obj, None

    phone_esc = jesc(extract_reporter_phone(s))
    name_esc = jesc(extract_reporter_name(s))

    # 1) Truncated after emergency_contact name only
    if re.search(r'"emergency_contact"\s*:\s*\{\s*"name"\s*:\s*"[^"]*"\s*,\s*$', s):
        for suf in suffix_after_emergency_name(phone_esc):
            if (obj := try_parse(s + suf)) is not None:
                return obj, None

    # 2) Truncated after "status":"registered", inside data (before emergency_contact)
    if re.search(r'"status"\s*:\s*"registered"\s*,\s*$', s):
        for suf in suffix_data_registered(name_esc, phone_esc):
            if (obj := try_parse(s + suf)) is not None:
                return obj, None

    # 2b) ``"emergency_contact":`` with no object (truncated before ``{``)
    if re.search(r'"emergency_contact"\s*:\s*$', s):
        for suf in suffix_emergency_contact_object(name_esc, phone_esc):
            if (obj := try_parse(s + suf)) is not None:
                return obj, None

    # 2c) Payload-only log lines: ``contacts`` array cut mid-element (no ``result``)
    if (obj := repair_payload_contacts_only(s)) is not None:
        return obj, None

    # 3) Truncated mid "phone":" value
    if re.search(r'"phone"\s*:\s*"\s*$', s):
        m = re.search(r'^(.*"phone"\s*:\s*)', s)
        base = (m.group(1) + '"') if m else s
        for suf in (
            phone_esc + '"' + "}}}}," + '"env":"qa"' + "}",
            phone_esc + '"' + "}}}}," + '"env":"production"' + "}",
            phone_esc + '"' + "}}}}}",
        ):
            if (obj := try_parse(base + suf)) is not None:
                return obj, None

    # 4) Truncated mid-string in email or other field — close string and balance
    if re.search(r'"email"\s*:\s*"\s*$', s):
        s4 = s + '""}'
        s4 = balance_outer_braces(remove_trailing_commas(s4))
        if (obj := try_parse(s4)) is not None:
            return obj, None

    # 5) Truncated ``,"env"`` shown as ``,"e…`` (ellipsis)
    s5 = strip_prefix(raw)
    s5 = re.sub(r',\s*"e…\s*$', ',"env":"production"}', s5)
    s5 = re.sub(r',\s*"e\u2026\s*$', ',"env":"production"}', s5)
    if (obj := try_parse(s5)) is not None:
        return obj, None

    # 6) Generic: balance braces after stripping trailing comma
    s6 = balance_outer_braces(remove_trailing_commas(strip_slack_ellipsis(strip_prefix(raw))))
    if (obj := try_parse(s6)) is not None:
        return obj, None

    return None, "unrecoverable"


def main() -> None:
    text = Path(INPUT).read_text(encoding="utf-8", errors="replace")
    lines = text.splitlines()

    strict_ok: list[dict] = []
    recovered: list[dict] = []
    still_bad: list[str] = []

    for line_number, line in enumerate(lines, 1):
        stripped = line.strip()
        if not stripped:
            continue

        s = strip_prefix(stripped)
        if not s.startswith("{"):
            still_bad.append(f"Line {line_number}: skip (not JSON)\n{line}\n")
            continue

        if try_parse(s) is not None:
            strict_ok.append(json.loads(s))
            continue

        obj, err = repair_line(line)
        if obj is not None:
            obj["_recovered"] = True
            obj["_source_line"] = line_number
            recovered.append(obj)
        else:
            still_bad.append(f"Line {line_number}: {err}\n{line}\n")

    merged = strict_ok + recovered

    Path(OUTPUT_MERGED).write_text(
        json.dumps(merged, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    Path(OUTPUT_STILL_BAD).write_text(
        "\n" + ("-" * 80) + "\n".join(still_bad),
        encoding="utf-8",
    )

    print(f"Strict parse OK: {len(strict_ok)}")
    print(f"Recovered:       {len(recovered)}")
    print(f"Still bad:       {len(still_bad)}")
    print(f"Merged total:    {len(merged)}  →  {OUTPUT_MERGED}")
    print(f"Failures log:    {OUTPUT_STILL_BAD}")


if __name__ == "__main__":
    main()
