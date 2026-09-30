import express from "express";
import { requireAuth, authorizeRoles } from "../middlewares/auth.middleware";
import {
  createTicket,
  getMyTickets,
  getSingleTicket,
  addReplyToTicket,
  getAllTicketsAdmin,
  updateTicketStatusAdmin,
  deleteTicketAdmin,
} from "../controllers/ticket.controller";

const router = express.Router();

// User & Shared routes
router.post("/create", requireAuth, createTicket);
router.get("/my-tickets", requireAuth, getMyTickets);
router.get("/:id", requireAuth, getSingleTicket);
router.post("/:id/reply", requireAuth, addReplyToTicket);

// Admin routes
router.get("/admin/all", requireAuth, authorizeRoles("admin", "instructor"), getAllTicketsAdmin);
router.put("/admin/:id/status", requireAuth, authorizeRoles("admin", "instructor"), updateTicketStatusAdmin);
router.delete("/admin/:id", requireAuth, authorizeRoles("admin"), deleteTicketAdmin);

export default router;
