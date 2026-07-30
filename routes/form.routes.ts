import { Router } from "express";
import {
  createForm,
  getAllForms,
  getFormStats,
  getFormById,
  updateForm,
  deleteForm,
  getFormsByCourseId,
  addNote,
  getNotes,
  deleteNote
} from "../controllers/form.controller";
import { requireAuth, authorizeRoles } from "../middlewares/auth.middleware";

const router = Router();

router.post("/", createForm);

router.use(requireAuth);
router.use(authorizeRoles("admin"));

router.get("/", getAllForms);
router.get("/stats", getFormStats);
router.get("/course/:courseId", getFormsByCourseId);

router.route("/:id")
  .get(getFormById)
  .put(updateForm);

router.delete("/:id", authorizeRoles("admin"), deleteForm);

router.route("/:id/notes")
  .post(addNote)
  .get(getNotes);

router.delete("/:id/notes/:noteId", deleteNote);

export default router;
