# ReviseCode — Complete Frontend Web Application

> **"Learn it. Save it. Revise it. Remember it."**

ReviseCode is a responsive, modern web application designed for students and software engineers to beat the Ebbinghaus forgetting curve. It automates spaced repetition revisions, organizes solutions and handwritten whiteboard notes, tracks active recall quality, and features an interactive natural-language AI companion.

Built strictly using **HTML5, CSS3, and Vanilla JavaScript (ES6+)** without bulky frontend frameworks, virtual DOM layers, or build steps.

---

## 🚀 Quick Start (Running Locally)

You can run ReviseCode locally in **under 5 seconds** with zero external dependencies:

### Option 1: Node.js (Recommended)
```bash
node server.js
# or
npm start
```
Then open: **[http://localhost:3000](http://localhost:3000)** (or directly open **[http://localhost:3000/dashboard.html](http://localhost:3000/dashboard.html)**)

### Option 2: Python 3
```bash
python3 -m http.server 3000
```
Then open: **[http://localhost:3000](http://localhost:3000)**

---

## 📂 Project Structure

```
revisecode/
├── index.html               # Public landing page with features, schedule demo, and FAQs
├── login.html               # Authentication login screen with demo credentials filler
├── register.html            # Registration screen with validation and social buttons
├── forgot-password.html     # Password recovery interface
├── dashboard.html           # Main authenticated app shell & dashboard
├── subjects.html            # Subject categories and topic management
├── questions.html           # Question bank with search, filters, and list/grid views
├── question-detail.html     # Problem details, syntax code, notes, and milestones
├── add-question.html        # Comprehensive question creation form & date scheduler
├── revision-center.html     # Spaced active recall revision center with flashcard reveals
├── calendar.html            # Monthly calendar and daily agenda
├── ai-assistant.html        # Conversational AI assistant with deterministic mock commands
├── analytics.html           # Retention analytics, recall distribution, and streak metrics
├── notifications.html       # Alerts, unread filters, and delivery preferences
├── settings.html            # Profile, theme picker, study goals, JSON export, demo reset
├── profile.html             # User profile overview with focus areas and statistics
├── server.js                # Zero-dependency local web server
├── package.json             # NPM metadata and launch scripts
│
├── css/
│   ├── variables.css        # Design tokens: Navy dark theme default, light theme, radii, spacing
│   ├── base.css             # CSS reset, typography, accessible focus states, scrollbars
│   ├── components.css       # App layout, sidebar, topbar, buttons, cards, modals, toasts
│   ├── landing.css          # Landing page hero, interactive previews, problem comparison
│   ├── auth.css             # Split-screen auth layout, social buttons, credentials helper
│   ├── dashboard.css        # Dashboard grid, metric cards, queue items, activity charts
│   ├── questions.css        # Toolbars, question cards, complexity analysis, code blocks
│   ├── revision.css         # Recall flashcard workflow, rating buttons, timeline milestones
│   ├── ai-assistant.css     # Chat bubbles, suggested prompt chips, action confirmation cards
│   ├── analytics.css        # Recall breakdown bars, SVG activity charts, forgotten item list
│   └── responsive.css       # Breakpoints: 1440px, 1024px, 768px (drawer), 375px mobile
│
├── js/
│   ├── storage.js           # Central data layer with localStorage persistence & seed data
│   ├── icons.js             # Offline-resilient inline Lucide SVG renderer
│   ├── theme.js             # Dark/Light theme toggle controller with localStorage sync
│   ├── auth.js              # Authentication service interface (Demo + Firebase readiness)
│   ├── validators.js        # Form validation helpers (email, url, required, errors)
│   ├── navigation.js        # Shell drawer, active links, toasts, search modal, dropdowns
│   ├── app.js               # Global formatting utilities, relative time, empty states
│   ├── dashboard.js         # Dashboard metrics calculation and queue renderer
│   ├── subjects.js          # Subject cards, modal CRUD, topic management
│   ├── questions.js         # Multi-criteria filtering, search, sorting, bookmarking
│   ├── question-detail.js   # Question details, code copying, timeline, attachments
│   ├── add-question.js      # Form handler, duplicate warnings, dropzone, camera mock
│   ├── revision.js          # Revision center tabs, recall workflow, rescheduling
│   ├── calendar.js          # Monthly grid generation, milestone markers, daily agenda
│   ├── ai-assistant.js      # Natural language command router and confirmation cards
│   ├── analytics.js         # Retention statistics, recall quality %, and focus areas
│   ├── notifications.js     # Unread alerts, mark read/unread, delivery settings
│   ├── settings.js          # Preferences, JSON data export, demo data reset
│   └── profile.js           # Profile view and editing
```

---

## 🧠 Scientific Spaced Repetition Engine

ReviseCode strictly enforces the **5 mandatory milestone intervals**:
- **Milestone 1 (Day 3):** Initial recall checkpoint to halt the steep early forgetting slope.
- **Milestone 2 (Day 7):** One-week retention verification.
- **Milestone 3 (Day 12):** Consolidation drill moving concepts to intermediate memory.
- **Milestone 4 (Day 20):** Deep recall check under cognitive spacing.
- **Milestone 5 (Day 30):** Permanent memory lock.

### Key Rules:
1. **Missed Milestones:** Marked as **Overdue** without deletion or silent postponement.
2. **Active Recall:** Solutions remain hidden by default during revisions. Users attempt recall from memory before clicking **"Reveal Saved Solution"**.
3. **Recall Rating:** Users rate recall difficulty (**Easy**, **Difficult**, or **Forgot**). This populates the **Retention Analytics** dashboard to identify high-friction topics.

---

## 🤖 AI Assistant Capabilities (Demo Mode)

The AI assistant operates in transparent **Demo Mode** with deterministic mock handlers for supported natural language commands:

- `"Add LeetCode 50 to my revision tracker"` — Parses platform and problem number, verifies against duplicates, and renders an interactive confirmation card to save and schedule 5 milestones.
- `"Show today's pending revisions"` — Queries storage and presents today's queue with one-click revision links.
- `"Which questions are overdue?"` — Scans for overdue milestones and prioritizes catch-up items.
- `"Explain my saved binary search solution"` — Retrieves the approach and complexity for saved binary search questions.
- `"Show questions I marked as difficult"` — Highlights questions flagged with recall friction.
- `"Add three new coding questions"` — Recommends curated interview problems (Sliding Window, Graphs, Two Pointers) with direct add buttons.

---

## 🎨 Design System & Theme

- **Default Theme:** Deep Navy (`#0A0D17`) surfaces with violet gradient (`#7C3AED` to `#4F46E5`) accents and accessible semantic colors.
- **Light Theme:** Clean Slate (`#F8FAFC`) with crisp card surfaces and high-contrast typography.
- **Theme Persistence:** Stored in `localStorage` and synchronized across all pages.
- **Responsiveness:** Fluid grid and drawer layout tested at 1440px, 1024px, 768px, and 375px.

---

## 🔒 Production Readiness & Future Integrations

- **Firebase Authentication:** `js/auth.js` has modular interfaces for `login`, `register`, `resetPassword`, and OAuth (`btnGoogleAuth`, `btnGithubAuth`). Simply import the Firebase SDK and initialize with your project credentials.
- **Gemini / LLM Backend:** `js/ai-assistant.js` has a clean request/response handler ready to connect to a server-side Gemini API endpoint.
- **No Secret Leaks:** Client-side source code contains zero exposed API keys or private tokens.
