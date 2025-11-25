# **03 — Auth & Onboarding Flow**

## **1. Purpose**

Specifies how users move through authentication and onboarding.

---

## **2. First Login Rules**

After Clerk login:

1. Create a `users` row if not present.
2. Create a `user_profile` row with:

   * `onboarding_status = "linkedin_url_pending"`
     unless it already exists.

---

## **3. Onboarding States (Final)**

Only these five states are allowed:

* `"linkedin_url_pending"`
* `"scraping_in_progress"`
* `"analysis_in_progress"`
* `"ready"`
* `"error"`

Cursor may not introduce more.

---

## **4. UI Behavior**

### `"linkedin_url_pending"`

Prompt user for LinkedIn profile URL.

### `"scraping_in_progress"`

Show “Fetching your profile…” screen.

### `"analysis_in_progress"`

Show “Analyzing your posts and building your voice…” screen.

### `"ready"`

Redirect to chat interface.

### `"error"`

Show retry UI.

---

## **5. Mandatory Background Model**

When user submits URL:

1. Set `onboarding_status = "scraping_in_progress"`.
2. Trigger **two concurrent Apify actors**:

   * **Profile actor**
   * **Posts actor**
3. Wait until *both* finish.
4. If both succeed → set `"analysis_in_progress"`.
5. If either fails → set `"error"`.
6. Frontend must poll `/api/onboarding-status` every 2–5 seconds.

---

**End of DOC 03**
