# ✅ **DOC 02 — Data Model & Database Schema**

**File:** `docs/02_data_model_and_database.md`

---

# **02 — Data Model & Database Schema**

## **1. Purpose**

Defines the complete and final database schema. Cursor must not alter field names, types, or structure unless updated in this doc.

---

# **2. Tables**

---

## **Table: `users`**

| Field      | Type                          | Notes    |
| ---------- | ----------------------------- | -------- |
| id         | string (PK, matches Clerk ID) | Required |
| email      | string                        | Required |
| created_at | timestamp                     | Required |

---

## **Table: `user_profile`**

| Field             | Type                       |
| ----------------- | -------------------------- |
| user_id           | string (PK, FK → users.id) |
| linkedin_url      | string                     |
| onboarding_status | enum                       |
| goals_json        | JSON                       |
| created_at        | ts                         |
| updated_at        | ts                         |

### Allowed `onboarding_status`:

* `"linkedin_url_pending"`
* `"scraping_in_progress"`
* `"analysis_in_progress"`
* `"ready"`
* `"error"`

Cursor cannot add new states.

---

## **Table: `linkedin_profiles`**

| Field           | Type |
| --------------- | ---- |
| id              | PK   |
| user_id         | FK   |
| headline        | text |
| about           | text |
| location        | text |
| experience_json | JSON |
| raw_json        | JSON |
| created_at      | ts   |
| updated_at      | ts   |

---

## **Table: `linkedin_posts`**

| Field              | Type            |
| ------------------ | --------------- |
| id                 | PK              |
| user_id            | FK              |
| text               | text (cleaned)  |
| raw_text           | text            |
| posted_at          | ts              |
| likes_count        | integer         |
| comments_count     | integer         |
| shares_count       | integer         |
| impressions_count  | integer or null |
| engagement_score   | numeric         |
| is_high_performing | boolean         |
| topic_hint         | text            |
| raw_json           | JSON            |
| created_at         | ts              |
| updated_at         | ts              |

---

## **Table: `post_embeddings`**

| Field      | Type   |
| ---------- | ------ |
| id         | PK     |
| post_id    | FK     |
| user_id    | FK     |
| embedding  | vector |
| created_at | ts     |

---

## **Table: `style_profiles`**

| Field                 | Type                               |
| --------------------- | ---------------------------------- |
| id                    | PK                                 |
| user_id               | FK (unique)                        |
| style_json            | JSON (structure defined in DOC 05) |
| data_confidence_level | `"HIGH" \| "MEDIUM" \| "LOW"`      |
| last_updated_at       | ts                                 |

---

## **Table: `chats`**

| Field      | Type    |
| ---------- | ------- |
| id         | PK      |
| user_id    | FK      |
| title      | text    |
| created_at | ts      |
| updated_at | ts      |
| is_active  | boolean |

---

## **Table: `chat_messages`**

| Field         | Type                                  |
| ------------- | ------------------------------------- |
| id            | PK                                    |
| chat_id       | FK                                    |
| user_id       | FK (nullable for assistant)           |
| role          | `"user"` | `"assistant"` | `"system"` |
| content       | text                                  |
| metadata_json | JSON                                  |
| created_at    | ts                                    |

---

## **Table: `long_term_memory`**

| Field        | Type         |
| ------------ | ------------ |
| id           | PK           |
| user_id      | FK           |
| summary_type | enum         |
| content      | text or JSON |
| updated_at   | ts           |

Allowed `summary_type`:

* `"persona"`
* `"goals"`
* `"content_strategy"`
* `"past_wins"`
* `"other"`

---

**End of DOC 02**
