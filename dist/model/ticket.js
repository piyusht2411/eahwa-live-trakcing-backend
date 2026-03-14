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
const mongoose_1 = require("mongoose");
const counter_1 = __importDefault(require("./counter"));
const ticketSchema = new mongoose_1.Schema({
    ticketId: {
        type: Number,
        unique: true,
    },
    dealerName: { type: String, required: true },
    dealerPhone: { type: String, required: true },
    location: { type: String, required: true },
    showroomName: { type: String, required: true },
    agentName: { type: String, required: true },
    agentPhone: { type: String, required: true },
    complaintRegarding: [
        {
            type: String,
            enum: ["Battery", "Charger", "Motor", "Controller", "Vehicle", "Other"],
        },
    ],
    purchaseDate: { type: Date, required: true },
    complainDate: { type: Date, default: Date.now },
    warrantyStatus: {
        type: String,
        enum: ["In Warranty", "Out of Warranty", "Dispatch Problem"],
        required: true,
    },
    remark: { type: String },
    status: {
        type: String,
        enum: ["Pending", "Complete", "Out of Warranty"],
        default: "Pending",
    },
    statusRemark: { type: String },
    submittedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });
ticketSchema.pre("save", function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (this.isNew) {
            const counter = yield counter_1.default.findOneAndUpdate({ name: "ticketId" }, { $inc: { seq: 1 } }, { new: true, upsert: true });
            this.ticketId = 10000 + counter.seq;
        }
        next();
    });
});
const Ticket = (0, mongoose_1.model)("Ticket", ticketSchema);
exports.default = Ticket;
