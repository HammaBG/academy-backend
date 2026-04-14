import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { toggleWishlist, getMyWishlist } from "../controllers/wishlist.controller";

const router = Router();

router.post("/toggle", requireAuth as any, toggleWishlist);
router.get("/me", requireAuth as any, getMyWishlist);

export default router;
