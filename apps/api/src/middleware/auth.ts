import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export type AuthUser = {
  userId: string;
  email: string;
};

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid authorization header" });
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET ?? "") as AuthUser;
    req.authUser = payload;
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}
