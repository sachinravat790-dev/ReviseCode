# ReviseCode Project Workspace

All frontend web application source code, stylesheets, scripts, and pages are organized inside the **[`frontend/`](./frontend)** directory.

## 🚀 Running the Frontend Locally

From the root project directory:

```bash
# Using Node.js
npm start
# or: node frontend/server.js

# Or using Python 3
python3 -m http.server 3000 --directory frontend
```

Or from inside the `frontend/` folder:

```bash
cd frontend
node server.js
```

Then visit: **[http://localhost:3000](http://localhost:3000)** (or **[http://localhost:3000/dashboard.html](http://localhost:3000/dashboard.html)**)

---

## ⚙️ Running the Backend Locally

All backend Express API source code, controllers, services, repositories, and tests are located inside the **[`backend/`](./backend)** directory.

From the root project directory:

```bash
# Start backend server (http://localhost:5001)
npm run start:backend

# Run automated tests
npm run test:backend
```

Or from inside the `backend/` folder:

```bash
cd backend
npm start        # Production start
npm run dev      # Auto-reloading dev mode
npm test         # Run 29 automated test cases
```

Then visit the API health endpoint: **[http://localhost:5001/api/health](http://localhost:5001/api/health)**

