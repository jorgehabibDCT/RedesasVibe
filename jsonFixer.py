import json
from pathlib import Path

input_file = "theft-payloads.json"
output_file = "theft-payloads-formatted.json"
bad_file = "theft-payloads-bad-lines.txt"

records = []
bad_entries = []

for line_number, line in enumerate(Path(input_file).read_text(encoding="utf-8", errors="replace").splitlines(), 1):
    line = line.strip()
    if not line:
        continue

    prefix = "Encontrack Log:"
    if prefix in line:
        line = line.split(prefix, 1)[1].strip()

    if not line:
        continue

    try:
        obj = json.loads(line)
        records.append(obj)
    except json.JSONDecodeError as e:
        bad_entries.append(f"Line {line_number}: {e}\n{line}\n")

Path(output_file).write_text(
    json.dumps(records, indent=2, ensure_ascii=False),
    encoding="utf-8"
)

Path(bad_file).write_text(
    "\n" + ("-" * 80) + "\n".join(bad_entries),
    encoding="utf-8"
)

print(f"Valid JSON objects saved: {len(records)}")
print(f"Bad entries saved: {len(bad_entries)}")
print(f"Output: {output_file}")
print(f"Rejected lines log: {bad_file}")