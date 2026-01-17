const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const { PrismaClient } = require("@prisma/client");

require("dotenv").config();

const {
  PORT = 8080,
  DATABASE_URL,
  JWT_SECRET,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  CORS_ORIGIN
} = process.env;

if (!DATABASE_URL || !JWT_SECRET || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
  throw new Error("Missing required environment variables.");
}

const prisma = new PrismaClient();
const oauthClient = new OAuth2Client(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(
  cors({
    origin: CORS_ORIGIN || "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

function signToken(user) {
  return jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: "7d" });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/auth/google", async (req, res, next) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: "Missing code" });
    }

    const { tokens } = await oauthClient.getToken(code);

    if (!tokens.id_token) {
      return res.status(400).json({ error: "Missing id_token from Google" });
    }

    const ticket = await oauthClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();

    if (!payload || !payload.sub || !payload.email) {
      return res.status(400).json({ error: "Invalid Google profile" });
    }

    const user = await prisma.user.upsert({
      where: { googleId: payload.sub },
      update: {
        email: payload.email,
        name: payload.name || payload.email.split("@")[0],
        avatarUrl: payload.picture || null
      },
      create: {
        googleId: payload.sub,
        email: payload.email,
        name: payload.name || payload.email.split("@")[0],
        avatarUrl: payload.picture || null
      }
    });

    const token = signToken(user);

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl
      }
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, name: true, email: true, avatarUrl: true }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({ user });
  } catch (error) {
    return next(error);
  }
});

app.get("/posts", async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || "20", 10) || 20, 50);

    const posts = await prisma.post.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } }
      }
    });

    return res.json({ posts });
  } catch (error) {
    return next(error);
  }
});

app.post("/posts", requireAuth, async (req, res, next) => {
  try {
    const content = String(req.body.content || "").trim();

    if (!content) {
      return res.status(400).json({ error: "Content is required" });
    }

    if (content.length > 1000) {
      return res.status(400).json({ error: "Content is too long" });
    }

    const post = await prisma.post.create({
      data: {
        content,
        authorId: req.userId
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } }
      }
    });

    return res.status(201).json({ post });
  } catch (error) {
    return next(error);
  }
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: "Server error" });
});

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});
