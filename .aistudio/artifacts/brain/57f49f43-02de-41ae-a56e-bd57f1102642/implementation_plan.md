# Gemini 3.8/3.6 OCR Failover & New-Account Onboarding Flow

Upgrade the server-side document OCR engine to use **Gemini Flash 3.8** (`gemini-3.8-flash`) with automatic failover to **Gemini Flash 3.6** (`gemini-3.6-flash`) while resolving multimodal payload and MIME-handling errors, and introduce a guided two-step onboarding experience (**"What should we call you?"** followed by **First Document AI Scan**) exclusively for newly created accounts.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> All product and workflow choices below reflect your confirmed preferences from the clarification step:

- **Gemini Model Failover Chain**: Primary OCR extraction runs on `gemini-3.8-flash` and automatically shifts to `gemini-3.6-flash` if any model error, quota limit, or schema rejection occurs.
- **Onboarding Trigger Scope**: The **"What should we call you?"** and **First Document Upload** onboarding screens appear **only during new account sign-up**. Returning users signing into an existing account go straight into their vault with their saved display name.
- **Skippable First Document Step**: New users can immediately scan their first document during onboarding or click **"Skip for now"** to enter their empty zero-state vault at any time.
- **Onboarding Scan Actions**: The first document screen focuses cleanly on **Upload File** and **Capture Camera Photo** powered by the Gemini AI OCR pipeline.

---

## 1. Overview & Core Concept

- **What It Does**: Eliminates document scanning failures by migrating off deprecated legacy model IDs onto Gemini 3.8 Flash and Gemini 3.6 Flash with hardened multimodal request formatting, while welcoming new sign-ups with a personalized vault naming step and guided first-document capture.
- **Target Audience / Persona**: Individuals setting up a private personal asset vault who want effortless onboarding and reliable, one-shot extraction of insurance policies, warranties, receipts, and registration certificates.
- **Key Value**: Reliable OCR extraction across PDFs, images, and text documents paired with a tailored first-run experience that personalizes the user's vault without forcing mandatory steps.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Returning User Sign-In**:
   - User enters their existing username and password on the vault lock screen.
   - Upon credential match in Supabase, the mechanical dial unlocks and routes directly to their personalized dashboard (`"<DisplayName>'s Vault"`).
2. **New Account Sign-Up & Guided Onboarding**:
   - **Step 1 — Account Creation**: User creates an account with a username and password. Credentials are saved to Supabase.
   - **Step 2 — "What should we call you?"**: Inside the vault card, the user is prompted for their preferred display name (e.g., *Siddhant*). Submitting persists the display name to their account profile.
   - **Step 3 — "Upload your first document"**: The user is invited to either **Upload File** or **Use Camera** to scan their first asset document with Gemini AI, or click **"Skip for now"** in the top corner to proceed straight into their empty vault.
   - **Step 4 — AI Scan Review & Vault Entry**: If a document is uploaded or photographed, a live scanning progress bar tracks extraction via Gemini 3.8/3.6 Flash, presents the extracted fields for quick verification, saves the first asset to Supabase, and opens the populated vault dashboard.
3. **In-Vault AI Document Scanning**:
   - Clicking **Scan Document** from the dashboard uses the upgraded Gemini 3.8 -> 3.6 failover pipeline with clear error reporting and automatic file MIME normalization.

### Visual Identity & Theme

- **Aesthetic Direction**: Dark architectural vault and precision financial ledger—quiet, authoritative, and uncluttered.
- **Color Palette & Mood**:
  - Dominant 60% Canvas: Deep Obsidian Pine (`#0F1C1A`) with subtle radial warm brass ambient glow.
  - Structural 30% Surfaces: Muted Forest Slate (`#16261F` and `#1C2E26`) separated by crisp `1px` hairline borders (`#2A3B33`), adhering to single-elevation depth without nested card clutter.
  - Accent 10% Budget: Burnished Brass (`#C9A15D`) and Bright Champagne Brass (`#E4C98A`) reserved strictly for primary actions, active segmented tabs, and focus rings; semantic feedback paired with icons and labels in Sage (`#6FA88C`), Amber (`#E0913F`), and Terracotta (`#C97B6B`).
- **Typography & Hierarchy**:
  - Display Headings: `Cinzel` serif with balanced line wrapping (`text-wrap: balance`) for vault titles and onboarding prompts.
  - Interface Prose: `Plus Jakarta Sans` for crisp legibility across form labels, buttons, and metadata separated cleanly with typographic mid-dots (`·`) instead of decorative pill clutter.
  - Tabular Data & Codes: `JetBrains Mono` with `tabular-nums` for serial numbers, policy IDs, currency values, and countdown days.
- **Interactive Feedback & Motion**:
  - Mechanical vault dial rotation and shackle release (`transform` and `opacity` transitions under `200ms–500ms`), smooth step transitions during sign-up onboarding, live scanning progress indicator, and accessible camera stream controls.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Gemini 3.8 Flash Primary with Automatic Gemini 3.6 Flash Failover**
  - *Chosen Approach*: Configure the server OCR pipeline to invoke `gemini-3.8-flash` first with structured JSON `responseSchema`, automatically shifting to `gemini-3.6-flash` if an API error, timeout, or schema failure occurs, alongside structured `{ parts: [...] }` multimodal content formatting and MIME-type normalization from file extensions.
  - *Why*: Previous scanner errors stemmed from calling retired 1.5/2.0 model names, passing unwrapped part arrays, and missing MIME types on certain browser file uploads. Prioritizing `gemini-3.8-flash` with `gemini-3.6-flash` failover delivers fast multimodal OCR accuracy and resilience.
  - *Alternatives Considered*: Single-model execution without fallback was rejected because transient rate limits or regional model availability would interrupt user onboarding.

- **Decision 2: Persisting Display Name on User Profile During Sign-Up**
  - *Chosen Approach*: Store the user's chosen display name alongside their Supabase user record (with automatic graceful column fallback if the user's custom Supabase table only has core columns) so their personalized vault title persists across sessions without re-asking on future logins.
  - *Why*: Honors the requirement that onboarding only runs on sign-up while keeping the personalized greeting permanent.

- **Decision 3: Embedded Onboarding Scanner vs. Dashboard Redirect**
  - *Chosen Approach*: Embed the two-action document capture (Upload File / Capture Photo -> AI Scan -> Review & Save) directly as the final step of the sign-up flow, with an unobtrusive **"Skip for now"** link.
  - *Why*: Gives new users an immediate "aha" moment seeing Gemini extract their policy/invoice details before landing in the dashboard, while respecting user autonomy via one-click skip.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           Client Web Application                           │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ Auth & Sign-Up Onboarding Flow                                       │  │
│  │                                                                      │  │
│  │  [Sign In] ──────────────────────────────────────┐                   │  │
│  │                                                  ▼                   │  │
│  │  [Create Account] ──► [What Should We Call You?] ┼──► [Vault         │  │
│  │                              │                   │     Dashboard]    │  │
│  │                              ▼                   │     (Zero-State   │  │
│  │                    [Upload First Document]       │      or Populated)│  │
│  │                     ├─ Upload File / Camera      │                   │  │
│  │                     ├─ AI Review & Save ─────────┤                   │  │
│  │                     └─ Skip for Now ─────────────┘                   │  │
│  └──────────────────────────────┬───────────────────────────────────────┘  │
│                                 │                                          │
│         ┌───────────────────────┴───────────────────────┐                  │
│         ▼ (Credentials, Display Name & Assets)          ▼ (POST /api/scan) │
└─────────┼───────────────────────────────────────────────┼──────────────────┘
          │                                               │
┌─────────▼───────────────────────────┐   ┌───────────────▼──────────────────┐
│        Supabase Cloud Store         │   │      Express Server Proxy        │
│                                     │   │                                  │
│  ┌───────────────┐ ┌─────────────┐  │   │  ┌────────────────────────────┐  │
│  │ users         │ │ assets      │  │   │  │ Multimodal Payload Guard   │  │
│  │ - id          │ │ - id        │  │   │  │ MIME & Base64 Normalizer   │  │
│  │ - username    │ │ - user_id   │  │   │  └─────────────┬──────────────┘  │
│  │ - password    │ │ - doc_type  │  │   │                ▼                 │
│  │ - display_name│ │ - metadata  │  │   │  ┌────────────────────────────┐  │
│  └───────────────┘ └─────────────┘  │   │  │ 1. gemini-3.8-flash        │  │
│                                     │   │  │    (Primary Structured OCR)│  │
│                                     │   │  │ 2. gemini-3.6-flash        │  │
│                                     │   │  │    (Automatic Failover)    │  │
│                                     │   │  └────────────────────────────┘  │
└─────────────────────────────────────┘   └──────────────────────────────────┘
```

### Data Model & State

- **User Account Entity**: Holds `id`, `username`, `password_hash`, and `display_name` (mapped to `user.name` in session state).
- **Onboarding Step State**: Controlled state machine within authentication (`credentials` -> `display-name` -> `first-document` -> `review-extracted` -> complete), bypassed completely when mode is `signin`.
- **Asset Entity**: Unchanged zero-state per-user schema in Supabase (`assets` table), populated only when the user saves a scanned or manually created document.

### Interactive Component & State Mapping

- **Sign-Up Credential Submission**: Validates username and password confirmation -> creates user in Supabase -> transitions state to `display-name` instead of immediately exiting auth.
- **Display Name Step**: Validates non-empty name -> updates user's `display_name` in Supabase and stored session -> transitions state to `first-document`.
- **First Document Upload Step**:
  - *Upload File*: Infers accurate MIME type from file header or filename extension (`.pdf`, `.jpg`, `.png`, `.webp`, `.txt`, `.docx`), reads payload, and triggers `/api/scan-document`.
  - *Capture Camera Photo*: Opens `getUserMedia` video stream with live capture shutter and cancel controls, converts frame to JPEG base64, stops camera tracks cleanly, and triggers `/api/scan-document`.
  - *Skip for Now*: Immediately completes onboarding and opens the user's empty zero-state vault.
- **Server OCR Failover Sequence**:
  - Reads `GEMINI_API_KEY` / `GEMINI_API_KEY_ASSET_WALLET` from environment (including local `.env` loading).
  - Initializes `GoogleGenAI` with `User-Agent: aistudio-build`.
  - Executes `ai.models.generateContent` against `gemini-3.8-flash` using `{ parts }` structure and `responseSchema`.
  - On any exception or empty output, logs warning and immediately retries with `gemini-3.6-flash` (first with `responseSchema`, then fallback JSON mode if schema validation rejects), stripping any markdown fences before JSON parsing and returning clean structured fields or an actionable error message to the UI.
