import "./env.js";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { MongoClient } from "mongodb";

const mongoClient = new MongoClient(process.env.MONGO_URI || "mongodb://localhost:27017", {
  serverSelectionTimeoutMS: 8000,
});

const database = mongoClient.db(process.env.DB_NAME || "arthub");
const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
const isProduction = process.env.NODE_ENV === "production";
const adminEmails = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export const auth = betterAuth({
  appName: "ArtHub",
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:5000",
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [clientUrl],
  database: mongodbAdapter(database, {
    client: mongoClient,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  advanced: {
    defaultCookieAttributes: {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
    },
  },
  socialProviders: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
      }
    : {},
  user: {
    additionalFields: {
      role: {
        type: ["user", "artist", "admin"],
        required: false,
        defaultValue: "user",
      },
      photoURL: {
        type: "string",
        required: false,
        defaultValue: "",
      },
      subscriptionTier: {
        type: ["free", "pro", "premium"],
        required: false,
        defaultValue: "free",
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const email = String(user.email || "").toLowerCase();
          const requestedRole = user.role === "artist" ? "artist" : "user";

          return {
            data: {
              ...user,
              role: adminEmails.includes(email) ? "admin" : requestedRole,
              subscriptionTier: adminEmails.includes(email) ? "premium" : "free",
            },
          };
        },
      },
    },
  },
});

export { database, mongoClient };
