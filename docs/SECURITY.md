# Security

Each control below is tied to a concrete threat in this API. This is not a generic security checklist.

## Control → threat

| Control | Threat mitigated |
|---|---|
| JWT access guard on claims, analyze, and approvals (`JwtAccessGuard`) | Unauthenticated create/read/update of claims, analysis runs, and final decisions |
| Admin-only approvals (`UNAUTHORIZED_REVIEWER`) | An employee forging approve / reject / edit-and-approve outcomes |
| Claim ownership checks (`UNAUTHORIZED_CLAIM_ACCESS`) | An employee probing or changing another user’s claims |
| Global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`) | Mass assignment of server fields such as `status`, `createdBy`, `claimNumber` |
| Password hashing (bcrypt); `password` never returned on user responses | Credential theft via API JSON |
| Separate `JWT_SECRET` / `JWT_REFRESH_SECRET` (and distinct expiries) | Using a refresh token as if it were an access token |
| AI fact check against cited chunk text; payout computed in code (`payout-calculator`) | Model inventing coverage limits, deductibles, or payout amounts |
| Approval optimistic version check + transactional decide | Double-approve / race on the same pending approval |
| Edited payout capped by `min(claimedAmount, coverageLimit)` | Inflated human payout above claim or policy limit |
| CORS origin restricted to `CORS_ORIGIN` with credentials | Browser calls from untrusted frontends |
| Policy upload accepts PDF / DOCX only (`files` + Multer filter) | Arbitrary executable or script upload as a “policy document” |

## Residual risks (honest)

| Risk | Why it remains |
|---|---|
| `POST/GET /users`, policies CRUD/list, and `POST /rag/retrieve` have no JWT | Temporary for local dashboard setup; anyone who can reach the API can create users, upload policies, or query chunks |
| `synchronize: true` on TypeORM | Schema sync for local/dev only — not a production migration strategy; accidental schema drift or wipe risk if misused against a shared DB |
| Secrets in `.env` (`ONLINE_DATABASE_URL`, JWT secrets, `AI_API_KEY`) | Leak of the env file or host env grants DB, token minting, and model access |
| Uploaded files served publicly under `/uploads/` | Anyone with the URL can download the stored PDF/DOCX; treat uploads as non-secret |
| No rate limiting / abuse controls on auth or analyze | Brute-force login or costly analyze spam is out of current scope |
| LLM still influences coverage narrative before fact check | Fact check and coded payout reduce invention; they do not remove all model error on free-text fields |

Harden before any shared or production deploy: close open routes, use real migrations, rotate secrets, and stop treating `/uploads/` as public if documents are sensitive.
