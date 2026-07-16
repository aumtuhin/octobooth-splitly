import { Router } from "express";
import { z } from "zod";
import { ActivityType, GroupRole } from "@prisma/client";
import { prisma } from "../prisma.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const groups = await prisma.group.findMany({
      where: { members: { some: { userId: req.authUser!.userId } } },
      include: {
        members: { include: { user: true } },
        expenses: { include: { splits: true } },
        _count: { select: { members: true, expenses: true } }
      }
    });

    const data = groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      members: g.members.map((m) => ({ id: m.user.id, name: m.user.name, role: m.role })),
      memberCount: g._count.members,
      expenseCount: g._count.expenses,
      totalSpentCents: g.expenses.reduce((acc, e) => acc + e.amountCents, 0)
    }));

    return res.json(data);
  } catch (error) {
    return next(error);
  }
});

router.get("/:id", authMiddleware, async (req, res, next) => {
  try {
    const group = await prisma.group.findFirst({
      where: { id: req.params.id, members: { some: { userId: req.authUser!.userId } } },
      include: {
        members: { include: { user: true } },
        expenses: { include: { splits: true }, orderBy: { date: "desc" } },
        _count: { select: { members: true, expenses: true } }
      }
    });

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    return res.json({
      id: group.id,
      name: group.name,
      description: group.description,
      members: group.members.map((m) => ({ id: m.user.id, name: m.user.name, role: m.role })),
      memberCount: group._count.members,
      expenseCount: group._count.expenses,
      totalSpentCents: group.expenses.reduce((acc, e) => acc + e.amountCents, 0),
      expenses: group.expenses
    });
  } catch (error) {
    return next(error);
  }
});

const createGroupSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  memberIds: z.array(z.string()).optional()
});

router.post("/", authMiddleware, async (req, res, next) => {
  try {
    const parsed = createGroupSchema.parse(req.body);
    const myId = req.authUser!.userId;
    const memberIds = Array.from(new Set([myId, ...(parsed.memberIds ?? [])]));

    const group = await prisma.group.create({
      data: {
        name: parsed.name,
        description: parsed.description,
        createdById: myId,
        members: {
          create: memberIds.map((id) => ({ userId: id, role: id === myId ? GroupRole.ADMIN : GroupRole.MEMBER }))
        }
      },
      include: { members: true }
    });

    await prisma.activityLog.create({
      data: { type: ActivityType.GROUP_CREATED, actorId: myId, groupId: group.id }
    });

    return res.status(201).json(group);
  } catch (error) {
    return next(error);
  }
});

const groupMemberSchema = z
  .object({
    userId: z.string().optional(),
    identifier: z.string().optional()
  })
  .refine((data) => Boolean(data.userId || data.identifier), {
    message: "userId or identifier is required"
  });

router.post("/:id/members", authMiddleware, async (req, res, next) => {
  try {
    const parsed = groupMemberSchema.parse(req.body);
    const myId = req.authUser!.userId;

    const admin = await prisma.groupMember.findFirst({
      where: { groupId: req.params.id, userId: myId, role: GroupRole.ADMIN }
    });
    if (!admin) return res.status(403).json({ message: "Only admins can invite members" });

    let userId = parsed.userId;
    if (!userId && parsed.identifier) {
      const found = await prisma.user.findFirst({
        where: {
          OR: [{ email: parsed.identifier }, { username: parsed.identifier }]
        }
      });
      if (!found) {
        return res.status(404).json({ message: "User not found" });
      }
      userId = found.id;
    }

    const member = await prisma.groupMember.create({
      data: { groupId: req.params.id, userId: userId as string, role: GroupRole.MEMBER }
    });

    await prisma.activityLog.create({
      data: {
        type: ActivityType.GROUP_MEMBER_ADDED,
        actorId: myId,
        groupId: req.params.id,
        payload: { userId }
      }
    });

    return res.status(201).json(member);
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id/members/:userId", authMiddleware, async (req, res, next) => {
  try {
    const myId = req.authUser!.userId;

    const admin = await prisma.groupMember.findFirst({
      where: { groupId: req.params.id, userId: myId, role: GroupRole.ADMIN }
    });
    if (!admin) return res.status(403).json({ message: "Only admins can remove members" });

    await prisma.groupMember.delete({
      where: {
        groupId_userId: {
          groupId: req.params.id,
          userId: req.params.userId
        }
      }
    });

    await prisma.activityLog.create({
      data: {
        type: ActivityType.GROUP_MEMBER_REMOVED,
        actorId: myId,
        groupId: req.params.id,
        payload: { userId: req.params.userId }
      }
    });

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

export default router;
