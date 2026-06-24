<div align="center">

# 🎨 ArtHub Server

### Backend API for the ArtHub Online Art Marketplace

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.x-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Stripe](https://img.shields.io/badge/Stripe-Checkout-635BFF?logo=stripe&logoColor=white)](https://stripe.com/)
[![License](https://img.shields.io/badge/License-ISC-blue.svg)](#license)

**Secure authentication · Role-based access · Artwork management · Payments · Analytics**

</div>

---

ArtHub Server is a REST API that connects art buyers, independent artists, and administrators. It manages authentication, artworks, purchased-user comments, Stripe payments, subscriptions, transaction history, and dashboard analytics.

## Table of Contents

- [Live Link](https://art-bro-client.vercel.app)
- [Highlights](#highlights)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Authentication and Roles](#authentication-and-roles)
- [API Reference](#api-reference)
- [Payment Flow](#payment-flow)
- [Security](#security)
- [Deployment Checklist](#deployment-checklist)

## Live Links

- Live API: `https://art-bro-server.vercel.app`
- Client Application: `https://art-bro-client.vercel.app`
- Client Repository: `https://github.com/Khalid-Sifullah-Siam/ArtBro-client`

## Highlights

| Area | Features |
| --- | --- |
| 🔐 Authentication | Email/password login, Google login, JWT protection |
| 👥 Authorization | Separate permissions for users, artists, and admins |
| 🖼️ Artworks | Public browsing, search, filtering, sorting, pagination, and artist CRUD |
| 💬 Comments | Purchased users can create, edit, and delete comments |
| 💳 Payments | Stripe Checkout for artwork purchases and subscriptions |
| 📊 Dashboards | Purchase history, sales history, transactions, and admin analytics |
| 🛡️ Security | Password hashing, ownership checks, token validation, and environment secrets |
| ⚡ Performance | MongoDB indexes, pagination, projections, and request limits |

## Technology Stack

| Technology | Responsibility |
| --- | --- |
| **Node.js** | JavaScript runtime |
| **Express.js** | REST API server and middleware |
| **MongoDB** | Users, artworks, comments, and transactions |
| **JWT** | Stateless access tokens |
| **bcrypt** | Secure password hashing |
| **Stripe Checkout** | Artwork and subscription payments |
| **Google Identity Services** | Google credential authentication |
| **CORS** | Controlled frontend access |
| **BetterAuth** | Email and Password login|

## How It Works

```text
Next.js Client
      │
      │  REST API + JWT
      ▼
Express Server ─────────► Google Token Verification
      │
      ├─────────────────► Stripe Checkout
      │
      ▼
MongoDB
├── users
├── artworks
├── comments
└── transactions
```

## Project Structure

```text
server (1)/
├── .env.example
├── index.js
├── package.json
├── package-lock.json
└── README.md
```

The project intentionally uses a simple structure so that the application flow is easy to understand.

## Getting Started

### Prerequisites

Install the following tools before running the server:

- Node.js 18 or newer
- npm
- MongoDB Atlas account or a local MongoDB database
- Stripe account for payment testing
- Google OAuth Web Client ID

### Quick Installation

1. Open the server folder:

```bash
cd "server (1)"
```

2. Install the dependencies:

```bash
npm install
```

3. Copy the example environment file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

4. Add your own environment variable values.

5. Start the development server:

```bash
npm run dev
```

The API should now be available at:

```text
http://localhost:5000
```

Check its status:

```text
GET http://localhost:5000/api/health
```

## Environment Variables

```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net
DB_NAME=arthub

JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=7d

ADMIN_EMAILS=admin@example.com
DEFAULT_ADMIN_EMAIL=admin@example.com
DEFAULT_ADMIN_PASSWORD=replace-with-a-strong-password

GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com

STRIPE_SECRET_KEY=sk_test_replace_me
STRIPE_CURRENCY=usd
```

| Variable | Description |
| --- | --- |
| `PORT` | Port used by the Express server |
| `NODE_ENV` | Application environment |
| `CLIENT_URL` | Frontend URL used by CORS and Stripe redirects |
| `MONGO_URI` | MongoDB connection string |
| `DB_NAME` | MongoDB database name |
| `JWT_SECRET` | Secret used to sign JWT tokens |
| `JWT_EXPIRES_IN` | JWT lifetime, such as `7d` |
| `ADMIN_EMAILS` | Comma-separated list of admin email addresses |
| `DEFAULT_ADMIN_EMAIL` | Email used to create or update the default admin |
| `DEFAULT_ADMIN_PASSWORD` | Password for the default admin account |
| `GOOGLE_CLIENT_ID` | Google OAuth Web Client ID |
| `STRIPE_SECRET_KEY` | Stripe secret API key |
| `STRIPE_CURRENCY` | Stripe payment currency, default `usd` |

> Never commit the real `.env` file, database password, JWT secret, or Stripe secret key.

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Starts the server with Node watch mode |
| `npm start` | Starts the production server |
| `npm run check` | Checks the JavaScript syntax |
| `npm test` | Runs the syntax check |

## Authentication and Roles

Protected endpoints expect a JWT token in the request header:

```http
Authorization: Bearer YOUR_JWT_TOKEN
```

| Role | Main Permissions |
| --- | --- |
| `user` | Purchase artworks, upgrade subscriptions, manage a profile, and comment after purchase |
| `artist` | Manage owned artworks, update a profile, and view sales |
| `admin` | Manage users, roles, artworks, transactions, featured content, and analytics |

## API Reference

### General

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| GET | `/` | Public | Shows a basic API message |
| GET | `/api/health` | Public | Checks database, Stripe, and Google configuration |

### Authentication

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Public | Registers a user or artist |
| POST | `/api/auth/login` | Public | Logs in with email and password |
| POST | `/api/auth/google` | Public | Logs in with a Google credential |
| GET | `/api/auth/me` | Private | Returns the authenticated user |

### User Profile

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| GET | `/api/users/me` | Private | Gets the current profile |
| PATCH | `/api/users/me` | Private | Updates the current profile |
| PATCH | `/api/users/me/password` | Private | Changes the current password |
| GET | `/api/users` | Admin | Gets users with search and pagination |
| PATCH | `/api/users/:id/role` | Admin | Changes a user's role |

### Artworks

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| GET | `/api/artworks` | Public | Gets artworks with filters and pagination |
| GET | `/api/artworks/featured` | Public | Gets featured or latest artworks |
| GET | `/api/artworks/top-artists` | Public | Gets artists with the most sales |
| GET | `/api/artworks/:id` | Public | Gets one artwork |
| POST | `/api/artworks` | Artist/Admin | Creates an artwork |
| PUT | `/api/artworks/:id` | Owner/Admin | Updates an artwork |
| DELETE | `/api/artworks/:id` | Owner/Admin | Deletes an artwork |

Supported artwork query parameters:

```text
search
category
artistId
minPrice
maxPrice
sort
page
limit
```

Supported sort values:

```text
newest
price-low
price-high
title
```

### Comments

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| GET | `/api/artworks/:id/comments` | Public | Gets artwork comments |
| POST | `/api/artworks/:id/comments` | Purchased User | Creates a comment |
| PATCH | `/api/comments/:id` | Owner/Admin | Updates a comment |
| DELETE | `/api/comments/:id` | Owner/Admin | Deletes a comment |

Only a user who has purchased an artwork can post a comment on it.

### Payments and Subscriptions

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| POST | `/api/payments/artworks/:id/checkout` | Private | Creates an artwork Stripe Checkout session |
| POST | `/api/payments/subscriptions/:tier/checkout` | Private | Creates a subscription Checkout session |
| POST | `/api/payments/checkout-sessions/:sessionId/confirm` | Private | Confirms a successful Stripe session |

Available subscription tiers:

| Tier | Purchase Limit | Price |
| --- | ---: | ---: |
| Free | 3 artworks | $0 |
| Pro | 9 artworks | $9.99 |
| Premium | Unlimited | $19.99 |

### Transactions and Analytics

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| GET | `/api/transactions/me/purchases` | Private | Gets personal purchase history |
| GET | `/api/transactions/me/sales` | Artist/Admin | Gets artwork sales |
| GET | `/api/transactions` | Admin | Gets all transactions |
| GET | `/api/admin/analytics` | Admin | Gets totals and chart data |

## Payment Flow

```text
Client requests checkout
          │
          ▼
Server validates user, artwork, and purchase limit
          │
          ▼
Stripe hosted checkout
          │
          ▼
Client success page sends the session ID
          │
          ▼
Server verifies payment and saves the transaction
```

For subscription payments, the final step also updates the user's subscription tier.

## Security

- Passwords are never stored as plain text.
- JWT tokens expire after the configured lifetime.
- Protected endpoints validate authentication and role permissions.
- Artwork ownership is checked before updates and deletion.
- Google credentials must match the configured client ID.
- Stripe sessions are verified before transactions are stored.
- Secrets and database credentials are loaded from environment variables.
- MongoDB unique and query indexes help protect data integrity.

## Deployment Checklist

- Add all environment variables to the hosting platform.
- Set `CLIENT_URL` to the deployed frontend URL.
- Allow the frontend URL in the Google OAuth configuration.
- Use the deployed API URL in the client environment variables.
- Confirm that MongoDB allows connections from the server host.
- Test `/api/health` after deployment.
- Test registration, login, Google login, payments, and route reloads.
- Confirm that production requests do not return CORS, 404, or 504 errors.

## License

This project uses the ISC License.

---

<div align="center">

Built for artists, collectors, and the stories behind original art.

</div>
