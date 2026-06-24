import "./env.js";
import express from "express";
import cors from "cors";
import { ObjectId } from "mongodb";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import { auth, database, mongoClient } from "./auth.js";

const app = express();

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
const DB_NAME = process.env.DB_NAME || "arthub";
const STRIPE_CURRENCY = process.env.STRIPE_CURRENCY || "usd";
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((email) => normalizeEmail(email))
  .filter(Boolean);
const DEFAULT_ADMIN_EMAIL = normalizeEmail(process.env.DEFAULT_ADMIN_EMAIL || ADMIN_EMAILS[0] || "");
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || "";
const ROLES = ["user", "artist", "admin"];
const SUBSCRIPTION_LIMITS = { free: 3, pro: 9, premium: Infinity };
const SUBSCRIPTION_PRICES = { pro: 999, premium: 1999 };

let client = mongoClient;
let db = database;
let databaseReady = false;

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || origin === CLIENT_URL) return callback(null, true);
      return callback(new Error("This website is not allowed by CORS"));
    },
    credentials: true,
  })
);
app.all("/api/auth/*splat", toNodeHandler(auth));
app.use(express.json({ limit: "2mb" }));

function collections() {
  return {
    users: db.collection("user"),
    artworks: db.collection("artworks"),
    comments: db.collection("comments"),
    transactions: db.collection("transactions"),
  };
}

async function connectDB() {
  if (databaseReady) return db;
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing. Add it to your environment.");
  }
  await client.connect();
  await ensureIndexes();
  await ensureDefaultAdmin();
  databaseReady = true;
  return db;
}

async function ensureIndexes() {
  const { users, artworks, comments, transactions } = collections();
  await Promise.all([
    users.createIndex({ email: 1 }, { unique: true }),
    artworks.createIndex({ title: "text", artistName: "text", description: "text" }),
    artworks.createIndex({ artistId: 1, createdAt: -1 }),
    artworks.createIndex({ category: 1, price: 1 }),
    comments.createIndex({ artworkId: 1, createdAt: -1 }),
    comments.createIndex({ userId: 1, artworkId: 1 }),
    transactions.createIndex({ buyerId: 1, artworkId: 1, type: 1, status: 1 }),
    transactions.createIndex({ artistId: 1, status: 1, createdAt: -1 }),
    transactions.createIndex(
      { stripeSessionId: 1 },
      { unique: true, partialFilterExpression: { stripeSessionId: { $type: "string" } } }
    ),
  ]);
}

async function ensureDefaultAdmin() {
  if (!DEFAULT_ADMIN_EMAIL || !DEFAULT_ADMIN_PASSWORD) return;

  const { users } = collections();
  const now = new Date();
  const existing = await users.findOne({ email: DEFAULT_ADMIN_EMAIL });

  if (!existing) {
    await auth.api.signUpEmail({
      body: {
        name: "ArtHub Admin",
        email: DEFAULT_ADMIN_EMAIL,
        password: DEFAULT_ADMIN_PASSWORD,
        role: "admin",
        photoURL: "",
      },
    });
  }

  await users.updateOne(
    { email: DEFAULT_ADMIN_EMAIL },
    {
      $set: {
        role: "admin",
        subscriptionTier: "premium",
        updatedAt: now,
      },
    }
  );
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function isObjectId(value) {
  return ObjectId.isValid(value) && String(new ObjectId(value)) === String(value);
}

function oid(value) {
  if (!isObjectId(value)) {
    const error = new Error("Artwork not found");
    error.status = 400;
    throw error;
  }
  return new ObjectId(value);
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isAdminEmail(email) {
  return ADMIN_EMAILS.includes(normalizeEmail(email));
}

async function applyAdminEmailRole(user) {
  if (!user || !isAdminEmail(user.email) || user.role === "admin") return user;
  await collections().users.updateOne(
    { _id: user._id },
    { $set: { role: "admin", updatedAt: new Date() } }
  );
  return { ...user, role: "admin" };
}

function publicUser(user) {
  if (!user) return null;
  return user;
}

async function loadUserFromToken(req, required = true) {
  await connectDB();
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    if (!required) return null;
    const error = new Error("Authentication required");
    error.status = 401;
    throw error;
  }

  const userId = session.user.id;
  const user = await collections().users.findOne({ _id: oid(userId) });
  return user || { ...session.user, _id: oid(userId) };
}

function requireAuth(req, _res, next) {
  loadUserFromToken(req)
    .then((user) => {
      req.user = user;
      next();
    })
    .catch(next);
}

function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      const error = new Error("Forbidden");
      error.status = 403;
      return next(error);
    }
    return next();
  };
}

function requireFields(body, fields) {
  const missing = fields.filter((field) => body[field] === undefined || body[field] === "");
  if (missing.length) {
    const error = new Error(`Missing required field(s): ${missing.join(", ")}`);
    error.status = 400;
    throw error;
  }
}

function parsePositiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function parsePage(value) {
  const page = parseInt(value, 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function parseLimit(value, fallback = 12) {
  const limit = parseInt(value, 10);
  if (!Number.isFinite(limit) || limit <= 0) return fallback;
  return Math.min(limit, 50);
}

function userSnapshot(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    photoURL: user.photoURL || "",
  };
}

function artworkResponse(artwork) {
  if (!artwork) return null;
  return {
    ...artwork,
    artistId: String(artwork.artistId),
  };
}

async function findArtworkOr404(id) {
  const artwork = await collections().artworks.findOne({ _id: oid(id) });
  if (!artwork) {
    const error = new Error("Artwork not found");
    error.status = 404;
    throw error;
  }
  return artwork;
}

function canModifyArtwork(user, artwork) {
  return user.role === "admin" || String(artwork.artistId) === String(user._id);
}

async function hasPurchasedArtwork(userId, artworkId) {
  const purchase = await collections().transactions.findOne({
    type: "purchase",
    buyerId: oid(String(userId)),
    artworkId: oid(String(artworkId)),
    status: "paid",
  });
  return Boolean(purchase);
}

async function ensurePurchaseAllowed(user, artwork) {
  if (String(artwork.artistId) === String(user._id)) {
    const error = new Error("Artists cannot buy their own artwork");
    error.status = 400;
    throw error;
  }

  const tier = user.subscriptionTier || "free";
  const limit = SUBSCRIPTION_LIMITS[tier] ?? SUBSCRIPTION_LIMITS.free;
  if (limit === Infinity) return;

  const purchasedCount = await collections().transactions.countDocuments({
    buyerId: user._id,
    type: "purchase",
    status: "paid",
  });

  if (purchasedCount >= limit) {
    const error = new Error(`Your ${tier} subscription allows ${limit} artwork purchase(s).`);
    error.status = 403;
    throw error;
  }
}

async function createStripeCheckoutSession({ lineItem, successPath, cancelPath, metadata }) {
  if (!process.env.STRIPE_SECRET_KEY) {
    const error = new Error("STRIPE_SECRET_KEY is missing. Configure Stripe before creating checkout sessions.");
    error.status = 503;
    throw error;
  }

  const params = new URLSearchParams();
  const separator = successPath.includes("?") ? "&" : "?";
  const successUrl = `${CLIENT_URL}${successPath}${separator}session_id={CHECKOUT_SESSION_ID}`;

  params.append("mode", "payment");
  params.append("success_url", successUrl);
  params.append("cancel_url", `${CLIENT_URL}${cancelPath}`);
  params.append("line_items[0][quantity]", "1");
  params.append("line_items[0][price_data][currency]", STRIPE_CURRENCY);
  params.append("line_items[0][price_data][unit_amount]", String(lineItem.amount));
  params.append("line_items[0][price_data][product_data][name]", lineItem.name);
  if (lineItem.description) {
    params.append("line_items[0][price_data][product_data][description]", lineItem.description);
  }
  Object.entries(metadata || {}).forEach(([key, value]) => {
    params.append(`metadata[${key}]`, String(value));
  });

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error?.message || "Stripe checkout session failed");
    error.status = response.status;
    throw error;
  }
  return data;
}

async function getStripeCheckoutSession(sessionId) {
  if (!process.env.STRIPE_SECRET_KEY) {
    const error = new Error("STRIPE_SECRET_KEY is missing. Configure Stripe before confirming payments.");
    error.status = 503;
    throw error;
  }
  if (!sessionId) {
    const error = new Error("Stripe session id is required");
    error.status = 400;
    throw error;
  }

  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
    },
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error?.message || "Stripe checkout session lookup failed");
    error.status = response.status;
    throw error;
  }
  return data;
}

function requirePaidStripeSession(session) {
  if (session.payment_status !== "paid") {
    const error = new Error("Stripe payment has not been completed yet");
    error.status = 402;
    throw error;
  }
}

async function recordArtworkPurchase({ user, artwork, sessionId }) {
  const existing = await collections().transactions.findOne({
    type: "purchase",
    stripeSessionId: sessionId,
  });
  if (existing) return existing;

  await ensurePurchaseAllowed(user, artwork);

  const now = new Date();
  const transaction = {
    type: "purchase",
    status: "paid",
    amount: Number(artwork.price),
    currency: STRIPE_CURRENCY,
    artworkId: artwork._id,
    artworkTitle: artwork.title,
    artworkImage: artwork.imageUrl,
    buyerId: user._id,
    buyerName: user.name,
    buyerEmail: user.email,
    artistId: artwork.artistId,
    artistName: artwork.artistName,
    artistEmail: artwork.artistEmail,
    stripeSessionId: sessionId,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const result = await collections().transactions.insertOne(transaction);
    await collections().artworks.updateOne({ _id: artwork._id }, { $inc: { soldCount: 1 }, $set: { updatedAt: now } });
    return { ...transaction, _id: result.insertedId };
  } catch (error) {
    if (error.code === 11000) {
      return collections().transactions.findOne({ type: "purchase", stripeSessionId: sessionId });
    }
    throw error;
  }
}

async function recordSubscriptionPayment({ user, tier, sessionId }) {
  const existing = await collections().transactions.findOne({
    type: "subscription",
    stripeSessionId: sessionId,
  });
  if (existing) return existing;

  if (!["pro", "premium"].includes(tier)) {
    const error = new Error("Subscription tier must be pro or premium");
    error.status = 400;
    throw error;
  }

  const now = new Date();
  const transaction = {
    type: "subscription",
    status: "paid",
    amount: SUBSCRIPTION_PRICES[tier] / 100,
    currency: STRIPE_CURRENCY,
    tier,
    userId: user._id,
    userName: user.name,
    userEmail: user.email,
    stripeSessionId: sessionId,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const result = await collections().transactions.insertOne(transaction);
    await collections().users.updateOne(
      { _id: user._id },
      { $set: { subscriptionTier: tier, subscriptionUpdatedAt: now, updatedAt: now } }
    );
    return { ...transaction, _id: result.insertedId };
  } catch (error) {
    if (error.code === 11000) {
      return collections().transactions.findOne({ type: "subscription", stripeSessionId: sessionId });
    }
    throw error;
  }
}

app.get("/", (_req, res) => {
  res.json({
    name: "ArtHub API",
    status: "running",
    health: "/api/health",
  });
});

app.get("/api/health", asyncHandler(async (_req, res) => {
  res.json({
    ok: true,
    databaseConfigured: Boolean(process.env.MONGO_URI),
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    googleConfigured: Boolean(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ),
    timestamp: new Date().toISOString(),
  });
}));

app.get("/api/users/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.patch("/api/users/me", requireAuth, asyncHandler(async (req, res) => {
  const allowed = ["name", "photoURL", "phone", "address", "bio"];
  const update = {};
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) update[field] = req.body[field];
  });
  update.updatedAt = new Date();

  await collections().users.updateOne({ _id: req.user._id }, { $set: update });
  const user = await collections().users.findOne({ _id: req.user._id });
  res.json({ user: publicUser(user) });
}));

app.patch("/api/users/me/registration-role", requireAuth, asyncHandler(async (req, res) => {
  if (req.body.role !== "artist") {
    const error = new Error("Registration role must be artist");
    error.status = 400;
    throw error;
  }

  if (req.user.role === "user") {
    await collections().users.updateOne(
      { _id: req.user._id },
      { $set: { role: "artist", updatedAt: new Date() } }
    );
  }

  const user = await collections().users.findOne({ _id: req.user._id });
  res.json({ user: publicUser(user) });
}));

app.patch("/api/users/me/password", requireAuth, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  requireFields(req.body, ["currentPassword", "newPassword"]);
  await auth.api.changePassword({
    headers: fromNodeHeaders(req.headers),
    body: {
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    },
  });
  res.json({ message: "Password updated" });
}));

app.get("/api/users", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
  const page = parsePage(req.query.page);
  const limit = parseLimit(req.query.limit, 20);
  const search = String(req.query.search || "").trim();
  const filter = search
    ? { $or: [{ name: new RegExp(search, "i") }, { email: new RegExp(search, "i") }] }
    : {};

  const [items, total] = await Promise.all([
    collections().users.find(filter).project({ passwordHash: 0 }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
    collections().users.countDocuments(filter),
  ]);

  res.json({ items, total, page, limit, totalPages: Math.ceil(total / limit) || 1 });
}));

app.patch("/api/users/:id/role", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!ROLES.includes(role)) {
    const error = new Error("Invalid role");
    error.status = 400;
    throw error;
  }

  await collections().users.updateOne({ _id: oid(req.params.id) }, { $set: { role, updatedAt: new Date() } });
  const user = await collections().users.findOne({ _id: oid(req.params.id) }, { projection: { passwordHash: 0 } });
  res.json({ user });
}));

app.get("/api/artworks", asyncHandler(async (req, res) => {
  await connectDB();
  const page = parsePage(req.query.page);
  const limit = parseLimit(req.query.limit, 12);
  const {
    search = "",
    category,
    artistId,
    featured,
    minPrice,
    maxPrice,
    sort = "newest",
  } = req.query;

  const filter = {};
  if (category) filter.category = category;
  if (artistId) filter.artistId = oid(artistId);
  if (featured === "true") filter.featured = true;
  const min = parsePositiveNumber(minPrice, null);
  const max = parsePositiveNumber(maxPrice, null);
  if (min !== null || max !== null) {
    filter.price = {};
    if (min !== null) filter.price.$gte = min;
    if (max !== null) filter.price.$lte = max;
  }
  if (String(search).trim()) {
    const regex = new RegExp(String(search).trim(), "i");
    filter.$or = [{ title: regex }, { artistName: regex }, { description: regex }];
  }

  const sortMap = {
    newest: { createdAt: -1 },
    "price-low": { price: 1 },
    "price-high": { price: -1 },
    title: { title: 1 },
  };
  const sortBy = sortMap[sort] || sortMap.newest;

  const [items, total] = await Promise.all([
    collections().artworks.find(filter).sort(sortBy).skip((page - 1) * limit).limit(limit).toArray(),
    collections().artworks.countDocuments(filter),
  ]);

  res.json({
    items: items.map(artworkResponse),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  });
}));

app.get("/api/artworks/featured", asyncHandler(async (req, res) => {
  await connectDB();
  const limit = parseLimit(req.query.limit, 6);
  const artworks = await collections().artworks
    .find({})
    .sort({ featured: -1, createdAt: -1 })
    .limit(limit)
    .toArray();
  res.json({ items: artworks.map(artworkResponse) });
}));

app.get("/api/artworks/top-artists", asyncHandler(async (req, res) => {
  await connectDB();
  const limit = parseLimit(req.query.limit, 3);
  const items = await collections().transactions
    .aggregate([
      { $match: { type: "purchase", status: "paid" } },
      { $group: { _id: "$artistId", sales: { $sum: 1 }, revenue: { $sum: "$amount" }, artistName: { $first: "$artistName" } } },
      { $sort: { sales: -1, revenue: -1 } },
      { $limit: limit },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "artist" } },
      { $unwind: { path: "$artist", preserveNullAndEmptyArrays: true } },
      { $project: { artistId: "$_id", name: { $ifNull: ["$artist.name", "$artistName"] }, photoURL: "$artist.photoURL", sales: 1, revenue: 1 } },
    ])
    .toArray();
  res.json({ items });
}));

app.get("/api/artworks/:id", asyncHandler(async (req, res) => {
  await connectDB();
  const artwork = await findArtworkOr404(req.params.id);
  res.json({ artwork: artworkResponse(artwork) });
}));

app.post("/api/artworks", requireAuth, requireRole("artist", "admin"), asyncHandler(async (req, res) => {
  const { title, description, price, category, imageUrl, image, featured = false } = req.body;
  requireFields(req.body, ["title", "description", "price", "category"]);
  const finalImage = imageUrl || image;
  if (!finalImage) {
    const error = new Error("Missing required field(s): imageUrl");
    error.status = 400;
    throw error;
  }

  const amount = Number(price);
  if (!Number.isFinite(amount) || amount <= 0) {
    const error = new Error("Price must be a positive number");
    error.status = 400;
    throw error;
  }

  const now = new Date();
  const artwork = {
    title: String(title).trim(),
    description: String(description).trim(),
    price: amount,
    category,
    imageUrl: finalImage,
    artistId: req.user._id,
    artistName: req.user.name,
    artistEmail: req.user.email,
    featured: req.user.role === "admin" ? Boolean(featured) : false,
    soldCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collections().artworks.insertOne(artwork);
  res.status(201).json({ artwork: artworkResponse({ ...artwork, _id: result.insertedId }) });
}));

app.put("/api/artworks/:id", requireAuth, requireRole("artist", "admin"), asyncHandler(async (req, res) => {
  const artwork = await findArtworkOr404(req.params.id);
  if (!canModifyArtwork(req.user, artwork)) {
    const error = new Error("Forbidden");
    error.status = 403;
    throw error;
  }

  const allowed = ["title", "description", "category", "imageUrl", "image", "featured"];
  const update = {};
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) update[field === "image" ? "imageUrl" : field] = req.body[field];
  });
  if (req.body.price !== undefined) {
    const amount = Number(req.body.price);
    if (!Number.isFinite(amount) || amount <= 0) {
      const error = new Error("Price must be a positive number");
      error.status = 400;
      throw error;
    }
    update.price = amount;
  }
  if (req.user.role !== "admin") delete update.featured;
  update.updatedAt = new Date();

  await collections().artworks.updateOne({ _id: artwork._id }, { $set: update });
  const updated = await findArtworkOr404(req.params.id);
  res.json({ artwork: artworkResponse(updated) });
}));

app.delete("/api/artworks/:id", requireAuth, requireRole("artist", "admin"), asyncHandler(async (req, res) => {
  const artwork = await findArtworkOr404(req.params.id);
  if (!canModifyArtwork(req.user, artwork)) {
    const error = new Error("Forbidden");
    error.status = 403;
    throw error;
  }
  await collections().artworks.deleteOne({ _id: artwork._id });
  await collections().comments.deleteMany({ artworkId: artwork._id });
  res.json({ message: "Artwork deleted" });
}));

app.get("/api/artworks/:id/comments", asyncHandler(async (req, res) => {
  await connectDB();
  const artworkId = oid(req.params.id);
  const items = await collections().comments.find({ artworkId }).sort({ createdAt: -1 }).toArray();
  res.json({ items });
}));

app.post("/api/artworks/:id/comments", requireAuth, asyncHandler(async (req, res) => {
  const artwork = await findArtworkOr404(req.params.id);
  requireFields(req.body, ["comment"]);
  if (!(await hasPurchasedArtwork(req.user._id, artwork._id))) {
    const error = new Error("Only users who purchased this artwork can comment");
    error.status = 403;
    throw error;
  }

  const now = new Date();
  const comment = {
    artworkId: artwork._id,
    userId: req.user._id,
    userName: req.user.name,
    userPhotoURL: req.user.photoURL || "",
    comment: String(req.body.comment).trim(),
    createdAt: now,
    updatedAt: now,
  };
  const result = await collections().comments.insertOne(comment);
  res.status(201).json({ comment: { ...comment, _id: result.insertedId } });
}));

app.patch("/api/comments/:id", requireAuth, asyncHandler(async (req, res) => {
  requireFields(req.body, ["comment"]);
  const comment = await collections().comments.findOne({ _id: oid(req.params.id) });
  if (!comment) {
    const error = new Error("Comment not found");
    error.status = 404;
    throw error;
  }
  if (req.user.role !== "admin" && String(comment.userId) !== String(req.user._id)) {
    const error = new Error("Forbidden");
    error.status = 403;
    throw error;
  }
  await collections().comments.updateOne(
    { _id: comment._id },
    { $set: { comment: String(req.body.comment).trim(), updatedAt: new Date() } }
  );
  const updated = await collections().comments.findOne({ _id: comment._id });
  res.json({ comment: updated });
}));

app.delete("/api/comments/:id", requireAuth, asyncHandler(async (req, res) => {
  const comment = await collections().comments.findOne({ _id: oid(req.params.id) });
  if (!comment) {
    const error = new Error("Comment not found");
    error.status = 404;
    throw error;
  }
  if (req.user.role !== "admin" && String(comment.userId) !== String(req.user._id)) {
    const error = new Error("Forbidden");
    error.status = 403;
    throw error;
  }
  await collections().comments.deleteOne({ _id: comment._id });
  res.json({ message: "Comment deleted" });
}));

app.post("/api/payments/artworks/:id/checkout", requireAuth, asyncHandler(async (req, res) => {
  const artwork = await findArtworkOr404(req.params.id);
  await ensurePurchaseAllowed(req.user, artwork);

  const session = await createStripeCheckoutSession({
    lineItem: {
      name: artwork.title,
      description: `Original artwork by ${artwork.artistName}`,
      amount: Math.round(Number(artwork.price) * 100),
    },
    successPath: `/payment/success?type=purchase&artworkId=${artwork._id}`,
    cancelPath: `/artworks/${artwork._id}`,
    metadata: {
      type: "purchase",
      artworkId: artwork._id,
      buyerId: req.user._id,
      artistId: artwork.artistId,
    },
  });

  res.json({ url: session.url, sessionId: session.id });
}));

app.post("/api/payments/subscriptions/:tier/checkout", requireAuth, asyncHandler(async (req, res) => {
  const tier = req.params.tier;
  if (!["pro", "premium"].includes(tier)) {
    const error = new Error("Subscription tier must be pro or premium");
    error.status = 400;
    throw error;
  }

  const session = await createStripeCheckoutSession({
    lineItem: {
      name: `ArtHub ${tier} subscription`,
      description: `${tier} subscription upgrade`,
      amount: SUBSCRIPTION_PRICES[tier],
    },
    successPath: `/payment/success?type=subscription&tier=${tier}`,
    cancelPath: "/dashboard",
    metadata: {
      type: "subscription",
      tier,
      userId: req.user._id,
    },
  });

  res.json({ url: session.url, sessionId: session.id });
}));

app.post("/api/payments/checkout-sessions/:sessionId/confirm", requireAuth, asyncHandler(async (req, res) => {
  const session = await getStripeCheckoutSession(req.params.sessionId);
  requirePaidStripeSession(session);

  const metadata = session.metadata || {};
  if (metadata.type === "purchase") {
    if (String(metadata.buyerId) !== String(req.user._id)) {
      const error = new Error("Stripe session does not belong to this user");
      error.status = 403;
      throw error;
    }

    const artwork = await findArtworkOr404(metadata.artworkId);
    if (String(metadata.artistId) !== String(artwork.artistId)) {
      const error = new Error("Stripe session artwork metadata does not match");
      error.status = 400;
      throw error;
    }

    const transaction = await recordArtworkPurchase({
      user: req.user,
      artwork,
      sessionId: session.id,
    });
    return res.status(201).json({ type: "purchase", transaction });
  }

  if (metadata.type === "subscription") {
    if (String(metadata.userId) !== String(req.user._id)) {
      const error = new Error("Stripe session does not belong to this user");
      error.status = 403;
      throw error;
    }

    const transaction = await recordSubscriptionPayment({
      user: req.user,
      tier: metadata.tier,
      sessionId: session.id,
    });
    const user = await collections().users.findOne({ _id: req.user._id });
    return res.status(201).json({ type: "subscription", transaction, user: publicUser(user) });
  }

  const error = new Error("Unsupported Stripe checkout session");
  error.status = 400;
  throw error;
}));

app.post("/api/transactions/purchases", requireAuth, asyncHandler(async (req, res) => {
  const session = await getStripeCheckoutSession(req.body.sessionId);
  requirePaidStripeSession(session);
  const metadata = session.metadata || {};
  if (metadata.type !== "purchase" || String(metadata.buyerId) !== String(req.user._id)) {
    const error = new Error("Stripe session does not match this purchase");
    error.status = 403;
    throw error;
  }

  const artworkId = req.body.artworkId || req.body.id;
  requireFields({ artworkId }, ["artworkId"]);
  const artwork = await findArtworkOr404(artworkId);
  if (String(metadata.artworkId) !== String(artwork._id)) {
    const error = new Error("Stripe session does not match this artwork");
    error.status = 403;
    throw error;
  }

  const transaction = await recordArtworkPurchase({
    user: req.user,
    artwork,
    sessionId: session.id,
  });
  res.status(201).json({ transaction });
}));

app.post("/api/transactions/subscriptions", requireAuth, asyncHandler(async (req, res) => {
  const session = await getStripeCheckoutSession(req.body.sessionId);
  requirePaidStripeSession(session);
  const metadata = session.metadata || {};
  if (metadata.type !== "subscription" || String(metadata.userId) !== String(req.user._id)) {
    const error = new Error("Stripe session does not match this subscription");
    error.status = 403;
    throw error;
  }

  const tier = req.body.tier || metadata.tier;
  if (String(metadata.tier) !== String(tier)) {
    const error = new Error("Stripe session does not match this subscription tier");
    error.status = 403;
    throw error;
  }

  const transaction = await recordSubscriptionPayment({
    user: req.user,
    tier,
    sessionId: session.id,
  });
  const user = await collections().users.findOne({ _id: req.user._id });
  res.status(201).json({ transaction, tier, user: publicUser(user) });
}));

app.get("/api/transactions/me/purchases", requireAuth, asyncHandler(async (req, res) => {
  const items = await collections().transactions
    .find({ type: "purchase", buyerId: req.user._id, status: "paid" })
    .sort({ createdAt: -1 })
    .toArray();
  res.json({ items });
}));

app.get("/api/transactions/me/sales", requireAuth, requireRole("artist", "admin"), asyncHandler(async (req, res) => {
  const filter = req.user.role === "admin"
    ? { type: "purchase", status: "paid" }
    : { type: "purchase", artistId: req.user._id, status: "paid" };
  const items = await collections().transactions.find(filter).sort({ createdAt: -1 }).toArray();
  res.json({ items });
}));

app.get("/api/transactions", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
  const page = parsePage(req.query.page);
  const limit = parseLimit(req.query.limit, 20);
  const [items, total] = await Promise.all([
    collections().transactions.find({}).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
    collections().transactions.countDocuments({}),
  ]);
  res.json({ items, total, page, limit, totalPages: Math.ceil(total / limit) || 1 });
}));

app.get("/api/admin/analytics", requireAuth, requireRole("admin"), asyncHandler(async (_req, res) => {
  const { users, artworks, transactions } = collections();
  const [totalUsers, totalArtists, totalArtworks, soldStats, salesByCategory, monthlySales] = await Promise.all([
    users.countDocuments({}),
    users.countDocuments({ role: "artist" }),
    artworks.countDocuments({}),
    transactions.aggregate([
      { $match: { status: "paid" } },
      { $group: { _id: null, sold: { $sum: { $cond: [{ $eq: ["$type", "purchase"] }, 1, 0] } }, revenue: { $sum: "$amount" } } },
    ]).toArray(),
    transactions.aggregate([
      { $match: { type: "purchase", status: "paid" } },
      { $lookup: { from: "artworks", localField: "artworkId", foreignField: "_id", as: "artwork" } },
      { $unwind: { path: "$artwork", preserveNullAndEmptyArrays: true } },
      { $group: { _id: { $ifNull: ["$artwork.category", "Unknown"] }, value: { $sum: 1 } } },
      { $project: { category: "$_id", value: 1, _id: 0 } },
    ]).toArray(),
    transactions.aggregate([
      { $match: { status: "paid" } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, revenue: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { month: "$_id", revenue: 1, count: 1, _id: 0 } },
    ]).toArray(),
  ]);

  const stats = soldStats[0] || { sold: 0, revenue: 0 };
  res.json({
    totals: {
      users: totalUsers,
      artists: totalArtists,
      artworks: totalArtworks,
      artworksSold: stats.sold,
      revenue: stats.revenue,
    },
    charts: {
      salesByCategory,
      monthlySales,
    },
  });
}));

app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  res.status(status).json({
    message: error.message || "Internal server error",
    status,
  });
});

process.on("SIGINT", async () => {
  if (client) await client.close();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`ArtHub API running on port ${PORT}`);
});
