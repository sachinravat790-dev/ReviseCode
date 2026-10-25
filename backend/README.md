# ReviseCode Backend API

A clean, modular Express.js backend engineered for **ReviseCode** — the spaced-repetition platform designed to help developers and students remember coding questions, solutions, and system concepts.

---

## 1. Overview

The ReviseCode backend implements core spaced repetition logic, question lifecycle management, categorization by subject/topic, deterministic AI assistant commands, and real-time dashboard analytics.

All entities are persistently backed by **Supabase PostgreSQL** via `@supabase/supabase-js` using the backend service role key.

### Spaced Repetition Milestones
When a question is solved, the system automatically schedules **5 mandatory revision milestones**:
- **Day 3**: First retention checkpoint
- **Day 7**: Short-term consolidation
- **Day 12**: Intermediate recall
- **Day 20**: Long-term anchoring
- **Day 30**: Permanent mastery review

Status is calculated dynamically:
- **`due`**: Milestone date is today and uncompleted
- **`overdue`**: Milestone date has passed and uncompleted
- **`upcoming`**: Milestone date is in the future
- **`completed`**: Milestone has been marked completed with recall rating (`easy`, `difficult`, or `forgot`)

---

## 2. Technology Stack

- **Runtime**: Node.js (v18+ / v20+ / v24+)
- **Server Framework**: Express.js 4 (ES Modules)
- **Database**: Supabase PostgreSQL (`@supabase/supabase-js`)
- **Validation**: Zod 3 (schema-based payload, query, and parameter validation)
- **CORS**: Cross-Origin Resource Sharing configured for `http://localhost:3000`
- **Environment**: `dotenv` with strict fallback defaults
- **Testing**: Node.js built-in native test runner (`node:test`, `node:assert/strict`)

---

## 3. Folder Structure

```
backend/
├── .env.example              # Sample environment configuration with Supabase placeholders
├── .gitignore                # Git ignore patterns (ensures .env is never committed)
├── package.json              # Project metadata, ES module declaration, dependencies
├── README.md                 # Complete architectural and API documentation
├── supabase/
│   └── migrations/           # Idempotent PostgreSQL DDL migrations
│       ├── 001_enhance_subjects_and_questions.sql
│       ├── 002_create_revisions_and_sessions.sql
│       ├── 003_create_notifications_and_settings.sql
│       ├── 004_enable_rls.sql
│       ├── combined_schema_migration.sql
│       └── seed_demo_data_optional.sql
├── src/
│   ├── app.js                # Express app setup, CORS, JSON parsers, routing, error handlers
│   ├── server.js             # HTTP listener with pre-flight env validation and graceful shutdown
│   ├── config/
│   │   ├── env.js            # Environment loader, URL validation, secrets protection
│   │   └── supabase.js       # Dedicated Supabase client singleton with test injection
│   ├── routes/
│   │   ├── index.routes.js   # Master router aggregating all sub-resources under /api
│   │   ├── health.routes.js  # Server health, uptime, and database storage status
│   │   ├── questions.routes.js   # Question CRUD, bookmarking, and filters
│   │   ├── subjects.routes.js    # Subject management with referential protection
│   │   ├── revisions.routes.js   # Spaced repetition milestones, completion, rescheduling
│   │   ├── dashboard.routes.js   # Real-time metrics, streaks, and activity streams
│   │   ├── settings.routes.js    # User preferences and notification settings
│   │   ├── notifications.routes.js # In-app notifications
│   │   └── assistant.routes.js   # Deterministic assistant commands and capabilities
│   ├── controllers/          # Asynchronous HTTP handlers with consistent error translation
│   ├── services/             # Pure business logic and domain rules
│   ├── repositories/
│   │   ├── supabase.repository.js # Full persistent repository with snake_case <-> camelCase mapping
│   │   └── memory.repository.js   # In-memory baseline reference
│   ├── middleware/
│   │   ├── error-handler.js  # Centralized error handler, catches malformed JSON & 500s
│   │   ├── not-found.js      # Centralized 404 handler for undefined endpoints
│   │   ├── validate.js       # Reusable Zod middleware
│   │   └── request-logger.js # Express dev request logger
│   ├── schemas/              # Zod validation schemas for request validation
│   └── utils/
│       ├── api-response.js   # Uniform JSend-style JSON success/error response helpers
│       └── dates.js          # Timezone-safe YYYY-MM-DD date arithmetic and status calculators
└── tests/
    ├── mocks/
    │   └── supabase.mock.js  # High-fidelity in-memory query builder mock
    ├── test-helper.js        # Zero-permission in-memory Express dispatcher & mock DB setup
    ├── health.test.js        # Health check, 404, CORS, malformed JSON tests
    ├── questions.test.js     # Question CRUD, validation, duplicates, cascade deletion
    ├── subjects.test.js      # Subject listing, creation, and referential protection
    ├── revisions.test.js     # Milestone scheduling, completion, rescheduling
    ├── dashboard-and-features.test.js # Dashboard, notifications, settings, and assistant
    ├── repository-and-persistence.test.js # Persistence verification across restart & 500 error handling
    └── supabase-live.js      # Live Supabase PostgreSQL database verification script
```

---

## 4. Environment Variables

Create a `.env` file in the `backend/` directory (or copy from `.env.example`):

```bash
PORT=5001
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:3000

# Supabase PostgreSQL Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_secret_key
```

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `PORT` | `5001` | Local port where the Express server listens |
| `NODE_ENV` | `development` | Set to `production` or `test` to suppress stack traces / dev logs |
| `CLIENT_ORIGIN` | `http://localhost:3000` | Frontend origin allowed by CORS |
| `SUPABASE_URL` | *(required)* | Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | *(required)* | Supabase Service Role Key (Backend only, never exposed to frontend) |

---

## 5. Getting Started

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Run Database Migrations
Execute `backend/supabase/migrations/combined_schema_migration.sql` in your Supabase SQL Editor.

### 3. Run Automated Tests
Execute the 44 automated tests across all suites:
```bash
npm test
```

### 4. Verify Live Supabase Connection (Optional)
Once credentials are added to `backend/.env`:
```bash
npm run test:live
```

### 5. Start the Server
Development mode:
```bash
npm run dev
```

Standard production mode:
```bash
npm start
```

Base URLs:
- **Base API**: `http://localhost:5001/api`
- **Health Check**: `http://localhost:5001/api/health`

---

## 6. Available API Endpoints

All endpoints return uniform JSON responses:
- **Success**: `{ "success": true, "message": "...", "data": ... }`
- **Error**: `{ "success": false, "message": "...", "errors": [...] }`

### Health Check
- `GET /api/health` — Check server status, uptime, and database storage status.

### Questions
- `GET /api/questions` — List questions with pagination (`page`, `limit`), search (`search`), and filters (`subject`, `difficulty`, `bookmarked`).
- `GET /api/questions/:id` — Get single question details with associated milestones attached.
- `POST /api/questions` — Create question. Automatically generates 5 revision milestones (`Day 3, 7, 12, 20, 30`).
- `PUT /api/questions/:id` — Update question details.
- `PATCH /api/questions/:id/bookmark` — Toggle question bookmark status.
- `DELETE /api/questions/:id` — Delete question and cascade delete associated revision milestones and sessions.

### Subjects
- `GET /api/subjects` — List all subjects with dynamic `questionCount` and `pendingCount`.
- `GET /api/subjects/:id` — Get single subject details and its assigned questions.
- `POST /api/subjects` — Create a new subject category.
- `PUT /api/subjects/:id` — Update subject metadata, color, or topics.
- `DELETE /api/subjects/:id` — Delete subject (rejects with `400` if questions are still assigned).

### Revisions & Milestones
- `GET /api/revisions` — List all milestones with dynamically computed statuses.
- `GET /api/revisions/today` — List milestones currently due today.
- `GET /api/revisions/upcoming` — List future upcoming milestones.
- `GET /api/revisions/overdue` — List overdue milestones requiring revision.
- `GET /api/revisions/completed` — List completed revision milestones.
- `GET /api/revisions/:id` — Get single revision milestone.
- `POST /api/revisions/:id/complete` — Mark milestone completed with recall rating (`easy`, `difficult`, `forgot`) and notes. Does not alter subsequent scheduled milestones.
- `POST /api/revisions/:id/reschedule` — Reschedule milestone to a new date (`{ "newDueDate": "YYYY-MM-DD" }`).
- `POST /api/revisions/:id/skip` — Skip milestone with optional reason.
- `POST /api/revisions/custom` — Add an additional custom milestone to a question.

### Dashboard & Analytics
- `GET /api/dashboard/stats` — Overall statistics (total questions, due today, overdue, completed, completion rate).
- `GET /api/dashboard/activity` — Recent revision session activities.
- `GET /api/dashboard/progress` — Progress breakdown per subject.

### Settings & Notifications
- `GET /api/settings` — Get current user preferences and revision intervals.
- `PUT /api/settings` — Update preferences.
- `GET /api/notifications` — List system notifications.
- `PATCH /api/notifications/:id/read` — Mark notification as read.

### AI Assistant Commands
- `GET /api/assistant/capabilities` — List supported deterministic commands.
- `POST /api/assistant/command` — Dispatch natural-language/structured command:
  - `show_due_revisions`: Retrieve today's due questions
  - `show_overdue_revisions`: Retrieve overdue items
  - `list_questions`: Search and filter questions
  - `add_question`: Programmatically add a question with automatic milestone generation
  - `explain_solution`: Retrieve stored solution notes and approach for revision
