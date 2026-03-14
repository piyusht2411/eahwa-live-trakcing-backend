"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dailyLeadController_1 = require("../controller/dailyLeadController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
router.post("/", authMiddleware_1.authenticateToken, dailyLeadController_1.createDailyLead);
router.get("/", authMiddleware_1.authenticateToken, dailyLeadController_1.getAllDailyLeads);
router.get("/user/:userId", authMiddleware_1.authenticateToken, dailyLeadController_1.getDailyLeadsByUser);
router.get("/:id", authMiddleware_1.authenticateToken, dailyLeadController_1.getDailyLeadById);
router.put("/:id", authMiddleware_1.authenticateToken, dailyLeadController_1.updateDailyLead);
router.delete("/:id", authMiddleware_1.authenticateToken, dailyLeadController_1.deleteDailyLead);
exports.default = router;
