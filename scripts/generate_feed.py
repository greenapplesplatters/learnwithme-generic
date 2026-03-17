#!/usr/bin/env python3
"""
LearnWithMe: Feed Generation Script

Extracts concepts from lesson markdown files and generates adaptive quiz cards.
Works with any subject — not limited to AWS.

Steps:
1. Extract quiz questions from Self-Assessment sections of each lesson
2. Extract mental model rules from Mental Models sections of each lesson
3. Parse options A-D from quiz questions
4. Generate harder scenario versions using Claude API
5. Combine into feed.json with quiz_format, scenario_format, rule_format

Usage:
    export ANTHROPIC_API_KEY="your_key_here"
    python scripts/generate_feed.py
    python scripts/generate_feed.py --lessons-dir /path/to/lessons --subject "Biology"
"""

import argparse
import json
import re
import time
import os
import sys
from pathlib import Path

# Try to import Anthropic, with helpful error message
try:
    import anthropic
except ImportError:
    print("ERROR: anthropic not installed")
    print("Install with: pip install anthropic")
    sys.exit(1)

# ============================================================================
# CONFIGURATION  (defaults; overridden by CLI args)
# ============================================================================

DEFAULT_LESSONS_DIR = Path(__file__).parent.parent.parent / "lessons"
OUTPUT_DIR = Path(__file__).parent.parent / "src" / "data"
OUTPUT_FILE = OUTPUT_DIR / "feed.json"

# ============================================================================
# PARSING FUNCTIONS
# ============================================================================

def extract_self_assessments(content):
    """
    Extract self-assessment questions. Section heading varies per lesson
    (7️⃣, 8️⃣, 9️⃣, 🔟, etc.) so we match any emoji prefix.

    Question block structure:
        ### Q1: Title
        Actual question text?

        A) Option
        B) Option
        C) Option
        D) Option

        **Correct**: B (optional inline note)

        **If you pick wrong**:
        ...explanation...
    """
    section_match = re.search(
        r'## .+ Embedded Self-Assessment\n(.*?)(?=\n## |\Z)',
        content,
        re.DOTALL
    )
    if not section_match:
        return []

    section = section_match.group(1)

    # Split on --- dividers to isolate each question block
    blocks = re.split(r'\n---+\n', section)

    questions = []
    for block in blocks:
        block = block.strip()
        if not block or '### Q' not in block:
            continue

        # Extract question number — handles both "Q1:" and "Question 1:" formats
        title_match = re.match(r'### (?:Q(?:uestion\s*)?)(\d+)[:\.]?\s*(.+)', block)
        if not title_match:
            continue
        q_num = int(title_match.group(1))
        title = title_match.group(2).strip()

        # The real question is the first non-blank non-option non-bold line after the title
        lines = block.split('\n')
        question_text = title  # fallback to title
        for line in lines[1:]:
            stripped = line.strip()
            if stripped and not stripped.startswith('A)') and not stripped.startswith('**') and not stripped.startswith('#'):
                question_text = stripped
                break

        # Extract correct letter — handles "**Correct**:" and "**Correct Answer**:"
        correct_match = re.search(r'\*\*Correct(?:\s+Answer)?\*\*:\s*([A-D])', block)
        if not correct_match:
            continue
        correct_letter = correct_match.group(1)

        # Parse options
        options = parse_options(block, correct_letter)
        if not options:
            continue

        # Explanation = everything after the **Correct** line
        correct_pos = block.find('**Correct')
        correct_line_end = block.find('\n', correct_pos) if correct_pos != -1 else -1
        explanation = block[correct_line_end:].strip() if correct_line_end != -1 else ''

        questions.append({
            "q_num": q_num,
            "question": question_text,
            "options": options,
            "correct": correct_letter,
            "explanation": explanation
        })

    return questions


def parse_options(block, correct_letter):
    """
    Parse A) B) C) D) options from a question block.
    Only scans text BEFORE **Correct to avoid matching option labels
    reused in 'If you pick wrong' explanation sections.
    """
    # Restrict to text before **Correct so explanation labels don't bleed in
    correct_pos = block.find('**Correct')
    options_section = block[:correct_pos] if correct_pos != -1 else block

    options = []
    pattern = r'([A-D]\))\s*(.*?)(?=\n[A-D]\)|\n\n|\Z)'
    matches = re.findall(pattern, options_section, re.DOTALL)

    for letter_raw, text in matches:
        letter = letter_raw.strip(')')
        text = re.sub(r'\s+', ' ', text).strip()
        text = re.sub(r'^\*+|\*+$', '', text).strip()
        if text:
            options.append({
                "letter": letter,
                "text": text,
                "correct": letter == correct_letter
            })

    return options


def extract_mental_models(content):
    """
    Extract mental model rules. Section heading varies per lesson.

    Looks for:
        ### Rule Title
        **Rule statement**
    """
    section_match = re.search(
        r'## .+ Mental Models.*?\n(.*?)(?=\n---|\n## |\Z)',
        content,
        re.DOTALL
    )
    if not section_match:
        return []

    section = section_match.group(1)

    # Extract rule statements: ### Title\n**statement**
    pattern = r'### .+?\n\*\*(.*?)\*\*'
    matches = re.findall(pattern, section, re.DOTALL)

    return [m.strip() for m in matches]

# ============================================================================
# CLAUDE GENERATION
# ============================================================================

def generate_scenario_with_claude(client, concept_question, explanation, subject="General"):
    """
    Use Claude Sonnet to generate a harder scenario version.

    The scenario should:
    - Apply the concept in a realistic, multi-factor situation
    - Include tradeoffs that force deeper understanding
    - Be realistic (like actual exam questions for the subject)
    """

    prompt = f"""You are an expert teacher and exam writer for the subject: {subject}.

Original concept: {concept_question}

Create a HARDER SCENARIO VERSION that:
1. Applies the concept in a realistic, multi-variable situation
2. Includes tradeoffs (e.g. cost/performance, speed/accuracy, risk/reward)
3. Forces deeper understanding beyond surface memorization
4. Is realistic (like actual exam questions for {subject})

The scenario should NOT be answerable by someone who just memorized the original question.

Return ONLY valid JSON (no markdown, no explanation, just the JSON):
{{
  "question": "Detailed scenario description...",
  "options": [
    {{"text": "Option A description", "correct": true, "reason": "Why this is the best choice"}},
    {{"text": "Option B description", "correct": false, "reason": "Why this is incorrect"}},
    {{"text": "Option C description", "correct": false, "reason": "Why this is incorrect"}},
    {{"text": "Option D description", "correct": false, "reason": "Why this is incorrect"}}
  ],
  "explanation": "Detailed explanation of the concept and why the correct answer is right"
}}"""

    try:
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}]
        )
        response_text = message.content[0].text.strip()

        # Strip markdown code fences if present
        if response_text.startswith("```"):
            response_text = re.sub(r'^```(?:json)?\n?', '', response_text)
            response_text = re.sub(r'\n?```$', '', response_text)

        scenario = json.loads(response_text)
        return scenario
    except json.JSONDecodeError as e:
        print(f"    Failed to parse JSON: {e}")
        return None
    except Exception as e:
        print(f"    Error: {e}")
        return None

# ============================================================================
# MAIN PROCESSING
# ============================================================================

def topic_from_filename(stem):
    """Derive a human-readable topic name from the lesson filename stem."""
    # Strip common suffixes like _lesson, _lesson_YYYY-MM-DD
    name = re.sub(r'_lesson.*$', '', stem)
    # Replace underscores/hyphens with spaces and title-case
    name = name.replace('_', ' ').replace('-', ' ').title()
    return name


def process_lesson(lesson_path):
    """Process a single lesson file and extract concepts"""

    print(f"\n📖 {lesson_path.stem}")

    with open(lesson_path, 'r') as f:
        content = f.read()

    # Derive topic from filename
    topic = topic_from_filename(lesson_path.stem)

    # Extract questions and rules
    questions = extract_self_assessments(content)
    rules = extract_mental_models(content)

    if not questions:
        print(f"   ⚠️  No self-assessments found")
        return []

    print(f"   ✓ Found {len(questions)} questions")
    print(f"   ✓ Found {len(rules)} mental models")

    # Combine questions with rules
    concepts = []

    for i, q in enumerate(questions):
        concept_id = f"{lesson_path.stem.lower()}-q{q['q_num']}"

        # Build quiz format (from original question)
        quiz_format = {
            "question": q['question'],
            "options": [
                {
                    "text": opt['text'],
                    "correct": opt['correct']
                }
                for opt in q['options']
            ],
            "explanation": q['explanation']
        }

        # Get corresponding rule (by position)
        rule_statement = rules[i] if i < len(rules) else f"Review: {q['question'][:50]}"
        rule_format = {
            "statement": rule_statement
        }

        concept = {
            "concept_id": concept_id,
            "topic": topic,
            "question_text": q['question'],
            "quiz_format": quiz_format,
            "rule_format": rule_format,
            # scenario_format will be generated next
        }

        concepts.append(concept)

    return concepts

def generate_scenarios(concepts, api_key, subject="General"):
    """Generate scenario versions for all concepts using Claude"""

    if not api_key:
        print("\n⚠️  ANTHROPIC_API_KEY not set. Skipping scenario generation.")
        print("   Set it with: export ANTHROPIC_API_KEY='your_key_here'")
        return

    client = anthropic.Anthropic(api_key=api_key)

    print(f"\n🤖 Generating {len(concepts)} scenarios with Claude Sonnet...")
    print("   (0.3s delay between requests)")

    generated_count = 0
    failed_count = 0

    for concept in concepts:
        print(f"\n   [{generated_count + failed_count + 1}/{len(concepts)}] {concept['concept_id']}")

        scenario = generate_scenario_with_claude(
            client,
            concept['question_text'],
            concept['quiz_format']['explanation'],
            subject=subject
        )

        if scenario:
            concept['scenario_format'] = scenario
            generated_count += 1
            print(f"      ✓ Generated")
        else:
            failed_count += 1
            print(f"      ✗ Failed (using fallback)")
            concept['scenario_format'] = {
                "question": f"Advanced: {concept['question_text']}",
                "options": concept['quiz_format']['options'],
                "explanation": concept['quiz_format']['explanation']
            }

        time.sleep(0.3)

    print(f"\n   ✓ Generated: {generated_count}")
    print(f"   ✗ Failed: {failed_count}")

def main():
    parser = argparse.ArgumentParser(description="LearnWithMe: Feed Generation Script")
    parser.add_argument(
        "--lessons-dir",
        type=Path,
        default=DEFAULT_LESSONS_DIR,
        help="Path to directory containing lesson .md files (default: ../../lessons relative to script)"
    )
    parser.add_argument(
        "--subject",
        type=str,
        default="General",
        help="Subject name shown in scenario prompts and app header (e.g. 'AWS SAA-C03', 'AP Biology')"
    )
    args = parser.parse_args()

    LESSONS_DIR = args.lessons_dir
    subject = args.subject

    print("=" * 70)
    print(f"LearnWithMe: Feed Generation — {subject}")
    print("=" * 70)

    # Check if ANTHROPIC_API_KEY is set
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print("\n⚠️  WARNING: ANTHROPIC_API_KEY not set")
        print("   Scenarios will use quiz as fallback")
        print("   Set it with: export ANTHROPIC_API_KEY='your_key_here'")

    # Find lesson files
    if not LESSONS_DIR.exists():
        print(f"\n❌ ERROR: Lessons directory not found: {LESSONS_DIR}")
        print("   Pass --lessons-dir /path/to/your/lessons")
        sys.exit(1)

    lesson_files = sorted(LESSONS_DIR.glob("*_lesson*.md"))

    if not lesson_files:
        print(f"\n❌ ERROR: No lesson files found in {LESSONS_DIR}")
        sys.exit(1)

    print(f"\nFound {len(lesson_files)} lesson files")

    # ========================================================================
    # STEP 1: Extract from lessons
    # ========================================================================
    print("\n" + "=" * 70)
    print("STEP 1: Extracting concepts from lessons")
    print("=" * 70)

    all_concepts = []

    for lesson_path in lesson_files:
        concepts = process_lesson(lesson_path)
        all_concepts.extend(concepts)

    print(f"\n✅ Total concepts extracted: {len(all_concepts)}")

    # ========================================================================
    # STEP 2: Generate scenarios
    # ========================================================================
    print("\n" + "=" * 70)
    print("STEP 2: Generating scenario versions")
    print("=" * 70)

    if api_key:
        generate_scenarios(all_concepts, api_key, subject=subject)
    else:
        print("\n⏭️  Skipping scenario generation (no API key)")
        # Add fallback scenarios
        for concept in all_concepts:
            concept['scenario_format'] = {
                "question": f"Advanced scenario: {concept['question_text']}",
                "options": concept['quiz_format']['options'],
                "explanation": concept['quiz_format']['explanation']
            }

    # ========================================================================
    # STEP 3: Save feed.json
    # ========================================================================
    print("\n" + "=" * 70)
    print("STEP 3: Saving feed.json")
    print("=" * 70)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Sort by topic, then by concept_id for consistent ordering
    all_concepts.sort(key=lambda x: (x['topic'], x['concept_id']))

    with open(OUTPUT_FILE, 'w') as f:
        json.dump(all_concepts, f, indent=2)

    print(f"\n✅ Saved {len(all_concepts)} concepts to {OUTPUT_FILE}")

    # Write subject.json so the app knows which subject it's showing
    subject_file = OUTPUT_DIR / "subject.json"
    with open(subject_file, 'w') as f:
        json.dump({"name": subject}, f, indent=2)
    print(f"✅ Saved subject config to {subject_file}")

    # ========================================================================
    # STEP 4: Summary
    # ========================================================================
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)

    # Count by topic
    topics = {}
    for concept in all_concepts:
        topic = concept['topic']
        topics[topic] = topics.get(topic, 0) + 1

    for topic in sorted(topics.keys()):
        print(f"  {topic}: {topics[topic]} concepts")

    print(f"\n📊 Total: {len(all_concepts)} concepts")
    print(f"   - Quiz format: ✓")
    print(f"   - Scenario format: {'✓' if api_key else '⚠️  (fallback)'}")
    print(f"   - Rule format: ✓")

    print(f"\n✨ Feed is ready for doomscroll-app!")
    print(f"   Subject: {subject}")
    print(f"   Next: npm run dev")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
        sys.exit(0)
    except Exception as e:
        print(f"\n\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
