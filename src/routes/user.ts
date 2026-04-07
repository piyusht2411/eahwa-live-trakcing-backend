import { Router } from "express";
import { deleteUser, getAdminsAndManagers, getAllUsers, getUserById, updateUser, getUsersHomeLocations, getUserTravelHistory, switchActiveMode } from "../controllers/userController";
import { protect, authorize } from "../middleware/auth";

const router = Router();
router.get("/", protect, authorize("admin", "super_manager", "hr", "manager"), getAllUsers);
router.get("/managers", getAdminsAndManagers);
router.get("/home-locations", protect, authorize("admin", "super_manager", "hr", "manager"), getUsersHomeLocations);
router.patch("/me/active-mode", protect, switchActiveMode);
router.get("/:id/travel-history", protect, authorize("admin", "super_manager", "hr", "manager"), getUserTravelHistory);
router.get("/:id", protect, authorize("admin", "super_manager", "hr", "manager"), getUserById);
router.put("/:id", protect, authorize("admin", "super_manager", "hr", "manager"), updateUser);
router.delete("/:id", protect, authorize("admin"), deleteUser);

export default router;
