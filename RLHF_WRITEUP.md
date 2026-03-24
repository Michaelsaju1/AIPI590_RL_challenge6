# RLHF Pipeline: Aligning DistilGPT-2 with Human Preferences

## Overview

This project implements a full Reinforcement Learning from Human Feedback (RLHF) pipeline to align a language model with human preferences. The pipeline follows the three-stage process introduced by InstructGPT (Ouyang et al., 2022):

1. **Data Preparation** -- Parse human preference data into training formats
2. **Reward Model Training** -- Learn a scalar reward function from pairwise preferences
3. **PPO Fine-Tuning** -- Optimize the language model against the learned reward using Proximal Policy Optimization
4. **Analysis** -- Evaluate alignment, compare outputs, and check for overoptimization

The base model is **DistilGPT-2** (82M parameters), a distilled version of GPT-2 that is smaller and faster to train while retaining most of GPT-2's language modeling capability.

## Pipeline

### Step 1: Data Preparation (`prepare_data.py`)

The pipeline starts with a CSV of human preference annotations. Each row contains a prompt, two model responses (chosen and rejected), and metadata like category and which models generated the responses.

**Processing steps:**
- Ties are excluded since they provide ambiguous training signal
- Records missing a prompt, chosen, or rejected response are dropped
- Text is formatted as `### Prompt:\n{prompt}\n\n### Response:\n{response}` for consistency

**Outputs:**
- `data/reward_train/` -- 108 preference pairs for reward model training (90% split)
- `data/reward_eval/` -- 13 preference pairs for evaluation (10% split)
- `data/ppo_prompts/` -- 50 unique prompts for PPO training

The dataset spans 9 categories: advice, science, creative, ethics, tech, history, persuasion, howto, and math.

### Step 2: Reward Model Training (`train_reward_model.py`)

The reward model learns to assign higher scalar scores to human-preferred responses. It takes DistilGPT-2 and adds a single-output classification head (`num_labels=1`) that produces a reward score for any given text.

**Architecture:** `DistilGPT-2 + Linear(768, 1)` using `AutoModelForSequenceClassification`

**Training setup:**
- 10 epochs, batch size 4, gradient accumulation 2 (effective batch size 8)
- Learning rate: 1e-4 with 10% warmup and cosine decay
- Max sequence length: 512 tokens
- FP16 mixed precision
- Best checkpoint selected by eval loss

**How it works:** TRL's `RewardTrainer` processes preference pairs using the Bradley-Terry model. For each pair, it passes both the chosen and rejected text through the model, gets scalar rewards, and minimizes the negative log-likelihood that the chosen response scores higher:

$$\mathcal{L} = -\log\sigma(r_\theta(\text{chosen}) - r_\theta(\text{rejected}))$$

**Results:**
- Training loss dropped from 0.70 to 0.0001 (the model learned to separate chosen from rejected)
- Training accuracy reached 100% by epoch 3
- Best eval loss: 1.19 (loaded at end of training)
- The gap between eval accuracy (~42%) and train accuracy (100%) indicates overfitting, which is expected with only 13 eval samples

### Step 3: PPO Fine-Tuning (`train_ppo.py`)

PPO uses the trained reward model as a scoring function to fine-tune DistilGPT-2's generation behavior. The goal is to make the model produce responses that score higher under the reward model while staying close to the original model (to avoid reward hacking).

**Four models are loaded:**

| Model | Role | Trainable? |
|-------|------|------------|
| Policy | The model being optimized | Yes |
| Reference | Frozen copy of base DistilGPT-2 | No |
| Value | Critic that estimates expected future reward | Yes |
| Reward | Trained in Step 2, scores responses | No |

**Training loop (per episode):**
1. Sample a prompt from the dataset
2. The policy model generates a response (up to 128 tokens, temperature 0.7)
3. The reward model scores the full prompt+response
4. A KL penalty is subtracted: `reward_final = reward - kl_coef * KL(policy || reference)`
5. PPO updates the policy to increase the probability of high-reward responses while clipping large policy changes

**Key hyperparameters:**
- 512 total episodes, 4 PPO epochs per batch
- Learning rate: 3e-6 (much lower than reward model -- policy updates must be conservative)
- KL coefficient: 0.05 (controls how much the policy can drift from the reference)
- Clip range: 0.2 (standard PPO clipping to prevent destructive updates)
- Value function coefficient: 0.1

**Results:**
- RLHF reward fluctuated but generally improved over training
- KL divergence stayed in the 3-5 range (moderate drift from reference)
- The policy learned to produce responses that score higher under the reward model

### Step 4: Analysis (`analyze_results.py`)

The analysis script generates visualizations and quantitative comparisons.

**Plots generated:**
- `plots/reward_model_training.png` -- Training loss, eval loss, and pairwise accuracy curves
- `plots/ppo_training.png` -- Reward, KL divergence, entropy, Goodhart frontier, and reward distribution over training phases
- `plots/base_vs_ppo_rewards.png` -- Side-by-side reward scores for base vs. PPO model on sample prompts

**Response comparisons:**

The script generates responses from both the base DistilGPT-2 and the PPO-aligned model on 10 prompts, then scores both with the reward model. On most prompts, the PPO model achieves higher reward scores than the base model (e.g., -0.25 vs -1.13 on the business advice prompt; 0.35 vs -1.39 on the CRISPR question).

**Overoptimization analysis:**

The analysis checks for signs of reward hacking:
- **N-gram diversity:** PPO responses have lower diversity (0.50) compared to base (0.73), indicating some mode collapse where the model repeats phrases
- **Response length:** PPO responses are slightly shorter on average (53.3 words vs 66.9 words) -- no evidence of length gaming
- **KL divergence:** Final KL stayed under 10, suggesting the policy didn't drift too far
- **Entropy:** No catastrophic entropy collapse detected

These are expected behaviors for a small model with limited training data. The reward model has only 121 preference pairs to learn from, so it has blind spots that PPO can exploit.

## Limitations

- **Small dataset:** 121 preference pairs is far below what production RLHF systems use (thousands to hundreds of thousands). The reward model overfits as a result.
- **Small model:** DistilGPT-2 (82M params) has limited language ability to begin with. Neither the base nor aligned model produces high-quality responses -- the alignment signal is relative, not absolute.
- **Repetition:** The PPO model sometimes falls into repetitive loops (repeating the same phrase), a common failure mode when the reward model doesn't penalize repetition.
- **Reward hacking:** The PPO model learns surface patterns that score well rather than genuinely better responses. This is visible in the reduced n-gram diversity.

## How to Run

```bash
# 1. Prepare data from preference CSV
python prepare_data.py

# 2. Train reward model (~1 min on GPU, ~1 min on CPU)
python train_reward_model.py

# 3. Train PPO policy (~5 min on GPU, longer on CPU)
python train_ppo.py

# 4. Generate analysis plots and comparisons
python analyze_results.py
```

## Dependencies

- `transformers` -- Model loading and tokenization
- `trl` -- RewardTrainer and PPOTrainer implementations
- `datasets` -- HuggingFace dataset utilities
- `torch` -- PyTorch backend
- `matplotlib`, `numpy` -- Plotting and numerical analysis

## File Structure

```
prepare_data.py          # Step 1: CSV -> HuggingFace datasets
train_reward_model.py    # Step 2: Train reward model on preferences
train_ppo.py             # Step 3: PPO fine-tuning with reward model
analyze_results.py       # Step 4: Plots, comparisons, overoptimization checks
data/                    # Processed datasets
metrics/                 # Training logs and analysis JSON
plots/                   # Generated visualization PNGs
reward_model/            # Reward model checkpoints (gitignored)
ppo_model/               # PPO policy checkpoints (gitignored)
```
