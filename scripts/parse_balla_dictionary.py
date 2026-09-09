# -*- coding: utf-8 -*-
"""
Parser for base/en-ua_angloukrayinskii_slovnik_miballa_engukr/eng-ukr_Balla_v1.3.csv
(Great English-Ukrainian Dictionary by M. I. Balla)
Transforms 78,000+ entries into an optimized bidirectional database for Dictionary & Word Game.
"""

import csv
import html
import json
import os
import re
import sys
import time

TAGS_TO_STRIP = {
    'n', 'v', 'adj', 'adv', 'prep', 'conj', 'pron', 'interj', 'num', 'phr', 'pred', 'pref', 'suf',
    'pl', 'sing', 'refl', 'past', 'p.p.',
    'поет.', 'розм.', 'амер.', 'мед.', 'юр.', 'військ.', 'тех.', 'хім.', 'фін.', 'спорт.', 'бот.', 'зоол.', 'грам.',
    'мор.', 'ав.', 'муз.', 'мат.', 'рел.', 'церк.', 'заст.', 'ірон.', 'зневажл.'
}

def clean_headword(raw_word):
    # e.g. "A{, a}" -> "A, a", "colour{, color}" -> "colour (color)"
    w = re.sub(r'\{,\s*([^}]+)\}', r' (\1)', raw_word)
    w = re.sub(r'[\{\}\~]', '', w)
    return w.strip()

def parse_balla_entry(word, raw_html, entry_id):
    en_clean = clean_headword(word)
    if not en_clean or len(en_clean) < 1:
        return None

    # Preserve cross-reference links like &lt;&lt;word&gt;&gt; or <<word>> before stripping tags
    processed_html = re.sub(r'&lt;&lt;\s*([^&]+?)\s*&gt;&gt;', r'«\1»', raw_html)
    processed_html = re.sub(r'<<\s*([^>]+?)\s*>>', r'«\1»', processed_html)

    text = html.unescape(processed_html)

    # Extract primary part of speech
    pos_matches = re.findall(r'<font color="green">(?:<i[^>]*>)?([a-z\.\s]+)(?:</i>)?</font>', text)
    pos_valid = [p.strip() for p in pos_matches if p.strip() in [
        "n", "v", "adj", "adv", "prep", "conj", "pron", "interj", "num", "phr", "pred", "pref", "suf"
    ]]
    pos = pos_valid[0] if pos_valid else ""

    # Strip HTML tags
    clean = re.sub(r'<[^>]+>', ' ', text)
    clean = re.sub(r'\[m\d\]', ' ', clean)
    clean = re.sub(r'\\+', '', clean)
    clean = re.sub(r'\s+', ' ', clean).strip()

    # Extract keywords for game & clean options
    keywords = []
    # Split definitions by semicolons or commas
    parts = [p.strip() for p in re.split(r'[;,\/]', clean) if re.search(r'[а-яА-ЯіїєґІЇЄҐ«»]', p)]
    for p in parts:
        p_clean = p
        # Remove example phrases: "phrase — translation"
        p_clean = re.sub(r'[a-zA-Z\~]+.*—.*', '', p_clean).strip()
        # Remove standalone English words not enclosed in quotes «...»
        p_clean = re.sub(r'\b[a-zA-Z\~]+\b(?![^«]*»)', '', p_clean).strip()

        # Remove roman or arabic numbering and grammar tags iteratively
        for _ in range(3):
            p_clean = re.sub(r'^(?:[IVXLCDM]+\.?|[0-9]+[\)\.]?|[абвгґ]\))\s*', '', p_clean).strip()
            p_clean = re.sub(r'^[0-9\.\)\s]+', '', p_clean).strip()
            for tag in TAGS_TO_STRIP:
                if p_clean.lower().startswith(tag + ' '):
                    p_clean = p_clean[len(tag):].strip()
                elif p_clean.lower() == tag:
                    p_clean = ''
            p_clean = re.sub(r'^[0-9\.\)\s]+', '', p_clean).strip()

        p_clean = re.sub(r'[\(\)\[\]]', '', p_clean).strip()
        p_clean = re.sub(r'\s+', ' ', p_clean).strip(' ;,.-')

        if len(p_clean) >= 2 and len(p_clean.split()) <= 4:
            if p_clean not in keywords and not re.search(r'^[0-9]+$', p_clean):
                keywords.append(p_clean)
        if len(keywords) >= 3:
            break

    # Clean display text for card (limit length for clean UI rendering)
    display_ua = clean
    if len(display_ua) > 320:
        display_ua = display_ua[:317] + "..."

    return {
        "id": entry_id,
        "en": en_clean,
        "pos": pos,
        "transcription": "",
        "ua": display_ua if display_ua else en_clean,
        "ua_keywords": keywords[:3] if keywords else ([display_ua[:35]] if display_ua else [en_clean])
    }

def convert_balla_to_json(csv_path, output_json_path):
    print(f"Reading Balla dictionary from {csv_path}...")
    start_time = time.time()

    entries = []
    seen_en = set()
    skipped_headers = 0

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        for row in reader:
            if not row or len(row) < 2:
                continue
            headword, body = row[0].strip(), row[1].strip()

            # Skip metadata rows
            if headword.startswith("#") or headword == "_about":
                skipped_headers += 1
                continue

            entry = parse_balla_entry(headword, body, len(entries) + 1)
            if entry:
                en_key = entry["en"].lower()
                if en_key in seen_en:
                    count = 2
                    while f"{en_key} ({count})" in seen_en:
                        count += 1
                    entry["en"] = f"{entry['en']} ({count})"
                    seen_en.add(entry["en"].lower())
                else:
                    seen_en.add(en_key)

                entries.append(entry)

    duration = time.time() - start_time
    print(f"Parsed {len(entries)} entries in {duration:.2f}s (skipped {skipped_headers} metadata headers).")

    print(f"Writing database to {output_json_path}...")
    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=None, separators=(',', ':'))

    size_mb = os.path.getsize(output_json_path) / (1024 * 1024)
    print(f"Done! Created {output_json_path} ({size_mb:.2f} MB) with {len(entries)} entries.")
    return len(entries)

if __name__ == "__main__":
    csv_file = "base/en-ua_angloukrayinskii_slovnik_miballa_engukr/eng-ukr_Balla_v1.3.csv"
    out_file = "data/dictionary_db.json"
    if not os.path.exists(csv_file):
        print(f"Error: {csv_file} not found!")
        sys.exit(1)
    convert_balla_to_json(csv_file, out_file)
