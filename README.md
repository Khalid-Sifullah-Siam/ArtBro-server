# ArtHub Backend

Express and MongoDB API for the ArtHub online art marketplace.

## Live URL

- Server: add deployed server URL here

## Setup

1. Copy `.env.example` to `.env`.
2. Fill in MongoDB, JWT, client, and Stripe values.
3. Run `npm install`.
4. Run `npm run dev` for local development or `npm start` for production.

## Main API Areas

- Auth: register, login, Google OAuth handoff, JWT profile.
- Artworks: public browse/search/filter/sort/pagination, artist CRUD, featured artworks, top artists.
- Comments: purchased-user-only creation, owner edit/delete.
- Transactions: artwork purchases, subscription upgrades, purchase and sales history.
- Admin: user role management, artwork moderation, all transactions, analytics.

## Packages Used

- `express`
- `mongodb`
- `jsonwebtoken`
- `bcrypt`
- `cors`

## Environment Variables

- `PORT`: server port.
- `CLIENT_URL`: allowed frontend origin and Stripe redirect base.
- `MONGO_URI`: MongoDB connection string.
- `DB_NAME`: MongoDB database name.
- `JWT_SECRET`: JWT signing secret.
- `JWT_EXPIRES_IN`: token lifetime, default `7d`.
- `ADMIN_EMAILS`: comma-separated admin email allowlist.
- `DEFAULT_ADMIN_EMAIL`: admin account email created or kept as admin automatically.
- `DEFAULT_ADMIN_PASSWORD`: password for the seeded admin account.
- `GOOGLE_CLIENT_ID`: Google OAuth client ID used to verify Google login ID tokens.
- `STRIPE_SECRET_KEY`: Stripe secret key.
- `STRIPE_CURRENCY`: Stripe checkout currency, default `usd`.
