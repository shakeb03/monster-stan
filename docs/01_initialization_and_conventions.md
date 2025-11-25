
# **01 — Initialization & Conventions**

## **1. Purpose**

This document defines the global rules, constraints, conventions, and architecture principles that must be followed across the entire codebase. Cursor must treat this as the highest-level authority.

---

## **2. Approved Tech Stack (Mandatory & Fixed)**

The project must use the following:

* **Next.js (App Router)**
* **TypeScript** (strict mode)
* **Tailwind CSS**
* **Clerk** (Auth)
* **Supabase Postgres** (Primary DB)
* **pgvector** (Vector embeddings)
* **Apify Actors** (LinkedIn scraping)
* **OpenAI-compatible LLM** (GPT-4.1 / GPT-5.1)
* **Vercel Deployment**

Cursor may not introduce new frameworks or deviate from this stack.

---

## **3. Global Coding Rules (Strict)**

1. **No `any` type anywhere.**
2. All functions must have explicit parameter and return types.
3. Cursor must **reuse types** in `lib/types` instead of redefining them.
4. Cursor must **read all referenced docs fully before editing code**.
5. Cursor may not alter or invent database tables or fields.
6. Cursor may not add onboarding states or intent types beyond the approved ones.
7. Cursor cannot reorganize architecture beyond what these docs define.
8. Long-running tasks must use background jobs + polling (no long HTTP responses).
9. All business logic belongs in `lib/services` or `lib/ai` (never inside React components).

---

## **4. Required Folder Structure**

```
app/
  (public)/
  (protected)/
  api/

components/

lib/
  db/
  ai/
  types/
  services/
  utils/

docs/
```

Cursor must maintain this structure.

---

## **5. Required Environment Variables**

Cursor must reference but never hard-code:

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# OpenAI
OPENAI_API_KEY=

# Apify
APIFY_API_TOKEN=
APIFY_LINKEDIN_PROFILE_ACTOR_ID=
APIFY_LINKEDIN_POSTS_ACTOR_ID=
```

**Database Access:**
- All database operations use the Supabase JS client (`@supabase/supabase-js`).
- Server-side operations use `SUPABASE_SERVICE_ROLE_KEY` for admin-level access (via `getSupabaseAdminClient()`).
- The service role key has elevated permissions and must NEVER be exposed to the client.
- Client-side operations (if needed) should use `NEXT_PUBLIC_SUPABASE_ANON_KEY` with Row Level Security (RLS) policies.

---

## **6. Logging Rules**

* Minimal logs.
* No user PII.
* No logging raw Apify dumps or LLM prompts.

---

## **7. Background Processing Requirement**

All ingestion + analysis work is asynchronous.
Frontend must poll for onboarding status.
Cursor may not implement any blocking endpoint.

---

**End of DOC 01**