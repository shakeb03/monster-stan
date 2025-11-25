# **09 — Hallucination & Voice Safety**

## **1. Purpose**

Enforce strict separation of style vs truth to guarantee zero hallucination and accurate voice cloning.

---

# **2. Mandatory Prompt Structure**

Every LLM call must include **three separate labeled blocks**:

### **A. STYLE BLOCK**

* Entire `style_json`
* Defines *how* to write (tone, structure, hooks, cadence)

### **B. FACTS BLOCK**

Contains only verified data:

* RAG-selected posts
* LinkedIn profile fields
* Long-term memory
* User messages

### **C. INSTRUCTIONS BLOCK**

Exactly what the user wants.

---

## **3. Hard Safety Rules for the LLM**

The LLM must be explicitly instructed to:

1. **Never invent biographical facts.**
2. **Never assume roles, achievements, or years.**
3. If data is missing → ask a question.
4. STYLE only controls **voice**, not **content**.
5. FACTS override STYLE.
6. If FACTS are insufficient → produce generic statements or ask user.
7. Do not infer identity details from tone.
8. Avoid confident assertions without grounding.

---

## **4. RAG Is Mandatory For:**

* Posts referencing user career
* Experience
* Personal journeys
* Achievements
* Accomplishments
* About/bio rewrites

---

## **5. Optional Two-Pass Validation (Recommended)**

For sensitive generations (bios, career posts):

1. First produce draft.
2. Second pass:

   > “List any claims in the text not supported by FACTS.”
3. Remove or rewrite flagged items.

---

**End of DOC 09**