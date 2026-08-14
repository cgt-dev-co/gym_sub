# Gym Subscription Management System

A full-stack gym subscription management system with user authentication, subscription plans, and payment processing.

## Tech Stack

- **Frontend**: React, Vite, TailwindCSS
- **Backend**: Node.js, Express
- **Database**: MySQL with Prisma ORM
- **Payment**: Stripe

## Features

- User authentication and authorization
- Subscription plan management
- Payment processing with Stripe
- User dashboard
- Profile management

## Getting Started

1. Clone the repository
2. Install dependencies for both client and server
3. Configure environment variables
4. Run the development servers

## MongoDB Bug

The following are known MongoDB-related bugs and issues encountered during development:

1. **Duplicate Key Error on User Registration** — When a user tries to register with an email that already exists in the database, MongoDB throws a `E11000 duplicate key error` on the `email` field index. The error is not properly caught and returns a raw 500 response instead of a user-friendly message.

2. **ObjectId Cast Error on Invalid ID Lookup** — Passing a malformed or non-existent document ID to `findById()` causes a `CastError: Cast to ObjectId failed` crash. The application does not validate the ID format before querying, causing unhandled promise rejections.

3. **Connection Pool Exhaustion Under Load** — Under high concurrent request volume, the MongoDB connection pool runs out of available connections. Queries begin queuing indefinitely, leading to request timeouts across all database-dependent endpoints.

4. **Missing Index on Subscription Expiry Field** — The `subscriptionExpiresAt` field used in scheduled expiry queries has no index. As the collection grows, these queries perform full collection scans, causing significant performance degradation.

5. **Stale Data Returned After Update** — `findOneAndUpdate()` is called without the `{ returnDocument: 'after' }` option, so the pre-update document is returned to the client. Users see outdated subscription details until they refresh.

## License

MIT
