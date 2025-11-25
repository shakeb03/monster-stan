# ✅ **DOC 04 — LinkedIn Ingestion**

**File:** `docs/04_ingestion_linkedin.md`

---

# **04 — LinkedIn Ingestion**

## **1. Purpose**

Fetch and normalize LinkedIn data using two separate Apify actors.

---

## **2. Apify Architecture**

### Required actors:

* `APIFY_LINKEDIN_PROFILE_ACTOR_ID`
* `APIFY_LINKEDIN_POSTS_ACTOR_ID`

### Concurrency

Both must run **in parallel** after URL submission.

---

## **3. Flow Summary**

1. Receive `user_id` and `linkedin_url`.
2. Trigger profile actor and posts actor concurrently.
3. Each actor returns raw JSON.
4. System must parse results:

### Profile actor output → `linkedin_profiles`

### Posts actor output → `linkedin_posts`

5. After *both* finish successfully:

   * Set `onboarding_status = "analysis_in_progress"`

6. If either fails:

   * Set `onboarding_status = "error"`

---

## **4. Raw Data Storage Rules**

### `raw_json`

* Store **full** Apify output for debugging, auditing, reprocessing.

### `raw_text`

* Store the unmodified LinkedIn post text EXACTLY as scraped.

### `text` (cleaned)

* Remove tracking URLs
* Normalize whitespace
* Preserve meaning & content
* Suitable for embeddings and LLM consumption

---

## **5. No AI usage in this stage.**

---

**End of DOC 04**
