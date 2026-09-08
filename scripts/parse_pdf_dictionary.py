# -*- coding: utf-8 -*-
"""
Parser for base/file.pdf (English-Ukrainian Dictionary by Dr. Wasyl Lew & Iwan Werbianyj)
Extracts dictionary entries, cleans OCR artifacts, and builds a bidirectional JSON database.
"""

import sys
import os
import re
import json

# Add scratch/lib for pypdf if needed
sys.path.insert(0, os.path.abspath('scratch/lib'))

try:
    from pypdf import PdfReader
except ImportError:
    print("pypdf is required. Ensure scratch/lib is populated.")
    sys.exit(1)

def clean_text(txt):
    """Clean common OCR artifacts from text"""
    # Fix broken hyphens at end of line (e.g. "до- \n давати" -> "додавати")
    txt = re.sub(r'(\w+)-\s*\n\s*(\w+)', r'\1\2', txt)
    # Fix spaces inside words caused by OCR like "а к т о р" or multiple spaces
    txt = re.sub(r'[ \t]+', ' ', txt)
    return txt

def parse_dictionary(pdf_path):
    reader = PdfReader(pdf_path)
    total_pages = len(reader.pages)
    print(f"Loaded {pdf_path}: total {total_pages} pages.")

    # Dictionary content is located roughly between page 33 and 222 (0-based: 32 to 221)
    start_page = 32
    end_page = 222

    raw_text = ""
    for p in range(start_page, min(end_page, total_pages)):
        page_text = reader.pages[p].extract_text()
        if page_text:
            raw_text += "\n" + page_text

    raw_text = clean_text(raw_text)

    lines = raw_text.splitlines()
    print(f"Extracted {len(lines)} lines from dictionary pages.")

    entries = []
    current_entry = None

    # Regex for matching an English entry start:
    # e.g., "accident (Tasksid8nt) нещастя, нещасливий випадок"
    # or "like (laik) 1. подобатися; любити..."
    # English word: 2-30 letters, dashes, apostrophes
    entry_pattern = re.compile(
        r'^\s*([a-zA-Z][a-zA-Z\s\-\,\(\)\/\'\`]{1,30})\s+[\(\[\{]([^\)\]\}]+)[\)\]\}]\s*(.*)$'
    )

    ukr_char_re = re.compile(r'[а-яА-ЯіїєґІЇЄҐ]')

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Skip header/footer line numbers like "abuse 2 activity" or "yearling 189 zero"
        if re.match(r'^[a-zA-Z]+\s+\d+\s+[a-zA-Z]+$', line):
            continue
        if re.match(r'^\d+$', line):
            continue

        m = entry_pattern.match(line)
        if m:
            en_part = m.group(1).strip()
            transc = m.group(2).strip()
            ua_part = m.group(3).strip()

            # Clean English headword (remove trailing numbers/symbols)
            en_clean = re.sub(r'[\d\~\=\*]+', '', en_part).strip().lower()
            en_clean = re.sub(r'\s+', ' ', en_clean)

            # Validate that en_clean is an actual English word
            if len(en_clean) >= 2 and re.match(r'^[a-z][a-z\s\-\']+$', en_clean):
                if current_entry:
                    entries.append(current_entry)
                current_entry = {
                    "en": en_clean,
                    "transcription": transc,
                    "ua": ua_part
                }
                continue

        # If not a new headword, it might be a continuation of the Ukrainian translation
        if current_entry and ukr_char_re.search(line):
            # Append continuation
            current_entry["ua"] += " " + line

    if current_entry:
        entries.append(current_entry)

    print(f"Initially parsed {len(entries)} entries.")

    # Post-process and refine entries
    refined_entries = []
    seen_en = set()

    for idx, e in enumerate(entries):
        en_word = e["en"].strip()
        ua_text = e["ua"].strip()

        # Remove OCR noise and excessive digits
        ua_clean = re.sub(r'\b[1-9]\.\s*', '', ua_text)
        ua_clean = re.sub(r'[\~\=\*\_\|\[\]\{\}]+', ' ', ua_clean)
        ua_clean = re.sub(r'\s+', ' ', ua_clean).strip(' ;,.-')

        # Must have at least some Cyrillic characters in the translation
        if not ukr_char_re.search(ua_clean):
            continue

        # Skip entries where Ukrainian text is too short or corrupted
        if len(ua_clean) < 2:
            continue

        # Clean multiple definitions into keywords
        parts = [p.strip() for p in re.split(r'[;,\/]', ua_clean) if len(p.strip()) >= 2]
        keywords = []
        for p in parts:
            # take first 3 words of part
            words = p.split()
            if len(words) <= 4:
                keywords.append(p)
            if len(keywords) >= 5:
                break

        if en_word not in seen_en:
            seen_en.add(en_word)
            refined_entries.append({
                "id": len(refined_entries) + 1,
                "en": en_word,
                "transcription": f"[{e['transcription']}]" if e['transcription'] else "",
                "ua": ua_clean[:180], # keep concise and readable
                "ua_keywords": keywords[:3] if keywords else [ua_clean[:30]]
            })

    print(f"Refined into {len(refined_entries)} high quality dictionary entries.")
    return refined_entries

def main():
    pdf_path = "base/file.pdf"
    if not os.path.exists(pdf_path):
        print(f"File {pdf_path} not found!")
        sys.exit(1)

    entries = parse_dictionary(pdf_path)

    output_path = "data/dictionary_db.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)

    print(f"Saved {len(entries)} entries to {output_path}!")

if __name__ == "__main__":
    main()
