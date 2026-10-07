# Evaluation

Focus: measured results from this project, including weak ones, plus a short reading of what they mean. No invented D2 scores.

## What was measured

1. **Retrieval quality** against fixture policies (`fixtures/motor-policy-en.pdf`, `fixtures/motor-policy-ar.pdf`) using the cases in [`fixtures/rag-eval.json`](../fixtures/rag-eval.json).
2. **Refusal** on an unrelated query.
3. **Deterministic payout** unit tests in [`src/domain/payout-calculator.spec.ts`](../src/domain/payout-calculator.spec.ts).
4. **Automated suite size** from `npm test` (Vitest).

Live retrieve results below were recorded against indexed fixture policies after multilingual MiniLM embeddings (`Xenova/paraphrase-multilingual-MiniLM-L12-v2`, 384-d) were present.

## Automated suite

| Metric | Value |
|---|---|
| Test files | 25 passed |
| Tests | 84 passed |
| When | recorded while writing this doc |

This counts unit and integration specs that run when `ONLINE_DATABASE_URL` is set. It is not a graded accuracy percentage for the LLM.

## Retrieval results (live)

| Id | Query | Direction | Expected | Observed (live) | Result |
|---|---|---|---|---|---|
| en-en | `collision deductible` | EN → EN | `Deductible 500 on 2026-01-01` | Rank 1 English collision deductible line, section “Section 1 Collision Coverage”, dense, cited | Pass |
| ar-ar | `تغطية التصادم` | AR → AR | Arabic collision coverage text | Rank 1 hybrid hit on Arabic fixture | Pass |
| en-ar | `collision coverage` | EN → AR | Arabic coverage line | Rank 1 Arabic line (dense) | Pass |
| ar-en | `هل أضرار التصادم مغطاة` | AR → EN | English deductible / coverage line in top results | English fixture **not** in top 5; Arabic fixture ranked first | Fail / weak |
| refusal | `quantum banana orbit` | none | Refusal | `hasSufficientEvidence: false`, message “Not enough information in the corpus.” | Pass |

### Extract noise (honest)

Arabic PDF extraction can reverse digit runs (RTL). Live Arabic fixture content included forms such as `005` instead of `500` and reversed date digits. Keyword and display quality suffer; dense retrieval still sometimes hits. Evaluation should treat digit-reversed text as a known extract defect, not as correct policy language.

## Payout calculator (code)

Rule:

```text
covered = min(claimedAmount, coverageLimit)
payout  = max(covered - deductible, 0)
```

| Claimed | Limit | Deductible | Payout | Result |
|---|---|---|---|---|
| 80000 | 60000 | 10000 | 50000 | Pass |
| 90000 | 60000 | 0 | 60000 | Pass |
| 1000 | 5000 | 2000 | 0 | Pass |
| 100 | 100 | 100 | 0 | Pass |

These tests do not call the LLM.

## Interpretation

**What works**

- Same-language English and Arabic retrieval on the motor fixtures.
- English query → Arabic chunk (cross-lingual in one direction).
- Hard refusal on nonsense queries.
- Money math is stable and independent of the model.

**What fails or is weak**

- Arabic query → English chunk did not place the English evidence in the top 5 in the recorded live run. Cross-lingual is not symmetric with the current model + chunk text.
- PDF RTL digit reversal pollutes Arabic evidence and makes “exact amount in text” checks harder (the analysis layer allows digit-reversed matches for that reason).

**Why**

- Retrieval depends on chunk text quality and the multilingual embedding model. Keyword FTS is language-agnostic `simple` config and AND-style matching, so sparse Arabic↔English lexical overlap does not rescue a weak dense hit.
- The product chooses grounded refusal / human `REVIEW` over guessing when evidence is thin.

## Not measured yet

| Area | Status |
|---|---|
| End-to-end live LLM claim-analysis accuracy (coverage/exclusion F1 on a labeled claim set) | **Not recorded** in this repo |
| Human approval UX timing / error rates on the dashboard | Out of backend scope; front approvals were mock |
| Latency / cost per analyze call | **Not recorded** |
| Production load or RAG recall@K on a large corpus | **Not recorded** |

If those numbers are needed for grading, run a labeled claim set through `POST /claims/:id/analyze` with fixed policies and log pass/fail per field; do not backfill fake percentages.
