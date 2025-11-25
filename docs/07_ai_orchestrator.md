# ✅ **DOC 07 — AI Orchestrator & Intent System**

**File:** `docs/07_ai_orchestrator.md`

---

# **07 — AI Orchestrator & Intent System**

## **1. Purpose**

Interpret user messages, retrieve context via RAG, and generate safe outputs.

---

## **2. Allowed Intents (Final)**

* `"WRITE_POST"`
* `"ANALYZE_PROFILE"`
* `"STRATEGY"`
* `"OTHER"`

Cursor must not introduce additional intents.

---

## **3. Intent Classifier Output (Strict JSON)**

```
{
  intent: "WRITE_POST" | "ANALYZE_PROFILE" | "STRATEGY" | "OTHER",
  needs_clarification: boolean,
  missing_fields: string[],
  requires_rag: boolean,
  proposed_follow_ups: string[]
}
```

---

## **4. RAG Logic**

If `requires_rag = true`:

1. Query `post_embeddings`
2. Select top **3–5** relevant posts
3. Pass them as **FACTS** into the LLM prompt

---

## **5. WRITE_POST Flow**

1. Check `missing_fields`
2. Ask clarifying questions (1–3 max)
3. Build a **post spec** internally
4. Generate output using:

   * **STYLE block** = style_json
   * **FACTS block** = RAG posts + memory + LinkedIn data
   * **INSTRUCTIONS block** = user request

Output sections:

* Hook
* Body
* CTA

---

## **6. ANALYZE_PROFILE Flow**

Based only on:

* LinkedIn profile
* LinkedIn posts
* Style profile

Produce:

* Strengths
* Weaknesses
* What to improve

No invented facts.

---

## **7. STRATEGY Flow**

Use:

* Favorite topics
* High-performing post clusters
* User goals

Generate:

* Themes
* 3–5 post ideas per theme

---

**End of DOC 07**
