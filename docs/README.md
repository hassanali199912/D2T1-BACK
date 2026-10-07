# Quick start and demo

Focus: get the Insurance Claims API running in about 15 minutes, then walk the MVP in five minutes.

Full request shapes and field rules live in the root [README.md](../README.md). Design, evaluation, and security are in this folder:

- [SYSTEM-DESIGN.md](./SYSTEM-DESIGN.md)
- [EVALUATION.md](./EVALUATION.md)
- [SECURITY.md](./SECURITY.md)

## Quick start (about 15 minutes)

### Prerequisites

- Node.js 20+ and npm
- A Postgres database with `pgvector` (the project uses `ONLINE_DATABASE_URL`)
- A `.env` at the repo root with at least:

```text
PORT=3030
ONLINE_DATABASE_URL=...
JWT_SECRET=...
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=...
JWT_REFRESH_EXPIRES_IN=30d
CORS_ORIGIN=http://localhost:5173
```

For claim analysis (step 4 of the demo), also set:

```text
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=...
AI_MODEL=...
```

The OpenAI-compatible adapter calls `POST {AI_BASE_URL}/chat/completions`.

### Install and run

```bash
npm install
npm run dev
```

API base URL: `http://localhost:3030`

### Seeded accounts

| Email | Password | Role |
|---|---|---|
| `admin@example.com` | `password1` | admin (claims + approvals) |
| `employee@example.com` | `password1` | employee (own claims only) |

### Postman

Collections are under [`postman/`](../postman/): auth, policies, rag, claims, approvals.

## 5-Minute Demo Path

Use Postman or curl. Replace `<token>`, `<policyId>`, `<claimId>`, and `<approvalId>` as you go.

### 1. Login

```http
POST http://localhost:3030/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "password1"
}
```

Keep `accessToken`.

### 2. Pick a policy

```http
GET http://localhost:3030/policies/options
```

Choose an indexed policy `id` (prefer a motor policy that finished `INDEXED`).

### 3. Create a claim

```http
POST http://localhost:3030/claims
Authorization: Bearer <token>
Content-Type: application/json

{
  "policyId": "<policyId>",
  "incidentDate": "2026-01-02",
  "claimType": "COLLISION",
  "claimedAmount": 80000,
  "description": "The insured vehicle was involved in a rear-end collision at an intersection."
}
```

Expect `SUBMITTED`, a `claimNumber` such as `CLM-000021`, and `claimedAmount` as `"80000.00"`.

### 4. Analyze

```http
POST http://localhost:3030/claims/<claimId>/analyze
Authorization: Bearer <token>
```

Show either:

- `COMPLETED` with coverage, citations, limit, deductible, and coded payout, or
- `INSUFFICIENT_EVIDENCE` / `FAILED` with recommendation `REVIEW` and reasoning `No evidence to support a decision.`

In every finish path the claim moves to `UNDER_REVIEW` and a `PENDING` approval is created.

### 5. Open the approval queue

```http
GET http://localhost:3030/approvals
Authorization: Bearer <token>
```

Find the row for your claim. Note `approvalId`.

### 6. Decide

Approve (keeps the AI payout):

```http
POST http://localhost:3030/approvals/<approvalId>/approve
Authorization: Bearer <token>
```

Or reject:

```http
POST http://localhost:3030/approvals/<approvalId>/reject
Authorization: Bearer <token>
Content-Type: application/json

{
  "comment": "The incident description does not match the policy conditions."
}
```

Or edit and approve:

```http
POST http://localhost:3030/approvals/<approvalId>/edit-and-approve
Authorization: Bearer <token>
Content-Type: application/json

{
  "finalDecision": "APPROVE",
  "finalPayout": 45000,
  "comment": "Adjusted payout based on manual review."
}
```

Confirm with `GET /claims/<claimId>` and `GET /approvals/<approvalId>`: claim is `APPROVED` or `REJECTED`, AI `originalRecommendation` is still present, and audits include `CREATED` plus the human action.

A second approve on the same id returns `409` `APPROVAL_NOT_PENDING`. An employee token on `/approvals` returns `403` `UNAUTHORIZED_REVIEWER`.
