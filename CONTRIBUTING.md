# Contributing to Inspo AI Studio

Thank you for your interest in contributing to Inspo AI Studio! We are building an open-source, AI-powered design intelligence platform that helps designers, engineers, and product builders discover visual references, create real-time moodboards, scan brand systems, and generate responsive UI components.

---

## Code of Conduct

All contributors and community members are expected to follow our [Code of Conduct](./CODE_OF_CONDUCT.md) in all project spaces, including issues, pull requests, and discussions.

---

## Monorepo Architecture

Inspo AI Studio is structured as an npm workspaces monorepo:

```text
inspoai-studio/
├── frontend/                # React 18, Vite, TailwindCSS & Lucide Icons
│   ├── src/components/      # UI components (Canvas, Moodboards, Brand Scanner)
│   ├── src/pages/           # Main screen, image view, shared moodboards
│   └── .env.example         # Frontend environment template
├── backend/                 # Node.js, Express, Supabase & AI Services
│   ├── src/routes/          # API endpoints (Search, Agentic UI, Moodboard, Collaboration)
│   ├── src/services/        # LLM integrations (OpenAI, Gemini, DeepSeek) & Scrapers
│   ├── supabase/schema.sql  # 1-click unified database setup
│   └── tests/run_tests.js   # Automated unit test suite
└── package.json             # Monorepo scripts and npm workspace definitions
```

---

## Getting Started Locally

### 1. Prerequisites
- **Node.js**: `v20.18.1` or higher
- **npm**: `v9` or higher
- **Supabase Account**: (free tier is sufficient)

### 2. Installation
Clone the repository and install all dependencies for both frontend and backend:

```bash
cd inspoai-studio
npm install
```

### 3. Environment Setup
Copy the example environment files and add your configuration:

```bash
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

Set up your Supabase database:
1. Create a project in [Supabase](https://supabase.com).
2. Open the **SQL Editor** in your Supabase dashboard.
3. Paste the contents of `backend/supabase/schema.sql` and click **Run**.
4. Copy your Supabase URL and keys into `backend/.env`.

### 4. Running Locally
Start both backend and frontend servers simultaneously:

```bash
npm run dev
```

- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend**: [http://localhost:5001](http://localhost:5001)
- **Health Check**: [http://localhost:5001/health](http://localhost:5001/health)

---

## Development & Testing

Before submitting any code, verify that all unit tests and builds pass:

```bash
# Run backend test suite (Lucide validation, code sanitization, content moderation)
npm run test:backend

# Verify frontend production build
npm run build:frontend
```

---

## Pull Request Guidelines

1. **Create a branch**: Use descriptive names such as `feat/brand-scanner-export` or `fix/canvas-zoom-drift`.
2. **Follow style guidelines**:
   - Write clean, modern ES module code.
   - Keep components modular and readable.
   - Avoid hardcoding secrets, API tokens, or personal identifiers.
3. **Add tests**: If adding new route sanitizers or features, include test cases in `backend/tests/run_tests.js`.
4. **Submit a PR**: Use our [Pull Request Template](.github/PULL_REQUEST_TEMPLATE.md) to describe what your changes accomplish.

Thank you for helping make Inspo AI Studio better!
