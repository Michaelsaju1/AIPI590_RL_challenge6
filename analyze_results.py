"""Generate analysis plots and metrics for the RLHF pipeline."""

import json
from pathlib import Path
import matplotlib.pyplot as plt
import numpy as np
from transformers import AutoModelForCausalLM, AutoModelForSequenceClassification, AutoTokenizer
from datasets import load_from_disk
import torch

METRICS_DIR = Path("metrics")
PLOTS_DIR = Path("plots")
REWARD_MODEL_PATH = Path("reward_model") / "final"
PPO_MODEL_PATH = Path("ppo_model") / "final"
BASE_MODEL = "distilgpt2"


def plot_reward_training():
    """Plot reward model training metrics."""
    data = json.loads((METRICS_DIR / "reward_metrics.json").read_text())
    logs = data["train_log_history"]

    train_logs = [l for l in logs if "loss" in l and "eval_loss" not in l]
    eval_logs = [l for l in logs if "eval_loss" in l]

    fig, axes = plt.subplots(1, 3, figsize=(15, 4))

    # Training loss
    if train_logs:
        steps = [l["step"] for l in train_logs]
        losses = [l["loss"] for l in train_logs]
        axes[0].plot(steps, losses, "b-", alpha=0.7)
        axes[0].set_xlabel("Step")
        axes[0].set_ylabel("Loss")
        axes[0].set_title("Reward Model Training Loss")
        axes[0].grid(True, alpha=0.3)

    # Eval loss
    if eval_logs:
        steps = [l["step"] for l in eval_logs]
        eval_losses = [l["eval_loss"] for l in eval_logs]
        axes[1].plot(steps, eval_losses, "r-o", markersize=3)
        axes[1].set_xlabel("Step")
        axes[1].set_ylabel("Eval Loss")
        axes[1].set_title("Reward Model Eval Loss")
        axes[1].grid(True, alpha=0.3)

    # Eval accuracy
    if eval_logs and "eval_accuracy" in eval_logs[0]:
        steps = [l["step"] for l in eval_logs]
        accs = [l["eval_accuracy"] for l in eval_logs]
        axes[2].plot(steps, accs, "g-o", markersize=3)
        axes[2].set_xlabel("Step")
        axes[2].set_ylabel("Accuracy")
        axes[2].set_title("Reward Model Pairwise Accuracy")
        axes[2].axhline(y=0.5, color="gray", linestyle="--", alpha=0.5, label="Random")
        axes[2].legend()
        axes[2].grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig(str(PLOTS_DIR / "reward_model_training.png"), dpi=150, bbox_inches="tight")
    plt.close()
    print("Saved reward_model_training.png")


def plot_ppo_training():
    """Plot PPO training metrics."""
    data = json.loads((METRICS_DIR / "ppo_metrics.json").read_text())
    logs = data["log_history"]

    # Extract available metrics from logs
    steps, rewards, kls, entropies, lengths, clip_fracs, vf_losses = [], [], [], [], [], [], []
    for l in logs:
        if "objective/rlhf_reward" in l:
            steps.append(l.get("step", len(steps)))
            rewards.append(l["objective/rlhf_reward"])
        if "objective/kl" in l:
            kls.append(l["objective/kl"])
        if "objective/entropy" in l:
            entropies.append(l["objective/entropy"])
        if "ppo/policy/approxkl" in l:
            clip_fracs.append(l.get("ppo/policy/clipfrac", 0))
        if "val/response_length" in l or "objective/scores" in l:
            lengths.append(l.get("val/response_length", l.get("objective/scores", 0)))

    n_plots = sum(1 for x in [rewards, kls, entropies] if x)
    if n_plots == 0:
        # Try alternative metric names
        for l in logs:
            step = l.get("step", len(steps))
            for k, v in l.items():
                if "reward" in k.lower() and isinstance(v, (int, float)):
                    rewards.append(v)
                    if step not in steps:
                        steps.append(step)
                    break
            for k, v in l.items():
                if "kl" in k.lower() and isinstance(v, (int, float)):
                    kls.append(v)
                    break
            for k, v in l.items():
                if "entropy" in k.lower() and isinstance(v, (int, float)):
                    entropies.append(v)
                    break

    fig, axes = plt.subplots(2, 3, figsize=(18, 10))

    # Reward over time
    if rewards:
        axes[0, 0].plot(rewards, "b-", alpha=0.7)
        axes[0, 0].set_xlabel("Step")
        axes[0, 0].set_ylabel("Reward")
        axes[0, 0].set_title("Mean Reward Over Training")
        axes[0, 0].grid(True, alpha=0.3)

    # KL divergence
    if kls:
        axes[0, 1].plot(kls, "r-", alpha=0.7)
        axes[0, 1].set_xlabel("Step")
        axes[0, 1].set_ylabel("KL Divergence")
        axes[0, 1].set_title("KL Divergence from Reference")
        axes[0, 1].grid(True, alpha=0.3)

    # Entropy
    if entropies:
        axes[0, 2].plot(entropies, "g-", alpha=0.7)
        axes[0, 2].set_xlabel("Step")
        axes[0, 2].set_ylabel("Entropy")
        axes[0, 2].set_title("Policy Entropy (Mode Collapse Detector)")
        axes[0, 2].grid(True, alpha=0.3)

    # Reward vs KL (Goodhart frontier)
    if rewards and kls and len(rewards) == len(kls):
        scatter = axes[1, 0].scatter(kls, rewards, c=range(len(kls)), cmap="viridis", s=20, alpha=0.7)
        axes[1, 0].set_xlabel("KL Divergence")
        axes[1, 0].set_ylabel("Reward")
        axes[1, 0].set_title("Reward vs KL (Goodhart Frontier)")
        plt.colorbar(scatter, ax=axes[1, 0], label="Training Step")
        axes[1, 0].grid(True, alpha=0.3)

    # Reward distribution over training phases
    if rewards:
        n = len(rewards)
        third = n // 3
        early = rewards[:third] if third > 0 else rewards
        mid = rewards[third:2*third] if third > 0 else []
        late = rewards[2*third:] if third > 0 else []
        parts = [p for p in [early, mid, late] if p]
        labels = ["Early", "Mid", "Late"][:len(parts)]
        axes[1, 1].boxplot(parts, labels=labels)
        axes[1, 1].set_ylabel("Reward")
        axes[1, 1].set_title("Reward Distribution by Phase")
        axes[1, 1].grid(True, alpha=0.3)

    # All logged scalar metrics summary
    all_keys = set()
    for l in logs:
        all_keys.update(k for k, v in l.items() if isinstance(v, (int, float)))
    summary_text = "Logged metrics:\n" + "\n".join(sorted(all_keys))
    axes[1, 2].text(0.05, 0.95, summary_text, transform=axes[1, 2].transAxes,
                     fontsize=7, verticalalignment="top", fontfamily="monospace")
    axes[1, 2].set_title("Available Metrics")
    axes[1, 2].axis("off")

    plt.tight_layout()
    plt.savefig(str(PLOTS_DIR / "ppo_training.png"), dpi=150, bbox_inches="tight")
    plt.close()
    print("Saved ppo_training.png")


def generate_comparisons():
    """Generate side-by-side responses from base and PPO-trained models."""
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
    tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "left"

    base_model = AutoModelForCausalLM.from_pretrained(BASE_MODEL).to(device)
    ppo_model = AutoModelForCausalLM.from_pretrained(str(PPO_MODEL_PATH)).to(device)

    # Load reward model for scoring
    reward_model = AutoModelForSequenceClassification.from_pretrained(
        str(REWARD_MODEL_PATH), num_labels=1
    ).to(device)
    reward_model.eval()

    # Sample prompts from PPO dataset
    ppo_ds = load_from_disk(str(Path("data") / "ppo_prompts"))
    sample_prompts = [ppo_ds[i]["query"] for i in range(min(10, len(ppo_ds)))]

    comparisons = []
    for prompt in sample_prompts:
        inputs = tokenizer(prompt, return_tensors="pt", truncation=True, max_length=256).to(device)

        with torch.no_grad():
            base_out = base_model.generate(
                **inputs, max_new_tokens=128, temperature=0.7, do_sample=True,
                pad_token_id=tokenizer.eos_token_id
            )
            ppo_out = ppo_model.generate(
                **inputs, max_new_tokens=128, temperature=0.7, do_sample=True,
                pad_token_id=tokenizer.eos_token_id
            )

        base_text = tokenizer.decode(base_out[0], skip_special_tokens=True)
        ppo_text = tokenizer.decode(ppo_out[0], skip_special_tokens=True)

        # Score both with reward model
        with torch.no_grad():
            base_tokens = tokenizer(base_text, return_tensors="pt", truncation=True, max_length=512, padding=True).to(device)
            ppo_tokens = tokenizer(ppo_text, return_tensors="pt", truncation=True, max_length=512, padding=True).to(device)
            base_score = reward_model(**base_tokens).logits.item()
            ppo_score = reward_model(**ppo_tokens).logits.item()

        comparisons.append({
            "prompt": prompt[:200],
            "base_response": base_text[len(prompt):].strip()[:500],
            "ppo_response": ppo_text[len(prompt):].strip()[:500],
            "base_reward": round(base_score, 4),
            "ppo_reward": round(ppo_score, 4),
        })

    (METRICS_DIR / "comparisons.json").write_text(json.dumps(comparisons, indent=2))

    # Plot reward comparison
    base_rewards = [c["base_reward"] for c in comparisons]
    ppo_rewards = [c["ppo_reward"] for c in comparisons]
    x = range(len(comparisons))

    fig, ax = plt.subplots(figsize=(10, 5))
    ax.bar([i - 0.2 for i in x], base_rewards, 0.4, label="Base DistilGPT-2", color="steelblue")
    ax.bar([i + 0.2 for i in x], ppo_rewards, 0.4, label="PPO-Aligned", color="coral")
    ax.set_xlabel("Prompt")
    ax.set_ylabel("Reward Score")
    ax.set_title("Reward Model Scores: Base vs PPO-Aligned")
    ax.legend()
    ax.grid(True, alpha=0.3, axis="y")
    plt.tight_layout()
    plt.savefig(str(PLOTS_DIR / "base_vs_ppo_rewards.png"), dpi=150, bbox_inches="tight")
    plt.close()
    print("Saved base_vs_ppo_rewards.png")

    # Print a few comparisons
    for i, c in enumerate(comparisons[:3]):
        print(f"\n{'='*60}")
        print(f"PROMPT: {c['prompt'][:100]}...")
        print(f"\nBASE (reward={c['base_reward']}):")
        print(c["base_response"][:200])
        print(f"\nPPO (reward={c['ppo_reward']}):")
        print(c["ppo_response"][:200])

    return comparisons


def compute_ngram_diversity(texts: list[str], n: int = 3) -> float:
    """Compute unique n-gram ratio as a diversity metric."""
    all_ngrams, unique_ngrams = 0, set()
    for text in texts:
        tokens = text.split()
        for i in range(len(tokens) - n + 1):
            ng = tuple(tokens[i:i+n])
            unique_ngrams.add(ng)
            all_ngrams += 1
    return len(unique_ngrams) / max(all_ngrams, 1)


def overoptimization_analysis():
    """Analyze signs of reward hacking / overoptimization."""
    ppo_data = json.loads((METRICS_DIR / "ppo_metrics.json").read_text())
    logs = ppo_data["log_history"]

    analysis = {"signs_of_overoptimization": []}

    # Check reward trend
    rewards = [l.get("objective/rlhf_reward", l.get("objective/scores"))
               for l in logs if "objective/rlhf_reward" in l or "objective/scores" in l]
    if rewards:
        n = len(rewards)
        if n > 10:
            late_mean = np.mean(rewards[-n//4:])
            mid_mean = np.mean(rewards[n//4:n//2])
            if late_mean < mid_mean:
                analysis["signs_of_overoptimization"].append(
                    "Reward decreased in late training — possible overoptimization"
                )

    # Check KL divergence trend
    kls = [l["objective/kl"] for l in logs if "objective/kl" in l]
    if kls and kls[-1] > 10:
        analysis["signs_of_overoptimization"].append(
            f"High final KL divergence ({kls[-1]:.2f}) — policy drifted far from reference"
        )

    # Check entropy collapse
    entropies = [l["objective/entropy"] for l in logs if "objective/entropy" in l]
    if entropies and len(entropies) > 5:
        if entropies[-1] < entropies[0] * 0.5:
            analysis["signs_of_overoptimization"].append(
                "Entropy dropped >50% — possible mode collapse"
            )

    # Check response diversity from comparisons
    if (METRICS_DIR / "comparisons.json").exists():
        comps = json.loads((METRICS_DIR / "comparisons.json").read_text())
        ppo_texts = [c["ppo_response"] for c in comps]
        base_texts = [c["base_response"] for c in comps]

        ppo_diversity = compute_ngram_diversity(ppo_texts)
        base_diversity = compute_ngram_diversity(base_texts)
        analysis["ngram_diversity"] = {
            "base": round(base_diversity, 4),
            "ppo": round(ppo_diversity, 4),
        }
        if ppo_diversity < base_diversity * 0.7:
            analysis["signs_of_overoptimization"].append(
                f"PPO n-gram diversity ({ppo_diversity:.3f}) much lower than base ({base_diversity:.3f})"
            )

        # Response length analysis
        ppo_lens = [len(t.split()) for t in ppo_texts]
        base_lens = [len(t.split()) for t in base_texts]
        analysis["response_lengths"] = {
            "base_mean": round(np.mean(base_lens), 1),
            "ppo_mean": round(np.mean(ppo_lens), 1),
        }
        if np.mean(ppo_lens) > np.mean(base_lens) * 1.5:
            analysis["signs_of_overoptimization"].append(
                "PPO responses significantly longer — possible length gaming"
            )

    if not analysis["signs_of_overoptimization"]:
        analysis["signs_of_overoptimization"].append(
            "No strong overoptimization detected (may need more training steps to observe)"
        )

    analysis["summary"] = (
        f"Found {len(analysis['signs_of_overoptimization'])} potential indicators. "
        "Overoptimization is expected with extended PPO training as the policy "
        "learns to exploit reward model blind spots rather than genuinely improve."
    )

    (METRICS_DIR / "overoptimization_analysis.json").write_text(json.dumps(analysis, indent=2))
    print(f"\nOveroptimization Analysis:")
    for sign in analysis["signs_of_overoptimization"]:
        print(f"  - {sign}")
    return analysis


def main():
    PLOTS_DIR.mkdir(exist_ok=True)
    METRICS_DIR.mkdir(exist_ok=True)

    print("=" * 60)
    print("REWARD MODEL ANALYSIS")
    print("=" * 60)
    if (METRICS_DIR / "reward_metrics.json").exists():
        plot_reward_training()
    else:
        print("No reward metrics found — skipping")

    print("\n" + "=" * 60)
    print("PPO TRAINING ANALYSIS")
    print("=" * 60)
    if (METRICS_DIR / "ppo_metrics.json").exists():
        plot_ppo_training()
    else:
        print("No PPO metrics found — skipping")

    print("\n" + "=" * 60)
    print("RESPONSE COMPARISONS")
    print("=" * 60)
    if Path(PPO_MODEL_PATH).exists():
        generate_comparisons()
    else:
        print("No PPO model found — skipping")

    print("\n" + "=" * 60)
    print("OVEROPTIMIZATION ANALYSIS")
    print("=" * 60)
    overoptimization_analysis()

    print("\n\nAll analysis complete. Check plots/ and metrics/ directories.")


if __name__ == "__main__":
    main()
