import { Router } from "express";
import { requireSuperAdmin } from "../middleware/auth";
import { createSnapshot, listSnapshots } from "../backup";

const router = Router();
router.use(requireSuperAdmin);

router.get("/", (_req, res, next) => {
  try {
    res.json(listSnapshots().map(({ name, size, createdAt }) => ({ name, size, createdAt })));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (_req, res, next) => {
  try {
    const snap = await createSnapshot();
    res.status(201).json({ name: snap.name, size: snap.size, createdAt: snap.createdAt });
  } catch (err) {
    next(err);
  }
});

router.get("/download", async (_req, res, next) => {
  try {
    const snap = await createSnapshot();
    res.download(snap.path, snap.name);
  } catch (err) {
    next(err);
  }
});

export default router;
