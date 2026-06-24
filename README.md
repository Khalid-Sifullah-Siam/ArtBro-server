<div align="center">

# 🎨 ArtHub API

### A secure and feature-rich REST API for an online art marketplace

Built with **Node.js**, **Express**, and **MongoDB**

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Stripe](https://img.shields.io/badge/Stripe-Checkout-635BFF?style=flat-square&logo=stripe&logoColor=white)](https://stripe.com/)
[![License](https://img.shields.io/badge/License-ISC-blue?style=flat-square)](LICENSE)

</div>

---

## About the Project

ArtHub API is the backend service for an online art marketplace. It allows users to discover and purchase artwork, artists to publish and manage their work, and administrators to manage the platform.

The server includes secure authentication, role-based permissions, Stripe payments, subscription plans, comments, sales records, and admin analytics.

## Key Features

- 🔐 Email/password authentication with JWT
- 🔑 Google Sign-In credential verification
- 👥 User, artist, and admin roles
- 🖼️ Artwork creation, editing, deletion, search, filtering, and pagination
- ⭐ Featured artwork and top artist listings
- 💳 Secure Stripe Checkout for artwork and subscriptions
- 📦 Purchase history and artist sales records
- 💬 Comments from verified artwork buyers
- 📊 Admin dashboard analytics
- 🛡️ Password hashing with bcrypt
- 🌐 Configurable CORS support

## Technology Stack

| Technology | Purpose |
|---|---|
| Node.js | JavaScript runtime |
| Express 5 | API server and routing |
| MongoDB | Database |
| BetterAuth | User authentication |
| bcrypt | Password hashing |
| JSON Web Token | User authentication |
| Stripe | Payments and checkout |
| Google OAuth | Google account login |
| CORS | Frontend access control |

## Project Structure

```text
server/
├── index.js            # Express server, routes, and database logic
├── package.json        # Project scripts and dependencies
├── .env.example        # Environment variable template
├── .gitignore          # Files excluded from Git
└── README.md           # Project documentation
```

## Getting Started

### Prerequisites

Install or create the following before starting:

- [Node.js](https://nodejs.org/) version 18 or newer
- A [MongoDB Atlas](https://www.mongodb.com/atlas) database or local MongoDB server
- A [Stripe](https://stripe.com/) account for payment features
- A Google OAuth client ID for Google Sign-In

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd server
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create the environment file

Copy `.env.example` and name the new file `.env`.

```bash
cp .env.example .env
```

On Windows PowerShell, use:

```powershell
Copy-Item .env.example .env
```

Then update `.env` with your own credentials:

```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net
DB_NAME=arthub
BETTER_AUTH_URL=http://localhost:5000
BETTER_AUTH_SECRET=replace-with-at-least-32-random-characters
ADMIN_EMAILS=admin@arthub.com
DEFAULT_ADMIN_EMAIL=admin@arthub.com
DEFAULT_ADMIN_PASSWORD=replace-with-a-strong-password
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_CURRENCY=usd
```

> [!IMPORTANT]
> Never commit the `.env` file or share its secret values publicly.

### 4. Run the server

Development mode with automatic restart:

```bash
npm run dev
```

Production mode:

```bash
npm start
```

The API will be available at:

```text
http://localhost:5000
```

Check the server status at:

```text
GET http://localhost:5000/api/health
```

## Available Scripts

| Command | Description |
|---|---|
| `npm start` | Starts the server |
| `npm run dev` | Starts the server in watch mode |
| `npm run check` | Checks `index.js` for syntax errors |
| `npm test` | Runs the syntax check |

## Authentication

Protected routes use Better Auth's default secure session cookie. The browser
sends this cookie automatically after registration, login, or Google login.

### User Roles

| Role | Main Permissions |
|---|---|
| `user` | Browse and buy artwork, update profile, and comment after purchase |
| `artist` | All user permissions plus create and manage personal artwork |
| `admin` | Manage users, roles, artwork, transactions, and analytics |

## API Endpoints

### General

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/` | Public | API welcome response |
| `GET` | `/api/health` | Public | Server configuration and health status |

### Authentication

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/sign-up/email` | Public | Register a user or artist |
| `POST` | `/api/auth/sign-in/email` | Public | Log in with email and password |
| `POST` | `/api/auth/sign-in/social` | Public | Start Google OAuth |
| `GET` | `/api/auth/get-session` | Public | Get the current session |
| `POST` | `/api/auth/sign-out` | Private | Log out |

### Users

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/users/me` | Private | Get the current profile |
| `PATCH` | `/api/users/me` | Private | Update the current profile |
| `PATCH` | `/api/users/me/registration-role` | Private | Finish Google artist registration |
| `PATCH` | `/api/users/me/password` | Private | Change the current password |
| `GET` | `/api/users` | Admin | List users with search and pagination |
| `PATCH` | `/api/users/:id/role` | Admin | Change a user's role |

### Artworks

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/artworks` | Public | Browse, search, filter, sort, and paginate artwork |
| `GET` | `/api/artworks/featured` | Public | Get featured and recent artwork |
| `GET` | `/api/artworks/top-artists` | Public | Get artists ranked by sales |
| `GET` | `/api/artworks/:id` | Public | Get one artwork |
| `POST` | `/api/artworks` | Artist/Admin | Create an artwork |
| `PUT` | `/api/artworks/:id` | Owner/Admin | Update an artwork |
| `DELETE` | `/api/artworks/:id` | Owner/Admin | Delete an artwork |

Artwork list query examples:

```text
/api/artworks?page=1&limit=12
/api/artworks?search=painting&category=abstract
/api/artworks?minPrice=20&maxPrice=200&sort=price-low
```

Supported sorting values are `newest`, `price-low`, `price-high`, and `title`.

### Comments

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/artworks/:id/comments` | Public | Get comments for an artwork |
| `POST` | `/api/artworks/:id/comments` | Buyer | Add a comment after purchasing |
| `PATCH` | `/api/comments/:id` | Owner/Admin | Edit a comment |
| `DELETE` | `/api/comments/:id` | Owner/Admin | Delete a comment |

### Payments and Subscriptions

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/payments/artworks/:id/checkout` | Private | Create an artwork checkout session |
| `POST` | `/api/payments/subscriptions/:tier/checkout` | Private | Create a subscription checkout session |
| `POST` | `/api/payments/checkout-sessions/:sessionId/confirm` | Private | Confirm and record a paid session |

Available paid subscription tiers are `pro` and `premium`.

### Transactions

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/transactions/purchases` | Private | Record a verified artwork purchase |
| `POST` | `/api/transactions/subscriptions` | Private | Record a verified subscription |
| `GET` | `/api/transactions/me/purchases` | Private | Get personal purchase history |
| `GET` | `/api/transactions/me/sales` | Artist/Admin | Get artwork sales |
| `GET` | `/api/transactions` | Admin | Get all transactions |

### Admin

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/admin/analytics` | Admin | Get platform totals and sales chart data |

## Example Requests

### Register a user

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alex Doe",
    "email": "alex@example.com",
    "password": "strong-password",
    "confirmPassword": "strong-password",
    "role": "user"
  }'
```

### Create an artwork

```bash
curl -X POST http://localhost:5000/api/artworks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Golden Evening",
    "description": "A warm landscape painting.",
    "price": 120,
    "category": "Landscape",
    "imageUrl": "https://example.com/artwork.jpg"
  }'
```

## Database Collections

The API creates and uses these MongoDB collections:

- `users` — accounts, roles, profiles, and subscription status
- `artworks` — artwork details and artist information
- `comments` — buyer comments connected to artwork
- `transactions` — purchases and subscription payments

Required indexes are created automatically when the database first connects.

## Security Notes

- Passwords are hashed before being stored.
- Protected routes verify JWT access tokens.
- Role-based middleware limits sensitive actions.
- Stripe payments are confirmed with Stripe before transactions are recorded.
- Google ID tokens are checked against the configured client ID.
- Password hashes are removed from API responses.

For production, use strong secret values, enable HTTPS, restrict CORS to trusted frontend addresses, and store secrets in your hosting provider's environment settings.

## Deployment

This server can be deployed to services such as Render, Railway, Vercel, or another Node.js hosting platform.

Before deployment:

1. Add every required environment variable to the hosting dashboard.
2. Set `CLIENT_URL` to the deployed frontend URL.
3. Set `NODE_ENV=production`.
4. Confirm that MongoDB allows connections from the hosting service.
5. Use live Stripe credentials only when the application is ready for real payments.

## License

This project is available under the [ISC License](https://opensource.org/licenses/ISC).

---

<div align="center">

Made with ❤️ for artists and art lovers.

</div>
