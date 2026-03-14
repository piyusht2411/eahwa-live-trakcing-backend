"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const ticket_1 = require("../controller/ticket");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
router.post("/create", authMiddleware_1.authenticateToken, ticket_1.createTicket);
router.get("/", authMiddleware_1.authenticateToken, ticket_1.getTickets);
router.get("/my-ticket", authMiddleware_1.authenticateToken, ticket_1.getMyTickets);
router.patch("/:id/status", authMiddleware_1.authenticateToken, ticket_1.updateTicketStatus);
exports.default = router;
