"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const visitorSchema = new mongoose_1.Schema({
    clientName: {
        type: String,
        required: true,
    },
    clientPhoneNumber: {
        type: Number,
        required: true,
    },
    clientAddress: {
        type: String,
        required: true,
    },
    visitDateTime: {
        type: Date,
        required: true,
        default: Date.now,
    },
    purpose: {
        type: String,
        required: true,
    },
    feedback: {
        type: String,
        default: "",
    },
    visitedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
    },
});
const Visitor = (0, mongoose_1.model)("Visitor", visitorSchema);
exports.default = Visitor;
