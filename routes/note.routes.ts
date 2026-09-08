import express from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { createNote, getUserNotes, deleteNote } from "../controllers/note.controller";

const router = express.Router();
router.post("/", requireAuth, createNote);
router.get("/", requireAuth, getUserNotes);
router.delete("/:id", requireAuth, deleteNote);

export default router;
