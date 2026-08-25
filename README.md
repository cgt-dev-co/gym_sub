# Gym Subscription Management System

A full-stack gym subscription management system with user authentication, subscription plans, and payment processing. Built for small to medium gyms that need a self-hosted solution to manage member signups, recurring billing, and subscription lifecycles without relying on third-party membership platforms.

## Tech Stack

- **Frontend**: React 18, Vite, TailwindCSS — single-page app with protected routes, context-based auth state, and a responsive dashboard
- **Backend**: Node.js, Express — REST API with JWT cookie-based authentication, role-based access control (USER / ADMIN), and Stripe webhook handling
- **Database**: MySQL with Prisma ORM — relational schema covering users, plans, subscriptions, payments, and a token blacklist for logout
- **Payment**: Stripe — payment intents flow with server-side webhook confirmation; no card data ever touches the backend
- **Scheduling**: node-cron — background jobs for periodic maintenance tasks running on configurable timezone schedules

## Features

- **User authentication and authorization** — cookie-based JWT auth with httpOnly flags, token blacklisting on logout, and an in-memory user cache (LRU, 5-minute TTL) that stores user records for quick access; on every request, cached role and suspension status are validated against the live database to detect privilege changes immediately
- **Subscription plan management** — admin-controlled plans with MONTHLY, QUARTERLY, and YEARLY durations; plans can be activated or deactivated without deleting historical data
- **Payment processing with Stripe** — client-side Stripe Elements collects card details; the server creates a PaymentIntent and confirms subscription activation only after the webhook confirms payment success
- **User dashboard** — members can view their active plan, upcoming renewal date, and full payment history in one place
- **Profile management** — users can update their name, phone, and address; email changes are not currently supported to avoid re-verification complexity
- **Graceful shutdown** — SIGTERM and SIGINT signal handlers clear background intervals before the process exits, making the server safe to run in Docker and Kubernetes environments
- **Token cleanup** — an hourly background task purges expired JWT blacklist entries to keep the token table from growing unbounded

## Project Structure

```
gym-subscription-main/
├── client/                        # React frontend (Vite)
│   └── src/
│       ├── components/            # Layout, ProtectedRoute, LoadingSpinner
│       ├── context/               # AuthContext — global auth state
│       ├── pages/                 # Login, Register, Dashboard, Plans, etc.
│       └── services/api.js        # Axios instance with base URL and credentials
├── server/
│   ├── prisma/schema.prisma       # Database schema (User, Plan, Subscription, Payment, TokenBlacklist)
│   └── server/src/
│       ├── config/                # Prisma client singleton, database seed
│       ├── controllers/           # auth, user, plan, subscription, payment
│       ├── jobs/cronJobs.js       # Scheduled background tasks
│       ├── middleware/            # auth (JWT + cache), error handler, validation
│       └── routes/                # Express routers wiring controllers to paths
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+
- MySQL 8+ database running locally or remotely
- A Stripe account (test mode keys are fine for development)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd gym-subscription-main
   ```

2. **Install server dependencies**
   ```bash
   cd server
   npm install
   ```

3. **Install client dependencies**
   ```bash
   cd ../client
   npm install
   ```

4. **Configure environment variables**

   Copy the example files and fill in your values:
   ```bash
   cp server/.env.example server/.env
   cp client/.env.example client/.env
   ```

   Key variables in `server/.env`:
   | Variable | Description |
   |---|---|
   | `DATABASE_URL` | MySQL connection string (`mysql://user:pass@host:3306/db`) |
   | `JWT_SECRET` | Random secret string for signing JWTs |
   | `JWT_EXPIRES_IN` | Token lifetime, e.g. `7d` |
   | `STRIPE_SECRET_KEY` | Stripe secret key (`sk_test_...`) |
   | `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (`whsec_...`) |
   | `FRONTEND_URL` | Client origin for CORS, e.g. `http://localhost:5173` |

5. **Run database migrations and seed**
   ```bash
   cd server
   npx prisma migrate dev
   node setup-database.js
   ```

6. **Start the development servers**

   Backend (from `server/`):
   ```bash
   npm run dev
   ```

   Frontend (from `client/`):
   ```bash
   npm run dev
   ```

   The API runs on `http://localhost:5000` and the client on `http://localhost:5173` by default.

## API Endpoints

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Create a new user account |
| POST | `/api/auth/login` | Log in and receive a JWT cookie |
| POST | `/api/auth/logout` | Revoke the current token |
| GET | `/api/auth/me` | Get the current user with active subscription |

### Plans
| Method | Path | Description |
|---|---|---|
| GET | `/api/plans` | List all active plans |
| POST | `/api/plans` | Create a plan (admin only) |
| PUT | `/api/plans/:id` | Update a plan (admin only) |
| DELETE | `/api/plans/:id` | Deactivate a plan (admin only) |

### Subscriptions
| Method | Path | Description |
|---|---|---|
| GET | `/api/subscriptions/my` | Get current user's active subscription |
| GET | `/api/subscriptions/history` | Get full subscription history |
| POST | `/api/subscriptions/purchase` | Activate a subscription after payment |
| POST | `/api/subscriptions/renew` | Renew an existing subscription |
| POST | `/api/subscriptions/cancel` | Cancel the active subscription |

### Payments
| Method | Path | Description |
|---|---|---|
| POST | `/api/payments/create-intent` | Create a Stripe PaymentIntent |
| POST | `/api/payments/webhook` | Stripe webhook receiver (raw body required) |
| GET | `/api/payments/history` | Get current user's payment history |

## Running Tests

```bash
# Server tests
cd server
npm test

# Client tests
cd client
npm test
```

## License

MIT
