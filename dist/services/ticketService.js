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
exports.updateTicketStatusService = exports.getAllTicketsService = exports.createTicketService = void 0;
const ticket_1 = __importDefault(require("../model/ticket"));
const createTicketService = (data) => __awaiter(void 0, void 0, void 0, function* () {
    const ticket = new ticket_1.default(data);
    yield ticket.save();
    return ticket;
});
exports.createTicketService = createTicketService;
const getAllTicketsService = (filters) => __awaiter(void 0, void 0, void 0, function* () {
    let query = {};
    if (filters.status) {
        query.status = filters.status;
    }
    if (filters.month) {
        // Expect filters.month in YYYY-MM format
        const [year, month] = filters.month.split("-");
        const start = new Date(parseInt(year), parseInt(month) - 1, 1);
        const end = new Date(parseInt(year), parseInt(month), 1);
        query.complainDate = { $gte: start, $lt: end };
    }
    return ticket_1.default.find(query)
        .sort({ complainDate: -1 })
        .populate("submittedBy", "name email");
});
exports.getAllTicketsService = getAllTicketsService;
const updateTicketStatusService = (id, status, statusRemark) => __awaiter(void 0, void 0, void 0, function* () {
    const update = { status };
    if (status === "Pending" && statusRemark) {
        update.statusRemark = statusRemark;
    }
    else {
        update.statusRemark = undefined;
    }
    return ticket_1.default.findByIdAndUpdate(id, update, { new: true });
});
exports.updateTicketStatusService = updateTicketStatusService;
