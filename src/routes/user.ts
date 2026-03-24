import { Router } from "express";
import { deleteUser, getAdminsAndManagers, getAllUsers, getUserById, updateUser, getUsersHomeLocations } from "../controllers/userController";
import { protect, authorize } from "../middleware/auth";

const router = Router();
router.get("/", protect, authorize("admin", "hr"), getAllUsers);
router.get("/managers", getAdminsAndManagers);
router.get("/home-locations", protect, authorize("admin", "hr", "manager"), getUsersHomeLocations);
router.get("/:id", protect, authorize("admin", "hr", "manager"), getUserById);
router.put("/:id", protect, authorize("admin", "hr", "manager"), updateUser);
router.delete("/:id", protect, deleteUser);

export default router;
