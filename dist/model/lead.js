"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const leadSchema = new mongoose_1.Schema({
    leadDate: { type: Date, required: true },
    callingDate: { type: Date, required: true },
    agentName: { type: String, required: true },
    customerName: { type: String, required: true },
    mobileNumber: { type: String, required: true },
    occupation: { type: String, required: true },
    location: { type: String, required: true },
    town: { type: String, required: true },
    state: { type: String, required: true },
    status: { type: String, required: true },
    remark: { type: String, required: true },
    interestedAndNotInterested: { type: String, required: true },
    officeVisitRequired: { type: Boolean, required: true, default: false },
    leadBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
    isTargetLead: {
        type: Boolean,
        default: false,
    },
});
const Lead = (0, mongoose_1.model)("Lead", leadSchema);
exports.default = Lead;
