import jwt from "jsonwebtoken";

export function signToken(user: { id: string; email: string }) {
  return jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET ?? "", {
    expiresIn: "7d"
  });
}
