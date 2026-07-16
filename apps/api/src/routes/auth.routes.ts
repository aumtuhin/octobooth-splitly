import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { signToken } from "../lib/jwt.js";
import { toPublicUser } from "../lib/serializers.js";

const router = Router();

const signupSchema = z.object({
  name: z.string().min(2),
  username: z.string().min(3).max(30),
  email: z.string().email(),
  password: z.string().min(8),
  defaultCurrency: z.string().min(3).max(3).optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

router.post("/signup", async (req, res, next) => {
  try {
    const parsed = signupSchema.parse(req.body);
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email: parsed.email }, { username: parsed.username }]
      }
    });
    if (existing) {
      return res.status(409).json({ message: "Email or username already in use" });
    }

    const passwordHash = await bcrypt.hash(parsed.password, 10);
    const user = await prisma.user.create({
      data: {
        name: parsed.name,
        username: parsed.username,
        email: parsed.email,
        defaultCurrency: parsed.defaultCurrency ?? "USD",
        passwordHash
      }
    });

    const token = signToken({ id: user.id, email: user.email });
    return res.status(201).json({ token, user: toPublicUser(user) });
  } catch (error) {
    return next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: parsed.email } });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const isValid = await bcrypt.compare(parsed.password, user.passwordHash);
    if (!isValid) return res.status(401).json({ message: "Invalid credentials" });

    const token = signToken({ id: user.id, email: user.email });
    return res.json({ token, user: toPublicUser(user) });
  } catch (error) {
    return next(error);
  }
});

export default router;
