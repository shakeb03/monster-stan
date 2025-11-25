# ✅ **DOC 05 — Analysis & Style Profile**

**File:** `docs/05_analysis.md`

---

# **05 — Analysis & Style Profile**

## **1. Purpose**

Compute engagement scores, generate embeddings, and create a stable style profile.

---

## **2. Engagement Score**

Use any weighted formula using:

* likes
* comments
* shares
* impressions

Mark highest 25–35% as `is_high_performing`.

---

## **3. Embeddings**

Embed:

* Cleaned post text (`text`)
* Profile “about” section

Store in `post_embeddings`.

---

## **4. Style Profile JSON (Strict & Final)**

Style profile stored in `style_profiles.style_json` must match **exactly**:

```
{
  tone: string,
  formality_level: number,
  average_length_words: number,
  emoji_usage: "none" | "minimal" | "moderate" | "heavy",
  structure_patterns: string[],
  hook_patterns: string[],
  hashtag_style: string,
  favorite_topics: string[],
  common_phrases_or_cadence_examples: string[],
  paragraph_density: "compact" | "spaced" | "varied"
}
```

Additional field stored separately:
`data_confidence_level = "HIGH" | "MEDIUM" | "LOW"`

Cursor may not add or remove fields.

---

## **5. Candidate Post Selection**

Use:

* High-performing posts
* Supplement with recent posts if needed

---

## **6. Final Step**

After embeddings + style profile generation:

* Set `onboarding_status = "ready"`.

---

**End of DOC 05**
