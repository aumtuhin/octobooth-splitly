import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { toPublicUser } from "../lib/serializers.js";

const router = Router();

// Keep in sync with the avatar styles offered by the web client.
const AVATAR_STYLES = [
  "funEmoji",
  "bottts",
  "adventurer",
  "bigSmile",
  "lorelei",
  "notionists",
  "openPeeps",
  "thumbs",
  "shapes",
  "identicon"
] as const;

router.get("/me", authMiddleware, async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.authUser!.userId } });
    return res.json(toPublicUser(user));
  } catch (error) {
    return next(error);
  }
});

const updateMeSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_.-]+$/, "Invalid username").optional(),
  defaultCurrency: z.string().length(3).optional(),
  avatarStyle: z.enum(AVATAR_STYLES).optional(),
  avatarSeed: z.string().min(1).max(64).optional()
});

router.patch("/me", authMiddleware, async (req, res, next) => {
  try {
    const parsed = updateMeSchema.parse(req.body);
    const myId = req.authUser!.userId;

    if (parsed.username) {
      const taken = await prisma.user.findFirst({
        where: { username: parsed.username, NOT: { id: myId } }
      });
      if (taken) {
        return res.status(409).json({ message: "Username already in use" });
      }
    }

    const updated = await prisma.user.update({
      where: { id: myId },
      data: {
        name: parsed.name,
        username: parsed.username,
        defaultCurrency: parsed.defaultCurrency?.toUpperCase(),
        avatarStyle: parsed.avatarStyle,
        avatarSeed: parsed.avatarSeed
      }
    });

    return res.json(toPublicUser(updated));
  } catch (error) {
    return next(error);
  }
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8)
});

router.post("/me/password", authMiddleware, async (req, res, next) => {
  try {
    const parsed = passwordSchema.parse(req.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.authUser!.userId } });

    const valid = await bcrypt.compare(parsed.currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    const passwordHash = await bcrypt.hash(parsed.newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

router.delete("/me", authMiddleware, async (req, res, next) => {
  try {
    const myId = req.authUser!.userId;

    // Expense/Settlement have onDelete: Restrict FKs to User, so remove the
    // user's financial records first, then the user (whose remaining relations
    // — group memberships, created groups, friend requests, activity — cascade).
    await prisma.$transaction([
      prisma.expenseSplit.deleteMany({ where: { userId: myId } }),
      prisma.expense.deleteMany({ where: { OR: [{ payerId: myId }, { createdById: myId }] } }),
      prisma.settlement.deleteMany({
        where: { OR: [{ payerId: myId }, { receiverId: myId }, { createdById: myId }] }
      }),
      prisma.user.delete({ where: { id: myId } })
    ]);

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

export default router;
