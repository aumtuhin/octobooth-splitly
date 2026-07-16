import { Router } from "express";
import { prisma } from "../prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { toPublicUser } from "../lib/serializers.js";

const router = Router();

router.get("/me", authMiddleware, async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.authUser!.userId } });
    return res.json(toPublicUser(user));
  } catch (error) {
    return next(error);
  }
});

export default router;
