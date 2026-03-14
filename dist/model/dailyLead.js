"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// schemas/dailyLead.ts
const mongoose_1 = require("mongoose");
const dailyLeadSchema = new mongoose_1.Schema({
    user: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    date: {
        type: Date,
        required: true,
    },
    numberOfLeads: {
        type: Number,
        default: 0,
    },
    interestedLeads: {
        type: Number,
        default: 0,
    },
    notInterestedFake: {
        type: Number,
        default: 0,
    },
    nextMonthConnect: {
        type: Number,
        default: 0,
    },
    newDealers: {
        type: Number,
        default: 0,
    },
    oldDealers: {
        type: Number,
        default: 0,
    },
}, { timestamps: true });
const DailyLead = (0, mongoose_1.model)("DailyLead", dailyLeadSchema);
exports.default = DailyLead;
