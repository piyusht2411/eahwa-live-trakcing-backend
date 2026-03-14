"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const orderSchema = new mongoose_1.Schema({
    piNumber: { type: String, required: true },
    partyName: { type: String, required: true },
    showroomName: { type: String, required: true },
    location: { type: String, required: true },
    quantity: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    agentName: { type: String, required: true },
    amountReceived: { type: Number, required: true },
    orderModel: { type: String, required: true },
    colorVariants: { type: String, required: true },
    batteryType: { type: String, required: true },
    deadline: { type: Date, required: true },
    agentPhone: { type: String, required: true },
    dealerPhone: { type: String, required: true },
    piPdf: { type: String, required: true },
    submittedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
    status: {
        type: String,
        enum: [
            "pending_verification",
            "payment_received",
            "payment_not_received",
            "ready_for_dispatch",
            "pending",
            "cancelled",
            "completed",
        ],
        default: "pending_verification",
    },
    orderId: { type: String },
    driverNumber: { type: String },
    vehicleNumber: { type: String },
    transporterName: { type: String },
    remark: { type: String },
    pendingReason: { type: String, default: "" },
    cancelReason: { type: String, default: "" },
    accountsMessageSid: { type: String },
    reminderSent: { type: Boolean, default: false },
    priority: { type: Number, default: null },
    remarkQuerySid: { type: String },
    remarkInputSid: { type: String },
}, { timestamps: true });
orderSchema.virtual("pendency").get(function () {
    return this.deadline < new Date() && this.status !== "completed";
});
orderSchema.set("toObject", { virtuals: true });
orderSchema.set("toJSON", { virtuals: true });
const Order = (0, mongoose_1.model)("Order", orderSchema);
exports.default = Order;
