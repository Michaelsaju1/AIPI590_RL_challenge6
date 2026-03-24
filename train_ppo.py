"""Run PPO alignment loop using TRL's PPOTrainer (experimental)."""

import json
from pathlib import Path
from datasets import load_from_disk
from transformers import AutoModelForCausalLM, AutoModelForSequenceClassification, AutoTokenizer
from trl.experimental.ppo import PPOTrainer, PPOConfig

MODEL_NAME = "distilgpt2"
REWARD_MODEL_PATH = Path("reward_model") / "final"
OUTPUT_DIR = Path("ppo_model")
DATA_DIR = Path("data")
METRICS_PATH = Path("metrics") / "ppo_metrics.json"


def main():
    METRICS_PATH.parent.mkdir(exist_ok=True)
    OUTPUT_DIR.mkdir(exist_ok=True)

    # Load tokenizer
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "left"  # PPO needs left-padding for generation

    # Load PPO prompt dataset and tokenize
    ppo_ds = load_from_disk(str(DATA_DIR / "ppo_prompts"))

    def tokenize(example):
        tokens = tokenizer(
            example["query"],
            truncation=True,
            max_length=256,
            padding=False,
        )
        return {"input_ids": tokens["input_ids"]}

    ppo_ds = ppo_ds.map(tokenize, remove_columns=["query"])
    ppo_ds = ppo_ds.filter(lambda x: len(x["input_ids"]) > 5)
    print(f"PPO dataset: {len(ppo_ds)} prompts")

    # Policy model (the one we'll train)
    policy_model = AutoModelForCausalLM.from_pretrained(MODEL_NAME)

    # Reference model (frozen copy for KL penalty)
    ref_model = AutoModelForCausalLM.from_pretrained(MODEL_NAME)

    # Value model (critic — estimates future reward)
    value_model = AutoModelForSequenceClassification.from_pretrained(
        MODEL_NAME, num_labels=1
    )
    value_model.config.pad_token_id = tokenizer.pad_token_id

    # Reward model (trained in previous step)
    reward_model = AutoModelForSequenceClassification.from_pretrained(
        str(REWARD_MODEL_PATH), num_labels=1
    )
    reward_model.config.pad_token_id = tokenizer.pad_token_id

    # PPO config
    config = PPOConfig(
        output_dir=str(OUTPUT_DIR),
        num_ppo_epochs=4,
        per_device_train_batch_size=4,
        gradient_accumulation_steps=4,
        learning_rate=3e-6,
        kl_coef=0.05,
        cliprange=0.2,
        vf_coef=0.1,
        response_length=128,
        temperature=0.7,
        stop_token="eos",
        num_mini_batches=1,
        local_rollout_forward_batch_size=8,
        total_episodes=512,
        logging_steps=1,
        fp16=True,
        report_to="none",
        num_sample_generations=5,
        save_strategy="steps",
        save_steps=50,
        save_total_limit=2,
    )

    trainer = PPOTrainer(
        args=config,
        processing_class=tokenizer,
        model=policy_model,
        ref_model=ref_model,
        reward_model=reward_model,
        value_model=value_model,
        train_dataset=ppo_ds,
    )

    print("Starting PPO training...")
    trainer.train()

    # Save final policy
    trainer.save_model(str(OUTPUT_DIR / "final"))
    tokenizer.save_pretrained(str(OUTPUT_DIR / "final"))

    # Save training logs
    metrics = {
        "log_history": [
            {k: v for k, v in entry.items()} for entry in trainer.state.log_history
        ],
    }
    METRICS_PATH.write_text(json.dumps(metrics, indent=2, default=str))
    print(f"PPO model saved to {OUTPUT_DIR / 'final'}")
    print(f"Metrics saved to {METRICS_PATH}")


if __name__ == "__main__":
    main()
