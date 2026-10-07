# Insurance API

Project docs (demo path, MVP design, evaluation, security):

- [docs/README.md](docs/README.md) — quick start and 5-minute demo
- [docs/SYSTEM-DESIGN.md](docs/SYSTEM-DESIGN.md) — MVP architecture and gap table
- [docs/EVALUATION.md](docs/EVALUATION.md) — retrieval and payout measurements
- [docs/SECURITY.md](docs/SECURITY.md) — controls mapped to threats

Base URL for the dashboard: `http://localhost:3030`.

Start the API with `npm run dev`. CORS allows `CORS_ORIGIN` (typically `http://localhost:5173`) and the `Authorization` header.

Send `Authorization: Bearer <accessToken>` on every claims request. Policies, users, and retrieval stay open.

## Dashboard integration

Call these in order when building the claims screen.

1. `POST /auth/login` with `{ "email", "password" }`. Keep `accessToken`. Refresh it with `POST /auth/refresh` and `{ "refreshToken" }` when it expires.
2. `GET /policies/options` to fill the policy select. Show `name`, `version`, and `language`. Submit the chosen `id` as `policyId`.
3. `GET /claims/types` to fill the accident-type select. Show `label`. Submit `value` as `claimType`.
4. `POST /claims` to save the form. The server sets `claimNumber`, `status` (`SUBMITTED`), and `createdBy`.
5. `GET /claims` for the table, and `GET /claims/:id` for one row.
6. `POST /claims/:id/analyze` when the user asks for analysis. A completed run opens a `PENDING` approval and sets the claim to `UNDER_REVIEW`. Read the saved run with `GET /claims/:id/analysis`.
7. As `admin`, use `GET /approvals` for the queue, then `POST /approvals/:id/approve`, `/reject`, or `/edit-and-approve`.

Seeded accounts use password `password1`: `admin@example.com` and `employee@example.com`.

`admin` can list, read, update, and analyze every claim, and is the only reviewer on approvals. `employee` can create claims and can list, read, update, and analyze only claims they created. Another person's claim returns `403` with `UNAUTHORIZED_CLAIM_ACCESS`. An employee on approvals returns `403` `UNAUTHORIZED_REVIEWER`.

## Auth

`POST /auth/login` returns `accessToken` and `refreshToken`.

`POST /auth/refresh` with `{ "refreshToken" }` returns a new pair.

## Users

`POST /users`, `GET /users`, and `GET /users/:id` stay open. Responses never include `password`. `role` is `admin` or `employee`.

## Policies

`POST /policies` is multipart. Field `document` is a PDF or DOCX. `name`, `version`, and `language` are unique together. `type` is `HEALTH`, `MOTOR`, or `PROPERTY`. `language` is `ar` or `en`.

`GET /policies` and `GET /policies/:id` return the full row. After upload, `status` is `UPLOADED`, then `PROCESSING`, then `INDEXED` or `FAILED`. Poll `GET /policies/:id` until indexing finishes.

### `GET /policies/options`

Use this for the claim form policy select. It does not require a token.

```json
[
  {
    "id": "7c6fa68b-dbd8-439b-a3b3-ebfce7ce9e86",
    "name": "1_motor_policy",
    "version": "1.0",
    "language": "ar",
    "type": "MOTOR"
  }
]
```

`language` is `ar` or `en`. `type` is `HEALTH`, `MOTOR`, or `PROPERTY`. The create-claim body needs `id` as `policyId`. Rows that share a name and language are versions of one policy. Analysis later picks the version whose dates cover the incident.

`DELETE /policies/:id` removes the policy. If claims still point at it, the response is `409` with `POLICY_HAS_CLAIMS`.

## Retrieval

`POST /rag/retrieve` searches indexed chunks and returns ranked hits plus citations, or a refusal when the evidence is weak. It does not generate an answer. This route stays open.

## Claims

Claims require `Authorization: Bearer <accessToken>` from `POST /auth/login`. Users, policies, and retrieval stay open.

A new claim is saved as `SUBMITTED`. There is no draft step. The server sets `claimNumber` (`CLM-000001`) and `createdBy`. The body cannot include `status`, `createdBy`, or `claimNumber`.

`claimedAmount` is an exact decimal and comes back as a string such as `"80000.00"`. `incidentDate` is `YYYY-MM-DD` and cannot be after today. Create stores the selected policy id and the incident date. Analysis chooses the dated version when `POST /claims/:id/analyze` runs.

### `GET /claims/types`

Use this for the accident-type select. It requires the access token.

```json
[
  { "value": "COLLISION", "label": "Collision" },
  { "value": "THEFT", "label": "Theft" },
  { "value": "FIRE", "label": "Fire" },
  { "value": "OTHER", "label": "Other" }
]
```

Send `value` as `claimType` on create and update. Any other string is rejected.

### `POST /claims`

```json
{
  "policyId": "<policy uuid>",
  "incidentDate": "2026-01-02",
  "claimType": "COLLISION",
  "claimedAmount": 80000,
  "description": "The insured vehicle was involved in a collision."
}
```

`claimType` is `COLLISION`, `THEFT`, `FIRE`, or `OTHER`. A missing policy is `404` `POLICY_NOT_FOUND`. A date after today is `400` `INVALID_INCIDENT_DATE`.

### `GET /claims`

Query: `page` (default 1), `limit` (default 20, max 100), and optional `search`, `status`, `claimType`, `policyId`, `dateFrom`, `dateTo`, and `createdBy`. An employee list is always limited to that employee's own claims.

```json
{
  "items": [],
  "page": 1,
  "limit": 20,
  "total": 0
}
```

Each item includes the claim, a policy summary (`id`, `name`, `version`, `type`, `language`, `effectiveFrom`, `effectiveTo`), and `createdBy` (`id`, `name`, `email`, `role`).

### `GET /claims/:id`

One claim in that same shape. `404` `CLAIM_NOT_FOUND` when the id is missing.

### `PATCH /claims/:id`

Send any of `claimType`, `claimedAmount`, `description`, and `incidentDate`. At least one is required. `policyId`, `status`, and `claimNumber` stay unchanged.

### `POST /claims/:id/analyze`

Loads the claim, chooses the policy row with the same name and language whose `effectiveFrom` / `effectiveTo` window contains `incidentDate`, and retrieves evidence with the existing retrieval service. The model returns coverage, exclusions, and anomalies. Limit and deductible are accepted only when those numbers appear in a cited chunk. Payout is calculated in the API:

- covered amount is the smaller of the claimed amount and the coverage limit
- payout is the covered amount minus the deductible, and never below 0
- no coverage, or an applicable exclusion, sets payout to `0.00` and recommendation `REJECT`
- an anomaly keeps that payout and sets recommendation `REVIEW`

Money is a decimal string such as `"50000.00"`. The response includes the claim, the chosen policy version, coverage, exclusions, anomalies, financials, recommendation, and citations. A run with no usable evidence returns `200` with status `INSUFFICIENT_EVIDENCE`. No matching version, or more than one match, is `409` `NO_APPLICABLE_POLICY_VERSION`.

Set `AI_BASE_URL` (for example `https://api.openai.com/v1`), `AI_API_KEY`, and `AI_MODEL`. The adapter calls `POST {AI_BASE_URL}/chat/completions`.

### `GET /claims/:id/analysis`

Returns the latest saved analysis for that claim, or `404` `ANALYSIS_NOT_FOUND`.

When analysis finishes, the API also creates a `PENDING` approval and sets the claim to `UNDER_REVIEW`. That includes `COMPLETED`, `INSUFFICIENT_EVIDENCE`, and `FAILED` runs. Incomplete runs store recommendation `REVIEW` with reasoning `No evidence to support a decision.` and payout `0.00`.

## Approvals

All approvals routes require `Authorization: Bearer <accessToken>` and the `admin` role.

A completed analysis stores an AI recommendation snapshot on the approval. Human actions never overwrite that snapshot. Final decision and final payout are stored separately and audited.

Claim status after review:

- Approve → claim `APPROVED`
- Reject → claim `REJECTED`
- Edit and approve with `finalDecision: APPROVE` → claim `APPROVED`
- Edit and approve with `finalDecision: REJECT` → claim `REJECTED`

### `GET /approvals`

Lists approvals. Defaults to `status=PENDING`. Query also accepts `page`, `limit`, and `status`.

### `GET /approvals/:id`

One approval with claim, policy, analysis, original recommendation, final decision, and audit history.

### `POST /approvals/:id/approve`

Accepts the AI payout. Sets approval `APPROVED` and claim `APPROVED`. A second call returns `409` `APPROVAL_NOT_PENDING`.

### `POST /approvals/:id/reject`

```json
{
  "comment": "The incident description does not match the policy conditions."
}
```

`comment` is required. Sets final payout to `0.00`, approval `REJECTED`, and claim `REJECTED`.

### `POST /approvals/:id/edit-and-approve`

```json
{
  "finalDecision": "APPROVE",
  "finalPayout": 45000,
  "comment": "Adjusted payout based on manual review."
}
```

`comment` is required. For `APPROVE`, `finalPayout` is required and must be ≤ `min(claimedAmount, coverageLimit)`. Over that limit is `400` `INVALID_FINAL_PAYOUT`. Approval status becomes `EDITED_AND_APPROVED`.

## Project setup

```bash
npm install
npm run dev
```

```bash
npm test
npm run test:e2e
npm run lint
```
