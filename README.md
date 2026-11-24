# Future Robins

Future Robins is a learning and assessment app for students, teachers, and learning communities. It combines structured quizzes and exams with guided skill tracks, classroom tools, social competition, and progress rewards. Learners can practice independently, join a teacher-led class, or challenge other players; educators can organize learning material and follow student progress.

## The story

Learning often gets split between static course material, disconnected tests, and progress reports that arrive too late to help. Future Robins brings those pieces into one place. A learner starts with a subject or skill track, works through quizzes and challenges, reviews results, and sees progress build over time through experience points, levels, streaks, badges, and leaderboard standing. Teachers can organize classes, assign work, and use the same activity and progress data to guide the next lesson. Live classrooms and head-to-head games add a shared, real-time way to practice.

The goal is to make assessment part of the learning journey: practice, understand the result, identify what to work on next, and keep going.

## Features

### Learning and assessment

- Browse available quizzes and subjects from the dashboard.
- Take quizzes and exams with timed or untimed settings, shuffled questions, passing scores, and optional immediate feedback.
- Use several question formats: multiple choice, short text answers, code-output questions, ordering, matching, compiler questions, and Blockly-style block questions.
- Work through question pools that select a smaller, non-repeating set of questions for each attempt.
- Review completed attempts and results, including answers, scores, and explanations where provided.
- Render mathematical notation in learning content.
- Follow skill tracks made up of modules and submodules, with track and module progress.

### Teacher and classroom tools

- Create and manage classes, invite learners, and organize students into a shared learning space.
- Assign quizzes, homework, and exams, then view class activity and performance data.
- Use teacher tools for quiz revision and AI-assisted learning content workflows.
- Host live classroom quiz sessions. Participants can join a room using its PIN or invite link, and answer as the host runs the session.
- Review learner attempts and, where enabled, inspect exam integrity telemetry.

### Games, community, and motivation

- Earn experience points, levels, coins, streaks, and achievement badges through platform activity.
- Compare progress on leaderboards and build a learner profile.
- Take daily challenges, spend coins in the shop, and use supported power-ups.
- Join tournaments and asynchronous challenges, or play real-time versus quiz games.
- Connect with other learners through friends, direct chat, clans, and notifications.
- Use the platform's arcade activities for an additional way to earn progress.

### Content creation and insights

- Generate or refine quizzes and learning material with the AI tools when a Groq API key is configured.
- Import and export supported quiz, track, tournament, and badge data using the JSON templates in [`client/public/samples`](client/public/samples).
- Use presentations and teaching tools to connect lesson material with quizzes and class activity.
- View learner analytics and staff-facing quiz, attempt, and class insights.
- Export supported result reports as PDF or CSV from the relevant views.

### Exams and accessibility

- Configure exams with optional fullscreen requirements, clipboard restrictions, and tab-switch limits.
- Record supported focus, tab-switch, and copy/paste events as attempt telemetry for review.
- Use keyboard navigation and responsive layouts in supported quiz flows.
- Install the frontend as a Progressive Web App where the browser supports it. Some client state can use local storage; the app still relies on the API for shared accounts, quizzes, classes, and saved results.

## Application areas

| Area | Route |
| --- | --- |
| Dashboard and quiz browsing | `/` or `/quizzes` |
| Sign in / create account | `/login` / `/register` |
| Skill tracks | `/tracks` |
| Leaderboard | `/leaderboard` |
| Tournaments | `/tournaments` |
| Live classroom | `/live-arena` or `/classroom` |
| Profile | `/profile` |
| Daily challenge | `/daily` |
| Social and clans | `/social` / `/clans` |
| Analytics | `/analytics` |
| Shop | `/shop` |
| Administration | `/admin` |
| AI JSON Studio | `/json-studio` (staff access) |

Some routes require a signed-in account; administrative and staff tools require the appropriate role.

## Technology

| Layer | Main technologies |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, React Router |
| API | Node.js, Express 5, Mongoose |
| Data | MongoDB |
| Real-time features | Socket.IO |
| AI features | Groq SDK (optional; configured with `GROQ_API_KEY`) |
| Authentication | JWT, bcrypt, optional Google OAuth client |
| Coding questions | Judge0-compatible API configuration; AI evaluation is also used in supported flows |
| PWA and reports | `vite-plugin-pwa`, jsPDF, CSV exports |

## Getting started

### Requirements

- Node.js 20 or newer and npm.
- A running MongoDB instance or MongoDB Atlas database.
- Optional: Groq API credentials for AI features, Google OAuth credentials for Google sign-in, and Judge0 credentials for remote code execution.

### Install

```bash
git clone <repository-url>
cd "Quiz Platform"
npm install
npm --prefix client install
```

### Configure environment

Copy `.env.example` to `.env` in the repository root. At minimum, configure a database URI and a JWT secret for local development:

```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
VITE_API_URL=/api
MONGODB_URI=mongodb://127.0.0.1:27017/quiz-platform
JWT_SECRET=use-a-long-random-development-secret
```

The app can start in development without optional integrations, but features that depend on those services will not work until configured. Common optional variables include:

| Variable | Used for |
| --- | --- |
| `GROQ_API_KEY`, `GROQ_MODEL` | AI quiz, content, and supported answer-evaluation workflows |
| `VITE_GOOGLE_CLIENT_ID` | Google sign-in in the frontend |
| `JUDGE0_API_KEY`, `JUDGE0_API_URL`, `JUDGE0_API_HOST` | Remote code execution for supported compiler questions |
| `VITE_SOCKET_URL`, `VITE_ENABLE_SOCKET` | Socket.IO connection settings for live features |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` or `SMTP_*` | Transactional email delivery |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Optional client-side Supabase integration |

See [`.env.example`](.env.example) for the full list and notes. Do not commit `.env` or real credentials.

### Run locally

Start the API and Vite frontend together:

```bash
npm run dev
```

Open the frontend at <http://localhost:5173>. The API listens on port 5000 by default. You can also start each process separately:

```bash
npm run server
npm run client
```

### Seed data

Seed commands are available for development databases. Configure the database connection before running them, and review the seed scripts before using them against a shared database.

```bash
npm run seed:local   # local development data
npm run seed         # database seed data
npm run seed:admin   # initial admin account, configured through .env
```

## Project layout

```text
.
├── api/                 # Serverless API entry point
├── client/
│   ├── public/samples/  # Import templates and sample learning data
│   └── src/
│       ├── components/ # Quiz, teacher, social, admin, and game UI
│       ├── context/    # Authentication, data, notifications, sockets
│       ├── pages/      # Routed application screens
│       ├── lib/        # API, OAuth, and integration helpers
│       └── types/      # Shared frontend types
├── scripts/             # Database seed and maintenance scripts
└── server/
    ├── controllers/    # API business logic
    ├── middleware/     # Auth, validation, and database middleware
    ├── models/         # MongoDB/Mongoose schemas
    ├── routes/         # Express API routes
    └── services/       # Progress, email, badge, and evaluation services
```

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the API and frontend for development |
| `npm start` | Start the Node.js server |
| `npm run build` | Type-check and build the frontend |
| `npm run lint` | Run ESLint across the repository |
| `npm run preview` | Preview the production frontend build |
| `npm run seed:local` | Seed local development data |

## Deployment notes

The repository includes a Vercel configuration and a serverless API entry point, while the server can also run as a persistent Node.js process. Configure the deployment target with the database URI, a strong `JWT_SECRET`, the frontend/API origin settings, and credentials for any optional integrations you enable. Socket.IO live sessions require a persistent server that supports WebSocket connections; configure `VITE_SOCKET_URL` to point the client to that server. Check the hosting platform's current build and routing requirements when deploying.

## Contributing

1. Create a focused branch for your change.
2. Install dependencies and configure a development database.
3. Keep UI, API validation, and data-model changes consistent when adding features.
4. Run the relevant build or lint command before opening a pull request.

Please avoid including secrets, user data, or production database content in commits or sample files.
