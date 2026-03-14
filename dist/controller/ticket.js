"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyTickets = exports.updateTicketStatus = exports.getTickets = exports.createTicket = void 0;
const ticketService_1 = require("../services/ticketService");
const ticket_1 = __importDefault(require("../model/ticket"));
const createTicket = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const data = req.body;
        if (req.userId) {
            data.submittedBy = req.userId;
        }
        else {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const ticket = yield (0, ticketService_1.createTicketService)(data);
        res.status(201).json({ message: "Ticket raised successfully", ticket });
    }
    catch (error) {
        res.status(500).json({ message: "Error creating ticket", error });
    }
});
exports.createTicket = createTicket;
const getTickets = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const filters = req.query;
        const tickets = yield (0, ticketService_1.getAllTicketsService)(filters);
        res.json(tickets);
    }
    catch (error) {
        res.status(500).json({ message: "Error fetching tickets", error });
    }
});
exports.getTickets = getTickets;
const updateTicketStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { status, statusRemark } = req.body;
        // Add role check if needed, e.g., if (req.user.role !== 'admin' && req.user.post !== 'service') return unauthorized
        const ticket = yield (0, ticketService_1.updateTicketStatusService)(id, status, statusRemark);
        if (!ticket) {
            res.status(404).json({ message: "Ticket not found" });
            return;
        }
        res.json({ message: "Status updated", ticket });
    }
    catch (error) {
        res.status(500).json({ message: "Error updating status", error });
    }
});
exports.updateTicketStatus = updateTicketStatus;
const getMyTickets = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const filters = req.query;
        let query = { submittedBy: req.userId };
        if (filters.status) {
            query.status = filters.status;
        }
        if (filters.month) {
            const [year, month] = filters.month.split("-");
            const start = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1));
            const end = new Date(Date.UTC(parseInt(year), parseInt(month), 1));
            query.complainDate = { $gte: start, $lt: end };
        }
        const tickets = yield ticket_1.default.find(query)
            .sort({ complainDate: -1 })
            .populate("submittedBy", "name email");
        res.status(200).json({
            message: "My tickets fetched successfully",
            count: tickets.length,
            tickets,
        });
    }
    catch (error) {
        console.error("Error in getMyTickets:", error);
        res.status(500).json({
            message: "Error fetching your tickets",
            error: error.message || error,
        });
    }
});
exports.getMyTickets = getMyTickets;
