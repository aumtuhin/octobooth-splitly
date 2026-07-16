import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ message: "Validation failed", issues: error.issues });
  }

  if (error instanceof Error && "code" in error && (error as { code?: string }).code === "P2025") {
    return res.status(404).json({ message: "Resource not found" });
  }

  console.error(error);
  return res.status(500).json({ message: "Internal server error" });
}
