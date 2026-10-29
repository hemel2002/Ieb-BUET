"""Extract the candidate list from the IEB election spreadsheet into JSON.

Usage: python3 -I scripts/extract_xlsx.py data/BUETian_IEB_Election_Candidates.xlsx data/candidates.json

The sheet is laid out as titled sections (merged title rows), each followed by a
header row and two side-by-side tables (columns A-D and F-I). Values are copied
verbatim; only surrounding whitespace is trimmed.
"""
import json
import re
import sys

import openpyxl


def clean(value):
    if value is None:
        return None
    text = re.sub(r"\s+", " ", str(value)).strip()
    return text or None


def main(src, dest):
    wb = openpyxl.load_workbook(src, read_only=False, data_only=True)
    ws = wb.worksheets[0]
    merged_rows = {r.min_row for r in ws.merged_cells.ranges}

    title = clean(ws.cell(1, 1).value)
    subtitle = clean(ws.cell(2, 1).value)
    sections = []
    current = None
    layout = None  # list of (start_col, {field: offset})

    for row in ws.iter_rows(min_row=3):
        r = row[0].row
        values = [clean(c.value) for c in row]
        if not any(values):
            continue
        if r in merged_rows:
            current = {"name": values[0], "entries": []}
            sections.append(current)
            layout = None
            continue
        if values[0] == "Ballot No":
            layout = []
            for start in (0, 5):
                headers = values[start:start + 4]
                if headers and headers[0] == "Ballot No":
                    fields = {}
                    for i, h in enumerate(headers):
                        key = {"Ballot No": "ballotNo", "Name of the Post": "post",
                               "Candidate Name": "name", "F/M": "membershipNo"}.get(h)
                        if key:
                            fields[key] = start + i
                    layout.append(fields)
            continue
        if current is None or layout is None:
            raise ValueError(f"Row {r} appears before a section header")
        for side, fields in enumerate(layout):
            entry = {k: values[col] if col < len(values) else None for k, col in fields.items()}
            if not entry.get("name"):
                continue
            entry.setdefault("post", None)
            entry["sourceRow"] = r
            entry["sourceSide"] = "left" if side == 0 else "right"
            current["entries"].append(entry)

    with open(dest, "w", encoding="utf-8") as fh:
        json.dump({"title": title, "subtitle": subtitle, "sections": sections}, fh,
                  ensure_ascii=False, indent=2)
    total = sum(len(s["entries"]) for s in sections)
    print(f"Extracted {total} ballot entries in {len(sections)} sections -> {dest}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
