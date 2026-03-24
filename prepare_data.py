"""Parse preference CSV and create HuggingFace datasets for reward model and PPO training."""

import csv
import json
from pathlib import Path
from datasets import Dataset

CSV_PATH = Path("preferences_2026-03-22 (1).csv")
OUTPUT_DIR = Path("data")


def load_preferences(csv_path: Path) -> list[dict]:
    """Parse CSV with multi-line quoted fields into preference records."""
    records = []
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Skip ties — ambiguous signal for reward model
            if row.get("is_tie") == "1":
                continue
            prompt = (row.get("prompt") or "").strip()
            chosen = (row.get("chosen") or "").strip()
            rejected = (row.get("rejected") or "").strip()
            if not prompt or not chosen or not rejected:
                continue
            records.append({
                "prompt": prompt,
                "chosen": chosen,
                "rejected": rejected,
                "prompt_category": row.get("prompt_category", ""),
                "chosen_model": row.get("chosen_model", ""),
                "rejected_model": row.get("rejected_model", ""),
            })
    return records


def build_reward_dataset(records: list[dict]) -> Dataset:
    """Build dataset for RewardTrainer: chosen/rejected as full prompt+response text."""
    chosen_texts, rejected_texts = [], []
    for r in records:
        chosen_texts.append(f"### Prompt:\n{r['prompt']}\n\n### Response:\n{r['chosen']}")
        rejected_texts.append(f"### Prompt:\n{r['prompt']}\n\n### Response:\n{r['rejected']}")
    return Dataset.from_dict({"chosen": chosen_texts, "rejected": rejected_texts})


def build_ppo_dataset(records: list[dict]) -> Dataset:
    """Build dataset for PPO: just unique prompts."""
    seen, prompts = set(), []
    for r in records:
        if r["prompt"] not in seen:
            seen.add(r["prompt"])
            prompts.append(f"### Prompt:\n{r['prompt']}\n\n### Response:\n")
    return Dataset.from_dict({"query": prompts})


def main():
    OUTPUT_DIR.mkdir(exist_ok=True)

    print(f"Loading preferences from {CSV_PATH}...")
    records = load_preferences(CSV_PATH)
    print(f"Loaded {len(records)} valid preference pairs (ties excluded)")

    # Summary stats
    categories = {}
    for r in records:
        cat = r["prompt_category"] or "unknown"
        categories[cat] = categories.get(cat, 0) + 1
    print(f"Categories: {json.dumps(categories, indent=2)}")

    # Train/eval split (90/10)
    split_idx = int(len(records) * 0.9)
    train_records, eval_records = records[:split_idx], records[split_idx:]

    # Reward model datasets
    reward_train = build_reward_dataset(train_records)
    reward_eval = build_reward_dataset(eval_records)
    reward_train.save_to_disk(str(OUTPUT_DIR / "reward_train"))
    reward_eval.save_to_disk(str(OUTPUT_DIR / "reward_eval"))
    print(f"Reward dataset: {len(reward_train)} train, {len(reward_eval)} eval")

    # PPO dataset (all unique prompts)
    ppo_ds = build_ppo_dataset(records)
    ppo_ds.save_to_disk(str(OUTPUT_DIR / "ppo_prompts"))
    print(f"PPO prompts: {len(ppo_ds)} unique prompts")

    # Save metadata
    meta = {
        "total_records": len(records),
        "train_records": len(train_records),
        "eval_records": len(eval_records),
        "unique_prompts": len(ppo_ds),
        "categories": categories,
    }
    (OUTPUT_DIR / "metadata.json").write_text(json.dumps(meta, indent=2))
    print("Data preparation complete.")


if __name__ == "__main__":
    main()
