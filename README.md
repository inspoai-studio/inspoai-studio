<div align="center">

# Inspo AI Studio

<p>
  <strong>The Source-Available Design Intelligence, UI and Web Generation &amp; Agentic UI Platform</strong>
</p>

<h3>
  <a href="https://www.inspoai.io/">Visit Inspoai</a>
</h3>

Explore visual references, collaborate on real-time moodboards, scan brand design systems, and generate production-ready React components with AI.

<a href="https://www.youtube.com/watch?v=bPSyjoKeM8s">
  <img src="https://img.youtube.com/vi/bPSyjoKeM8s/maxresdefault.jpg" width="560" alt="Inspo AI Studio demo">
</a>

[![License](https://img.shields.io/badge/License-PolyForm_Noncommercial_1.0.0-orange.svg)](./LICENSE)
[![Commercial Use](https://img.shields.io/badge/Commercial_Use-License_Required-red.svg)](#-license--permitted-use)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.18-brightgreen.svg)](https://nodejs.org)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF.svg)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Realtime_%26_Vector-3ECF8E.svg)](https://supabase.com)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

[Features](#-key-features) • [Quickstart](#-quickstart) • [Database Setup](#-1-click-database-setup) • [Architecture](#-monorepo-architecture) • [License](#-license--permitted-use) • [Contributing](#-contributing)

</div>

---

> [!IMPORTANT]
> **This project is not licensed for commercial use.**
> Inspo AI Studio is source-available under the [PolyForm Noncommercial License 1.0.0](./LICENSE). You may read, run, modify, and share it for personal projects, learning, research, and use by charitable or nonprofit organisations. You may **not** use it — or anything derived from it — in a product, service, or internal tool that supports commercial activity. See [License & Permitted Use](#-license--permitted-use) for the full picture, or email **farhan@inspoai.io** for a commercial licence.

---

## Key Features

- **Agentic UI Generation**: Prompt-to-component React sandbox with automatic Lucide icon healing, Babel syntax sanitization, and live interactive previews.
- **Multi-Source Design Intelligence**: Search curated web layouts, mobile app screens, visual graphics (Pinterest, Google, Freepik), and SVG icons in a single unified interface.
- **Collaborative Moodboard Studio**: Infinite canvas with draggable cards, image uploads, visual connection edges, and real-time multiplayer cursor synchronization via WebSockets.
- **Titan Brand Scanner**: Deep website scanner that extracts complete design systems in seconds — typography, color palettes, spacing tokens, logos, and UI component screenshots.
- **Native Model Context Protocol (MCP)**: Built-in MCP server (`/api/mcp/sse`) allowing Claude Desktop, Cursor, and IDE coding agents to search design references and pull components directly into their context.
- **Battle-Tested Security**: Comprehensive Row-Level Security (RLS), SSRF protection on scrapers, and automated input safety moderation.

---

<details>
<summary>Agentic UI — prompt to UI</summary>
<img width="389" height="486" alt="Inspo AI Studio interface" src="https://github.com/user-attachments/assets/2210de14-7be4-4b32-9eed-e31d8cdbf88c" />
</details>

<details>
<summary>AI UI usually looks smart</summary>
<img width="1542" height="1927" alt="Agentic UI generation view" src="https://github.com/user-attachments/assets/3c54c2ff-2a8f-42fa-b7dd-bc58bdb8dd7d" />
</details>

---

## License & Permitted Use

Inspo AI Studio is **source-available, not open source**. It is licensed under the [PolyForm Noncommercial License 1.0.0](./LICENSE).

### You may

- Run the software for personal projects and private experimentation
- Read, study, and modify the source code
- Use it for teaching, coursework, academic research, and publication
- Use it inside a registered charitable or nonprofit organisation
- Fork it and share your changes, provided the same licence and this notice travel with the copy

### You may not

- Use the software, or any derivative of it, in a commercial product or service
- Run it as internal tooling at a for-profit company, including on internal-only deployments
- Offer it — hosted, white-labelled, rebranded, or embedded — to paying customers
- Use it to deliver paid client work, freelance or agency
- Resell, sublicense, or redistribute it commercially in any form

**Commercial use requires a separate licence.** We grant them, and the process is short. Email **farhan@inspoai.io** with a sentence on what you're building and we'll come back with terms.

### Why not open source?

"Open source" has a specific meaning under the OSI definition, and any licence restricting commercial use falls outside it. Calling this project source-available is the accurate description. Everything is readable, forkable, and modifiable — the only restriction is commercial exploitation.

### Contributions

By opening a pull request, you agree your contribution is licensed under the same terms and that Inspo AI may also offer it under a commercial licence. See [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## Monorepo Architecture

Inspo AI Studio is structured as an npm workspaces monorepo:

```text
inspoai-studio/
├── frontend/                   # Client Application (React 18, Vite, Lucide Icons)
│   ├── src/
│   │   ├── components/         # Canvas, AgenticUI, BrandScanner, Moodboards
│   │   ├── pages/              # MainScreen, ImageViewer, SharedCanvas
│   │   ├── services/           # Backend API & Socket.io client services
│   │   └── context/            # Auth and application state
│   └── .env.example            # Client environment configuration
│
├── backend/                    # Backend API (Node.js, Express, Supabase)
│   ├── src/
│   │   ├── routes/             # Search, Scanner, Collaboration, Agentic UI, MCP
│   │   ├── services/           # Scrapers, LLM integrations (OpenAI, Gemini, DeepSeek)
│   │   ├── scrapers/           # Headless browser scrapers & Brandfetch engine
│   │   └── utils/              # SSRF guard, compiler check, Lucide icon maps
│   ├── supabase/
│   │   └── schema.sql          # 1-Click unified database schema, vector search & RLS
│   ├── tests/
│   │   └── run_tests.js        # Automated offline unit test suite
│   └── .env.example            # Server environment configuration
│
├── .github/                    # CI workflows, Issue & PR templates
├── LICENSE                     # PolyForm Noncommercial License 1.0.0
├── CONTRIBUTING.md             # Developer contribution guidelines
├── CODE_OF_CONDUCT.md          # Community guidelines
└── package.json                # Monorepo root workspace commands
```

---

## Quickstart

### Prerequisites
- [Node.js](https://nodejs.org/) `>= 20.18.1`
- [npm](https://www.npmjs.com/) `>= 9.0.0`
- A [Supabase](https://supabase.com/) account (free tier works great)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/Inspoai/inspoai-studio.git
cd inspoai-studio
npm install
```

### 2. Configure Environment Variables
Copy the templates and provide your API keys:

```bash
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

*See [frontend/.env.example](./frontend/.env.example) and [backend/.env.example](./backend/.env.example) for descriptions of each key.*

### 3. Start Development Servers
Run both backend and frontend concurrently with one command:

```bash
npm run dev
```

- **Frontend App**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:5001](http://localhost:5001)
- **API Health Check**: [http://localhost:5001/health](http://localhost:5001/health)

---

## 1-Click Database Setup

Inspo AI Studio uses PostgreSQL with `pgvector` hosted on Supabase.

1. Create a new project at [supabase.com](https://supabase.com).
2. Go to the **SQL Editor** in your Supabase dashboard.
3. Open [`backend/supabase/schema.sql`](./backend/supabase/schema.sql), copy the entire file, and click **Run**.
4. Copy your **Project URL**, **Anon Key**, and **Service Role Key** into your `backend/.env` file.

The unified schema sets up:
- Core user accounts and credit records (`profiles`)
- Canvas collections and shared boards (`moodboards`, `shared_moodboards`)
- Brand scanner intelligence (`scan_results`)
- Multiplayer canvas sessions with Supabase Realtime (`live_sessions`)
- Semantic design vector embeddings and fast search function (`match_design_assets`)
- Full Row-Level Security (RLS) policies protecting all data

---

## Testing & Verification

Run the automated test suite and verify the production build:

```bash
# Run backend compiler check and validation suite
npm run test:backend

# Verify production Vite compilation
npm run build:frontend
```

---

## Contributing

We welcome contributions from the design and developer community! Please review our:
- [Contributing Guide](./CONTRIBUTING.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Security Policy](./SECURITY.md)

Contributions are accepted under the same noncommercial licence as the project — see [Contributions](#contributions) above.

---

## License

Inspo AI Studio is source-available under the [PolyForm Noncommercial License 1.0.0](./LICENSE). **Commercial use is not permitted without a separate licence**.

Copyright © 2026 Inspo AI. All rights reserved.
