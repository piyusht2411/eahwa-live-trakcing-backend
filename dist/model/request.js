"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const requestSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true },
    productDescription: { type: String, required: true, trim: true },
    vendorName: { type: String, required: true, trim: true },
    userPhoneNumber: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    time: { type: String, required: true, trim: true },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        default: 'pending',
    },
    rejectionReason: { type: String, trim: true },
}, { timestamps: true });
const Request = (0, mongoose_1.model)('Request', requestSchema);
exports.default = Request;
