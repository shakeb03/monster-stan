# ✅ **DOC 06 — Chat UI**

**File:** `docs/06_chat_ui.md`

---

# **06 — Chat UI**

## **1. Layout**

* Left sidebar: chat list
* Right panel: active chat messages
* Bottom: message composer

---

## **2. Message Types Allowed**

* User message
* Assistant message
* Clarifying question
* Post draft with sections:

  * **Hook**
  * **Body**
  * **CTA**

---

## **3. No AI logic in the UI**

The UI must only:

* Render messages
* Send user messages to backend
* Receive assistant responses

All LLM logic is in backend orchestrator.

---

**End of DOC 06**
