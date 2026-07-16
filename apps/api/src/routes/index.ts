import { Router } from "express";
import authRoutes from "./auth.routes.js";
import meRoutes from "./me.routes.js";
import friendsRoutes from "./friends.routes.js";
import groupsRoutes from "./groups.routes.js";
import expensesRoutes from "./expenses.routes.js";
import settlementsRoutes from "./settlements.routes.js";
import balancesRoutes from "./balances.routes.js";
import activityRoutes from "./activity.routes.js";
import dashboardRoutes from "./dashboard.routes.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ ok: true });
});

router.use("/auth", authRoutes);
router.use(meRoutes);
router.use("/friends", friendsRoutes);
router.use("/groups", groupsRoutes);
router.use("/expenses", expensesRoutes);
router.use("/settlements", settlementsRoutes);
router.use("/balances", balancesRoutes);
router.use("/activity", activityRoutes);
router.use("/dashboard", dashboardRoutes);

export default router;
