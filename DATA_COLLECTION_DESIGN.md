# Data Collection Design Decisions

This document describes every design choice made for the human preference data collection pipeline, the alternatives we considered, and why we chose what we did. The goal is to collect high-quality preference pairs for training a reward model via RLHF.

---

## 1. Response Generation

### Model Choice: Claude Haiku 4.5

**Problem:** We need a model that produces responses varied enough for humans to have real preferences, but affordable enough to generate many pairs.

**Alternatives considered:**
- **Larger models (Opus, Sonnet):** Higher quality responses, but more expensive per pair and slower generation. For preference collection, we need *variation* between responses more than we need peak quality — two perfect responses don't produce useful training signal.
- **Open-source models (Llama, Mistral):** Cheaper to run but require self-hosting infrastructure. Adds operational complexity for a data collection tool.
- **Multiple different models:** Generating A from one model and B from another. This creates preferences between models rather than between response styles, which conflates model quality with response quality.

**Decision:** Single model (Haiku 4.5) with temperature variation. This keeps the comparison fair — same model, same prompt, different sampling parameters. Preferences reflect style and content choices rather than capability differences.

### Temperature Strategy: Low vs. High

**Problem:** Two responses from the same model at the same temperature are often nearly identical, especially for factual prompts. We need meaningful variation.

**Alternatives considered:**
- **Same temperature for both:** Low variation. Many pairs would be near-identical, producing weak or noisy signal.
- **Random independent temperatures:** Could produce two very similar temperatures (e.g., 0.45 vs 0.48), wasting a generation pair.
- **Fixed temperatures (e.g., 0.3 vs 0.9):** Guarantees variation but makes every pair the same comparison, and annotators might learn to pattern-match "the creative one vs. the safe one."

**Decision:** One low temperature randomly chosen from [0.1, 0.2, 0.3] and one high temperature from [0.8, 0.9, 1.0]. This guarantees meaningful variation in every pair while adding enough randomness that annotators can't predict which response has which temperature. The randomized selection within each band prevents every pair from being the exact same comparison.

### Side Assignment Randomization

**Problem:** If the low-temperature response always appears as Response A, then position bias and temperature preference become confounded. A reward model would learn the wrong signal.

**Alternatives considered:**
- **Always put low-temp on A:** Simplest but creates systematic confounding.
- **Alternate deterministically:** Predictable pattern that annotators could learn.

**Decision:** Coin flip (50/50) for which side gets the low temperature. We record `temp_a` and `temp_b` in every database row so we can audit the actual distribution after collection. The temperature randomization audit panel on the preferences page flags if the split deviates beyond 70/30 after 10+ pairs.

### Max Tokens: 512

**Problem:** Need responses long enough to evaluate quality but short enough to read quickly.

**Alternatives considered:**
- **Shorter (256):** Faster to read but may truncate complex responses, especially for technical or creative prompts.
- **Longer (1024+):** More complete responses but annotator fatigue increases. Reading two 1000-word responses carefully is exhausting, and reading time data shows people start skimming.

**Decision:** 512 tokens. Long enough for substantive responses across all 9 categories, short enough that a careful reader can evaluate both responses in under 2 minutes.

---

## 2. Prompt Library

### Curated Prompts vs. Free-Form

**Problem:** We need prompts that reliably produce varied, interesting responses where human preferences are meaningful.

**Alternatives considered:**
- **Free-form user input:** Annotators write their own prompts. Produces natural distribution but inconsistent difficulty, many trivial prompts, and no coverage guarantee across domains.
- **Scraped from existing datasets (ShareGPT, LMSYS):** Realistic distribution but includes many prompts that don't produce interesting variation (simple factual questions, code that has one correct answer).

**Decision:** 51 hand-curated prompts across 9 categories. Each prompt has a `tension` field describing the underlying tradeoff (e.g., "Assertiveness vs. relationship preservation") to ensure the prompt genuinely produces responses where reasonable people would disagree. This makes every preference pair a meaningful data point.

### Categories and Balance

**Problem:** If data collection is biased toward certain categories, the reward model will learn preferences for some domains much better than others.

**Categories (51 prompts):**
| Category | Count | Prompt ID Prefix |
|----------|-------|-----------------|
| Everyday Reasoning & Advice | 6 | `advice` |
| Science & Explanation | 6 | `science` |
| Creative Writing | 6 | `creative` |
| Code & Technical | 7 | `tech` |
| Ethics & Philosophy | 6 | `ethics` |
| History & Geopolitics | 6 | `history` |
| Math & Logic | 5 | `math` |
| Persuasion & Argumentation | 6 | `persuasion` |
| Practical & How-To | 3 | `howto` |

**Decision:** The category distribution panel on the preferences page monitors how many preferences are collected per category and flags imbalanced categories (2x above or 0.5x below the average). This lets the operator know when to direct annotators toward underrepresented categories.

### Prompt Selection: Random Without Replacement

**Problem:** Random selection with replacement would repeat prompts frequently, wasting annotator time on duplicate evaluations.

**Decision:** Within a session, prompts are drawn randomly without replacement. Once all 51 are used, the pool resets. This maximizes coverage. The `usedPromptIds` array tracks which prompts have been seen in the current session.

---

## 3. Bias Detection and Mitigation

### Position Bias (A vs. B)

**Problem:** People tend to prefer whichever response they read first. In a left-to-right layout, Response A is always read first. This is a well-documented bias in human evaluation studies.

**Alternatives considered:**
- **Randomize labels:** Show Response A on the right sometimes. This confuses annotators and makes the UI inconsistent.
- **Sequential presentation:** Show one response at a time. Prevents direct comparison, which is the whole point.
- **Swap A/B labels randomly:** The content position is what matters, not the label.

**Decision:** Keep the stable side-by-side layout (A on left, B on right) for usability, but detect and account for position bias in analysis. The stats panel reports the overall A/B win rate and flags if either side exceeds 70%. Per-user bias detection (via IP tracking) flags individual annotators who pick the same side 75%+ of the time with 5+ responses.

**Why not fix it in the UI:** Any UI change that tries to eliminate position bias (randomizing layout, forcing sequential reading) introduces other problems. Randomized layout is disorienting. Sequential reading prevents comparison. The better approach is to detect the bias, quantify it, and account for it during reward model training or data filtering.

### Tie Handling

**Problem:** When the user selects "tie," we still need to store both responses in chosen/rejected columns for database consistency. If ties always stored A as chosen, this would create phantom signal in the chosen column.

**Decision:** For ties, the chosen/rejected assignment is randomized 50/50 with a coin flip. The `is_tie` flag is set to true. During analysis, ties should be either excluded from reward model training or treated as equal-preference pairs — the chosen/rejected assignment for ties carries no signal.

### Temperature-Position Confounding

**Problem:** If a bug in the randomization causes the low-temperature response to always land on side A, then position bias becomes confounded with temperature preference. A reward model trained on this data would learn "prefer whatever is on the left" or "prefer lower temperature" when really it's learning both simultaneously and you can't separate them.

**Decision:** The temperature randomization audit panel verifies the actual distribution. We store `temp_a` and `temp_b` as separate database columns (not buried in the metadata JSON) so they can be queried directly. If the split exceeds 70/30 after 10+ pairs, the UI shows a warning.

### Response Length Bias

**Problem:** Humans systematically prefer longer responses, regardless of content quality. This is one of the most well-documented biases in LLM evaluation.

**Alternatives considered:**
- **Enforce equal-length responses:** Impractical — truncating responses destroys coherence, and padding adds noise.
- **Only show truncated previews:** Hides the bias but also hides meaningful quality differences.

**Decision:** Store full token counts for both chosen and rejected responses in metadata. During analysis, check whether longer responses are systematically preferred (correlate output_tokens with chosen/rejected status). If the bias is strong, either filter out pairs with large length differences or add length as a control variable in reward model training.

---

## 4. Data Quality Signals

### Reading Time

**Problem:** If an annotator spends 2 seconds looking at two 500-word responses, their preference is noise, not signal.

**Alternatives considered:**
- **Minimum time gate:** Force annotators to wait N seconds before they can click. This is annoying and doesn't guarantee they actually read — they could just wait and then click randomly.
- **Fixed threshold (e.g., 5 seconds):** Arbitrary. A short factual response might legitimately take 5 seconds to evaluate. A long ethics response needs 30+.

**Decision:** Record the actual reading time (from when responses finish loading to when the user clicks a preference) and flag suspect entries using a length-aware threshold. We compute expected reading time as `(total_word_count / 200) * 60` seconds (200 wpm average reading speed) and flag entries where the annotator read faster than 3x that speed (600 wpm). This means short responses have a low threshold and long responses have a high threshold. The flag is advisory — the preferences page shows it for review, but suspect data is not automatically excluded.

### Scroll Engagement

**Problem:** If a response is long enough to require scrolling and the annotator never scrolls, they didn't read the full text. Their preference is based on incomplete information.

**Alternatives considered:**
- **Require scrolling before allowing selection:** Annoying for short responses that don't need scrolling. Also gameable — annotators can scroll to the bottom without reading.
- **Blur/hide the preference buttons until scrolled:** Same problems as above, plus confusing UI.

**Decision:** Track whether each response card was scrolled (via the `onscroll` event on the overflow container) and store it as `scrolled_a`/`scrolled_b` boolean columns. The Scroll Engagement panel on the preferences page shows how many responses had both/neither/one side scrolled, with a warning when annotators didn't scroll either response. Like reading time, this is an advisory signal — it flags potentially low-quality entries without blocking the annotator.

**Note:** Scroll tracking only fires when the response text overflows its 500px max-height container. Short responses that fit without scrolling will show `scrolled=false` even if the annotator read them fully. This means "neither scrolled" is only a concern when responses are long enough to overflow.

### Per-User Tracking (IP Address)

**Problem:** Without identifying individual annotators, you can't detect per-user patterns like always picking A, rushing through responses, or other quality issues.

**Alternatives considered:**
- **User accounts / login:** More reliable identification but adds friction. For a lightweight collection tool, requiring login discourages participation.
- **Browser fingerprinting:** More robust than IP but invasive and complex to implement.
- **No tracking:** Simplest but impossible to detect per-user bias.

**Decision:** Capture IP address server-side by checking the `X-Forwarded-For` header first (for deployments behind a reverse proxy), falling back to SvelteKit's `getClientAddress()`. This is zero-friction for annotators (no login), can't be spoofed from the client (captured on the server), and is sufficient for detecting per-user patterns. The limitation is that multiple people behind the same NAT will share an IP — this is acceptable for a small-scale collection effort.

---

## 5. UI Design Choices

### Side-by-Side Layout

**Problem:** How to present two responses for comparison.

**Alternatives considered:**
- **Sequential (one at a time):** Prevents direct comparison, relies on memory, which is unreliable.
- **Tabbed:** Requires switching back and forth, increases cognitive load.
- **Stacked (A on top, B below):** Creates strong top-bias (even worse than left-bias) and requires scrolling.

**Decision:** Side-by-side grid with equal-width columns. Both responses are visible simultaneously for direct comparison. Max-height of 500px with overflow scroll for long responses.

### Streaming Display

**Problem:** API responses take several seconds to generate. What does the user see while waiting?

**Decision:** Real-time streaming with a blinking cursor. Both responses stream simultaneously via `Promise.all`. This has a side effect: Response A may start showing text slightly before B due to network timing, which could subtly reinforce position bias. However, the alternative (waiting for both to finish, then revealing simultaneously) adds several seconds of dead time per pair, which hurts annotator throughput and experience.

### Pre-Generation

**Problem:** After submitting a preference, the annotator has to wait for the next pair to generate. This dead time is frustrating and reduces throughput.

**Decision:** While the annotator reads the current pair, the next pair is generated in the background. When they submit their preference, the next pair appears instantly. If pre-generation fails, the system falls back to normal generation. This keeps the annotator in a flow state and maximizes the ratio of reading-time to waiting-time.

### Generic Labels ("Response A" / "Response B")

**Problem:** How to label the two responses.

**Alternatives considered:**
- **Descriptive labels ("Low Temperature" / "High Temperature"):** Reveals the experimental manipulation and biases the annotator.
- **Randomized labels (colors, numbers):** Adds confusion without benefit.

**Decision:** Neutral "Response A" and "Response B" labels. The annotator has no information about how the responses were generated. The slight A-bias from the label (A=first=better in some cultural contexts) is a known tradeoff that we detect and account for rather than trying to eliminate.

---

## 6. Data Storage

### Database: SQLite with WAL Mode

**Problem:** Need a persistent store that's easy to deploy, doesn't require a separate server, and handles concurrent reads/writes from the web app.

**Alternatives considered:**
- **PostgreSQL / MySQL:** More robust but requires separate server setup. Overkill for a single-machine collection tool.
- **JSON files:** Simplest but no concurrent write safety, no indexing, slow for large datasets.

**Decision:** SQLite with Write-Ahead Logging (WAL) mode enabled for concurrent read/write performance. Single file (`preferences.db`) that can be copied, backed up, or queried directly with any SQLite client.

### Schema Design

Every preference record stores:

| Column | Type | Purpose |
|--------|------|---------|
| `id` | INTEGER | Auto-incrementing primary key |
| `timestamp` | TEXT | ISO 8601 timestamp of when preference was submitted |
| `prompt` | TEXT | Full prompt text |
| `chosen` | TEXT | The response the annotator preferred (or random for ties) |
| `rejected` | TEXT | The other response |
| `preference` | TEXT | Raw selection: 'A', 'B', or 'tie' |
| `is_tie` | INTEGER | Boolean flag for ties |
| `prompt_category` | TEXT | Category derived from prompt ID (e.g., 'advice', 'tech') |
| `prompt_id` | TEXT | Unique prompt identifier (e.g., 'advice-001') |
| `prompt_tags` | TEXT | JSON array of tags |
| `chosen_metadata` | TEXT | JSON: model, temperature, tokens, latency, response_id, stop_reason |
| `rejected_metadata` | TEXT | JSON: same structure as chosen_metadata |
| `reading_time_s` | REAL | Seconds from responses loaded to preference click |
| `user_ip` | TEXT | Annotator IP address |
| `temp_a` | REAL | Temperature assigned to side A |
| `temp_b` | REAL | Temperature assigned to side B |
| `scrolled_a` | INTEGER | Whether annotator scrolled the Response A container |
| `scrolled_b` | INTEGER | Whether annotator scrolled the Response B container |
| `created_at` | TEXT | Server-side creation timestamp |

**Why `temp_a`/`temp_b` are top-level columns:** Temperature is already stored inside `chosen_metadata`/`rejected_metadata`, but those are JSON blobs that require parsing. Having `temp_a`/`temp_b` as direct columns makes it trivial to audit temperature randomization with a simple SQL query (`SELECT temp_a < temp_b AS low_on_a, COUNT(*) FROM preferences GROUP BY 1`).

**Why `preference` and `is_tie` are both stored:** `preference` records the raw user action ('A', 'B', 'tie'). `is_tie` is a convenience flag so you can filter ties with `WHERE is_tie = 0` without string comparison.

### Export Formats

**Problem:** The SQLite database is convenient for the app but not for analysis pipelines.

**Decision:** Two export formats available via the preferences page:
- **JSON:** Parses all stringified JSON fields (metadata, tags) back into proper objects. Ready for Python/pandas with `pd.read_json()`.
- **CSV:** Flattens metadata into individual columns (e.g., `chosen_temperature`, `rejected_output_tokens`). Opens directly in Excel/Google Sheets. Tags are semicolon-separated. Text fields with commas, quotes, and newlines are properly escaped.

---

## 7. Monitoring and Auditing

The preferences page includes four stats panels that compute in real-time as data is collected:

### Position Bias Panel
- A/B/tie win rates with percentages
- Red warning if either side exceeds 70%
- Per-IP breakdown flagging users with 75%+ one-side preference (minimum 5 responses)

### Reading Quality Panel
- Average reading time across all entries
- Count of suspect entries (reading speed > 600 wpm based on combined word count)

### Scroll Engagement Panel
- Counts of both-scrolled, neither-scrolled, only-A-scrolled, only-B-scrolled
- Warning when annotators submitted preferences without scrolling either response
- Note for older records that predate scroll tracking

### Category Distribution Panel
- Count and percentage for each prompt category
- Flags categories that are 2x above or 0.5x below the average

### Temperature Randomization Audit Panel
- Percentage of pairs where low-temp response was on side A vs. B
- Red warning if split exceeds 70/30 after 10+ pairs
- Detects broken randomization before it corrupts the dataset

---

## 8. Known Limitations and Tradeoffs

1. **Position bias is detected but not eliminated.** Side-by-side layout inherently favors A. We chose usability over bias elimination and rely on detection + post-hoc analysis.

2. **IP-based user tracking is imperfect.** Multiple users behind the same NAT share an IP. Users on different networks appear as different people. For small-scale collection this is acceptable.

3. **No minimum reading time enforcement.** We flag suspect entries but don't prevent them. An annotator can still click instantly. The tradeoff is between annoying legitimate fast readers and collecting noisy data from careless ones.

4. **Single model means limited diversity.** All responses come from Haiku 4.5. The reward model trained on this data will learn preferences within this model's capability range, not preferences between different capability levels.

5. **No inter-annotator agreement tracking.** We don't show the same prompt pair to multiple annotators to measure agreement. This would require significantly more data collection but would provide a ground truth for annotator quality.

6. **Prompt pool is finite (51 prompts).** After collecting many preferences, some prompts will have many more pairs than others. The category distribution panel helps detect this but doesn't prevent it.

7. **Pre-generation can waste API calls.** If an annotator clicks "New Prompt" while a pre-generated pair exists, that pair is discarded. The cost is minimal (two Haiku calls) compared to the UX benefit.
