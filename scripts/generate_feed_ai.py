#!/usr/bin/env python3
"""
LearnWithMe: AI-Powered Feed Generation

Generates quiz cards directly from a subject + topic list.
No lesson files required.

Supported providers:
  claude  — requires ANTHROPIC_API_KEY
  gemini  — requires GEMINI_API_KEY

Usage:
    python scripts/generate_feed_ai.py --subject "AP Biology" --topics "Cells,Genetics,Evolution"
    python scripts/generate_feed_ai.py --subject "Spanish B2" --topics-file topics.txt --provider gemini
    python scripts/generate_feed_ai.py --subject "AWS SAA-C03" --topics "S3,EC2,IAM" --cards-per-topic 5

If --topics and --topics-file are both omitted, the AI will suggest topics automatically.
"""

import argparse
import json
import re
import time
import os
import sys
from pathlib import Path

# ============================================================================
# PROVIDER ABSTRACTION
# ============================================================================

def get_client(provider):
    if provider == "claude":
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            print("❌  ANTHROPIC_API_KEY is not set.")
            print("    export ANTHROPIC_API_KEY='sk-...'")
            sys.exit(1)
        try:
            import anthropic
            return anthropic.Anthropic(api_key=api_key)
        except ImportError:
            print("❌  anthropic not installed.  Run: pip install anthropic")
            sys.exit(1)

    elif provider == "gemini":
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            print("❌  GEMINI_API_KEY is not set.")
            print("    export GEMINI_API_KEY='AIza...'")
            sys.exit(1)
        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            return genai.GenerativeModel("gemini-2.0-flash")
        except ImportError:
            print("❌  google-generativeai not installed.  Run: pip install google-generativeai")
            sys.exit(1)


def call_ai(client, prompt, provider):
    """Send a prompt and return the raw response text."""
    if provider == "claude":
        msg = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
        )
        return msg.content[0].text.strip()

    elif provider == "gemini":
        response = client.generate_content(prompt)
        return response.text.strip()


def parse_json_response(text):
    """Strip markdown fences (if any) and parse JSON."""
    text = re.sub(r'^```(?:json)?\n?', '', text.strip())
    text = re.sub(r'\n?```$', '', text)
    return json.loads(text)

# ============================================================================
# PROMPTS
# ============================================================================

TOPICS_PROMPT = """\
You are an expert curriculum designer.

List the 8-12 most important topics to study for: "{subject}"

Return ONLY a valid JSON array of topic name strings (no markdown, no explanation):
["Topic 1", "Topic 2", ...]"""


REWORD_PROMPT = """\
You are an expert teacher for: {subject}

Here is an existing quiz card:
{original_json}

Generate exactly 2 REWORDED VERSIONS of this card that test the IDENTICAL concept but use \
completely different wording, contexts, and examples.

- Variant 1 (context-shift): A fresh real-world scenario — for a student re-encountering a \
concept they previously got wrong. Different surface details, same underlying rule.
- Variant 2 (edge-case): An abstract or edge-case framing — for long-term retention after \
the student has already mastered the basic version.

Return ONLY a valid JSON array with exactly 2 objects (no markdown fences, no extra text):
[
  {{
    "quiz_format": {{"question": "...", "options": [{{"text": "...", "correct": true}}, ...], "explanation": "..."}},
    "scenario_format": {{"question": "...", "options": [{{"text": "...", "correct": true}}, ...], "explanation": "..."}},
    "rule_format": {{"statement": "..."}}
  }},
  {{
    "quiz_format": {{"question": "...", "options": [{{"text": "...", "correct": true}}, ...], "explanation": "..."}},
    "scenario_format": {{"question": "...", "options": [{{"text": "...", "correct": true}}, ...], "explanation": "..."}},
    "rule_format": {{"statement": "..."}}
  }}
]"""


CARDS_PROMPT = """\
You are an expert teacher and exam writer for: {subject}

Generate exactly {n} quiz cards for the topic: "{topic}"

Rules:
- Each card must test a DISTINCT concept within the topic
- Exactly one option must be correct per question
- The scenario version must require deeper reasoning than the quiz version
- The rule statement must be punchy and memorable (use **bold** for key terms)

Return ONLY a valid JSON array (no markdown fences, no extra text):
[
  {{
    "question_text": "One-line description of what this card tests",
    "quiz_format": {{
      "question": "Direct question testing a specific concept?",
      "options": [
        {{"text": "...", "correct": true}},
        {{"text": "...", "correct": false}},
        {{"text": "...", "correct": false}},
        {{"text": "...", "correct": false}}
      ],
      "explanation": "Why the correct answer is right and why the others are wrong."
    }},
    "scenario_format": {{
      "question": "Realistic scenario with tradeoffs that requires applying the concept...",
      "options": [
        {{"text": "...", "correct": true}},
        {{"text": "...", "correct": false}},
        {{"text": "...", "correct": false}},
        {{"text": "...", "correct": false}}
      ],
      "explanation": "Detailed reasoning for the correct choice in this scenario."
    }},
    "rule_format": {{
      "statement": "Punchy rule: **key term** → what it means in practice."
    }}
  }}
]"""

# ============================================================================
# GENERATION
# ============================================================================

def fetch_topics(client, provider, subject):
    print("\n🤖 No topics provided — asking AI to suggest topics...")
    prompt = TOPICS_PROMPT.format(subject=subject)
    try:
        text = call_ai(client, prompt, provider)
        topics = parse_json_response(text)
        print(f"   Suggested {len(topics)} topics:")
        for t in topics:
            print(f"   • {t}")
        return topics
    except Exception as e:
        print(f"✗ Could not auto-generate topics: {e}")
        return []


def generate_cards(client, provider, subject, topic, n):
    prompt = CARDS_PROMPT.format(subject=subject, topic=topic, n=n)
    try:
        text = call_ai(client, prompt, provider)
        return parse_json_response(text)
    except json.JSONDecodeError as e:
        print(f"    ✗ JSON parse error: {e}")
        return []
    except Exception as e:
        print(f"    ✗ Error: {e}")
        return []


def generate_variants(client, provider, subject, card):
    """Generate 2 reworded variants for an existing card. Returns [v1, v2] or []."""
    v0_json = json.dumps({
        "quiz_format": card.get("quiz_format", {}),
        "scenario_format": card.get("scenario_format", {}),
        "rule_format": card.get("rule_format", {}),
    }, indent=2)
    prompt = REWORD_PROMPT.format(subject=subject, original_json=v0_json)
    try:
        text = call_ai(client, prompt, provider)
        return parse_json_response(text)
    except json.JSONDecodeError as e:
        print(f"    ✗ Variant JSON parse error: {e}")
        return []
    except Exception as e:
        print(f"    ✗ Variant error: {e}")
        return []


def concept_id(topic, index):
    slug = re.sub(r'[^a-z0-9]+', '-', topic.lower()).strip('-')
    return f"{slug}-{index + 1}"

# ============================================================================
# OUTPUT
# ============================================================================

OUTPUT_DIR = Path(__file__).parent.parent / "src" / "data"
DEFAULT_TOPICS_FILE = Path(__file__).parent.parent / "topics.txt"
SUBJECT_JSON = OUTPUT_DIR / "subject.json"

# ============================================================================
# MAIN
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="LearnWithMe: AI-Powered Feed Generation"
    )
    # Subject: CLI arg → SUBJECT env var → subject.json → error
    subject_default = (
        os.getenv("SUBJECT")
        or (json.loads(SUBJECT_JSON.read_text())["name"] if SUBJECT_JSON.exists() else None)
    )
    parser.add_argument(
        "--subject",
        default=subject_default,
        required=(subject_default is None),
        help='Subject name shown in the app (e.g. "AP Biology"). '
             'Falls back to SUBJECT env var or src/data/subject.json.'
    )
    parser.add_argument(
        "--topics",
        help='Comma-separated topic list (e.g. "Cells,Genetics,Evolution")'
    )
    parser.add_argument(
        "--topics-file", type=Path,
        help="Text file with one topic per line"
    )
    parser.add_argument(
        "--cards-per-topic", type=int, default=3,
        help="Cards to generate per topic (default: 3)"
    )
    # Provider: CLI arg → LWM_PROVIDER env var → "claude"
    provider_default = os.getenv("LWM_PROVIDER", "claude")
    parser.add_argument(
        "--provider", choices=["claude", "gemini"], default=provider_default,
        help="AI provider — claude (ANTHROPIC_API_KEY) or gemini (GEMINI_API_KEY). "
             "Falls back to LWM_PROVIDER env var (default: claude)."
    )
    parser.add_argument(
        "--skip-variants", action="store_true",
        help="Skip reword variant generation (faster, fewer API calls)"
    )
    args = parser.parse_args()

    subject  = args.subject
    provider = args.provider

    print("=" * 70)
    print(f"LearnWithMe: AI Feed Generation")
    print(f"Subject  : {subject}")
    print(f"Provider : {provider}")
    print("=" * 70)

    client = get_client(provider)

    # Resolve topics: explicit args → topics.txt in project root → AI-generated
    if args.topics_file:
        topics = [t.strip() for t in args.topics_file.read_text().splitlines() if t.strip()]
    elif args.topics:
        topics = [t.strip() for t in args.topics.split(",") if t.strip()]
    elif DEFAULT_TOPICS_FILE.exists():
        raw = [t.strip() for t in DEFAULT_TOPICS_FILE.read_text().splitlines() if t.strip() and not t.startswith("#")]
        topics = raw
        print(f"\n📄 Loaded {len(topics)} topics from topics.txt")
    else:
        topics = fetch_topics(client, provider, subject)
        if not topics:
            print("❌  Could not generate topic list. Add a topics.txt file or pass --topics.")
            sys.exit(1)

    n = args.cards_per_topic
    print(f"\nTopics ({len(topics)}): {', '.join(topics)}")
    print(f"Cards per topic : {n}")
    print(f"Total expected  : ~{len(topics) * n}")

    # Generate
    print("\n" + "=" * 70)
    all_concepts = []

    for topic in topics:
        print(f"\n🃏 {topic}")
        cards = generate_cards(client, provider, subject, topic, n)

        if not cards:
            print(f"   ✗ No cards generated — skipping")
            continue

        for i, card in enumerate(cards):
            card["concept_id"] = concept_id(topic, i)
            card["topic"] = topic
            all_concepts.append(card)

        print(f"   ✓ {len(cards)} card(s)")
        time.sleep(0.3)

    if not all_concepts:
        print("\n❌  No cards were generated. Check your API key and try again.")
        sys.exit(1)

    print(f"\n✅ Total: {len(all_concepts)} cards")

    # ── Pass 2: generate reword variants ─────────────────────────────────────
    if args.skip_variants:
        print("\n⏭️  Skipping variant generation (--skip-variants)")
    else:
        print("\n" + "=" * 70)
        print("Pass 2: Generating reword variants (v1 context-shift, v2 edge-case)")
        print("=" * 70)
        v_ok = 0
        v_fail = 0
        for i, concept in enumerate(all_concepts):
            print(f"\n   [{i + 1}/{len(all_concepts)}] {concept['concept_id']}")
            v0 = {
                "quiz_format": concept.get("quiz_format", {}),
                "scenario_format": concept.get("scenario_format", {}),
                "rule_format": concept.get("rule_format", {}),
            }
            extras = generate_variants(client, provider, subject, concept)
            if len(extras) == 2:
                concept["variants"] = [v0] + extras
                print(f"      ✓ 3 variants")
                v_ok += 1
            else:
                # Fallback: all 3 variants are the same (app still works)
                concept["variants"] = [v0, v0, v0]
                print(f"      ✗ Failed — using original for all variants")
                v_fail += 1
            time.sleep(0.3)
        print(f"\n   ✓ {v_ok} succeeded  ✗ {v_fail} failed")

    # Save
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    with open(OUTPUT_DIR / "feed.json", "w") as f:
        json.dump(all_concepts, f, indent=2)
    print(f"✅ Saved feed.json")

    with open(OUTPUT_DIR / "subject.json", "w") as f:
        json.dump({"name": subject}, f, indent=2)
    print(f"✅ Saved subject.json")

    print(f"\n✨ Run:  npm run dev")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌  ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
