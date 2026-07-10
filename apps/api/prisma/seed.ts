import bcrypt from "bcryptjs";
import { PrismaClient, ActivityType, ExpenseSplitType, GroupRole, FriendRequestStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.activityLog.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.expenseSplit.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.friendRequest.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("password123", 10);

  const [alice, bob, charlie] = await Promise.all([
    prisma.user.create({
      data: {
        email: "alice@example.com",
        username: "alice",
        name: "Alice",
        passwordHash,
        defaultCurrency: "USD"
      }
    }),
    prisma.user.create({
      data: {
        email: "bob@example.com",
        username: "bob",
        name: "Bob",
        passwordHash,
        defaultCurrency: "USD"
      }
    }),
    prisma.user.create({
      data: {
        email: "charlie@example.com",
        username: "charlie",
        name: "Charlie",
        passwordHash,
        defaultCurrency: "USD"
      }
    })
  ]);

  await prisma.friendRequest.createMany({
    data: [
      { senderId: alice.id, receiverId: bob.id, status: FriendRequestStatus.ACCEPTED },
      { senderId: alice.id, receiverId: charlie.id, status: FriendRequestStatus.ACCEPTED }
    ]
  });

  const trip = await prisma.group.create({
    data: {
      name: "Trip to Goa",
      description: "Beach trip split",
      createdById: alice.id,
      members: {
        create: [
          { userId: alice.id, role: GroupRole.ADMIN },
          { userId: bob.id },
          { userId: charlie.id }
        ]
      }
    }
  });

  const expense = await prisma.expense.create({
    data: {
      description: "Beach shack dinner",
      amountCents: 9000,
      currency: "USD",
      date: new Date(),
      payerId: alice.id,
      createdById: alice.id,
      groupId: trip.id,
      splitType: ExpenseSplitType.EQUAL,
      category: "food"
    }
  });

  await prisma.expenseSplit.createMany({
    data: [
      { expenseId: expense.id, userId: alice.id, owedCents: 3000 },
      { expenseId: expense.id, userId: bob.id, owedCents: 3000 },
      { expenseId: expense.id, userId: charlie.id, owedCents: 3000 }
    ]
  });

  await prisma.settlement.create({
    data: {
      payerId: bob.id,
      receiverId: alice.id,
      amountCents: 2000,
      currency: "USD",
      date: new Date(),
      groupId: trip.id,
      note: "Partial settle",
      createdById: bob.id
    }
  });

  await prisma.activityLog.createMany({
    data: [
      { type: ActivityType.GROUP_CREATED, actorId: alice.id, groupId: trip.id },
      { type: ActivityType.EXPENSE_CREATED, actorId: alice.id, groupId: trip.id, expenseId: expense.id },
      { type: ActivityType.SETTLEMENT_CREATED, actorId: bob.id, groupId: trip.id }
    ]
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Seed completed");
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
