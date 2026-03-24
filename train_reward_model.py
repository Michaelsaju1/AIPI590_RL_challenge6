"""Train a reward model on preference data using TRL's RewardTrainer."""

import json
from pathlib import Path
from datasets import load_from_disk
from transformers import AutoModelForSequenceClassification, AutoTokenizer
from trl import RewardTrainer, RewardConfig

MODEL_NAME = "distilgpt2"
OUTPUT_DIR = Path("reward_model")
DATA_DIR = Path("data")
METRICS_PATH = Path("metrics") / "reward_metrics.json"


def main():
    METRICS_PATH.parent.mkdir(exist_ok=True)

    # Load data
    train_ds = load_from_disk(str(DATA_DIR / "reward_train"))
    eval_ds = load_from_disk(str(DATA_DIR / "reward_eval"))
    print(f"Train: {len(train_ds)}, Eval: {len(eval_ds)}")

    # Load tokenizer — GPT-2 has no pad token by default
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    tokenizer.pad_token = tokenizer.eos_token

    # Load model with single scalar output head
    model = AutoModelForSequenceClassification.from_pretrained(
        MODEL_NAME,
        num_labels=1,
    )
    model.config.pad_token_id = tokenizer.pad_token_id

    # Training config
    config = RewardConfig(
        output_dir=str(OUTPUT_DIR),
        num_train_epochs=10,
        per_device_train_batch_size=4,
        per_device_eval_batch_size=4,
        gradient_accumulation_steps=2,
        learning_rate=1e-4,
        weight_decay=0.01,
        warmup_ratio=0.1,
        max_length=512,
        eval_strategy="steps",
        eval_steps=20,
        save_strategy="steps",
        save_steps=20,
        logging_steps=5,
        fp16=True,
        remove_unused_columns=False,
        report_to="none",
        save_total_limit=2,
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
    )

    trainer = RewardTrainer(
        model=model,
        args=config,
        train_dataset=train_ds,
        eval_dataset=eval_ds,
        processing_class=tokenizer,
    )

    print("Training reward model...")
    train_result = trainer.train()

    # Save model
    trainer.save_model(str(OUTPUT_DIR / "final"))
    tokenizer.save_pretrained(str(OUTPUT_DIR / "final"))

    # Evaluate
    eval_result = trainer.evaluate()
    print(f"Eval results: {eval_result}")

    # Save metrics
    metrics = {
        "train": {k: v for k, v in train_result.metrics.items()},
        "eval": eval_result,
        "train_log_history": [
            {k: v for k, v in entry.items()} for entry in trainer.state.log_history
        ],
    }
    METRICS_PATH.write_text(json.dumps(metrics, indent=2, default=str))
    print(f"Reward model saved to {OUTPUT_DIR / 'final'}")
    print(f"Metrics saved to {METRICS_PATH}")


if __name__ == "__main__":
    main()
