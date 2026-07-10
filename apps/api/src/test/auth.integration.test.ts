import request from "supertest";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../prisma.js", () => {
  const users: Array<{
    id: string;
    name: string;
    username: string;
    email: string;
    passwordHash: string;
    defaultCurrency: string;
    avatarUrl: string | null;
  }> = [];

  return {
    prisma: {
      user: {
        findFirst: vi.fn(async ({ where }) => users.find((u) => u.email === where.OR[0].email || u.username === where.OR[1].username) ?? null),
        findUnique: vi.fn(async ({ where }) => users.find((u) => u.email === where.email) ?? null),
        findUniqueOrThrow: vi.fn(async ({ where }) => {
          const found = users.find((u) => u.id === where.id);
          if (!found) throw new Error("not found");
          return found;
        }),
        create: vi.fn(async ({ data }) => {
          const user = {
            id: `u-${users.length + 1}`,
            name: data.name,
            username: data.username,
            email: data.email,
            passwordHash: data.passwordHash,
            defaultCurrency: data.defaultCurrency,
            avatarUrl: null
          };
          users.push(user);
          return user;
        })
      },
      friendRequest: {
        findMany: vi.fn(async () => []),
        upsert: vi.fn(async () => ({ id: "fr-1" })),
        findUnique: vi.fn(async () => null),
        update: vi.fn(async () => ({}))
      },
      expense: {
        findMany: vi.fn(async () => []),
        create: vi.fn(async () => ({ id: "e-1", splits: [] }))
      },
      settlement: {
        findMany: vi.fn(async () => []),
        create: vi.fn(async () => ({ id: "s-1" }))
      },
      group: {
        findMany: vi.fn(async () => []),
        create: vi.fn(async () => ({ id: "g-1", members: [] }))
      },
      groupMember: {
        findFirst: vi.fn(async () => ({ id: "gm-admin" })),
        create: vi.fn(async () => ({ id: "gm-1" })),
        delete: vi.fn(async () => ({}))
      },
      activityLog: {
        create: vi.fn(async () => ({})),
        findMany: vi.fn(async () => []),
        createMany: vi.fn(async () => ({}))
      }
    }
  };
});

let app: (typeof import("../app.js"))["default"];

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret";
  app = (await import("../app.js")).default;
});

describe("auth endpoints", () => {
  it("signs up a user", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      name: "Test User",
      username: "testuser",
      email: "test@example.com",
      password: "password123",
      defaultCurrency: "USD"
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTypeOf("string");
    expect(res.body.user.email).toBe("test@example.com");
  });

  it("logs in a user", async () => {
    await request(app).post("/api/auth/signup").send({
      name: "Second User",
      username: "seconduser",
      email: "second@example.com",
      password: "password123",
      defaultCurrency: "USD"
    });

    const res = await request(app).post("/api/auth/login").send({
      email: "second@example.com",
      password: "password123"
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTypeOf("string");
  });
});
