import { Router } from "express";
import { prisma } from "../prisma.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const activity = await prisma.activityLog.findMany({
      where: {
        OR: [{ actorId: req.authUser!.userId }, { group: { members: { some: { userId: req.authUser!.userId } } } }]
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        actor: {
          select: { id: true, name: true, username: true }
        }
      }
    });

    return res.json(activity);
  } catch (error) {
    return next(error);
  }
});

export default router;
