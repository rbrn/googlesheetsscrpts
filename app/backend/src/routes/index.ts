import { Router } from "express";
import { estimateEPS } from "../eps/controller.js";

const router = Router();

router.post("/eps/estimate", estimateEPS);

export default router;
