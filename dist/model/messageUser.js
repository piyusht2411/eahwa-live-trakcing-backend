"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const messageUserSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: true,
    },
    messageId: {
        type: String,
        required: true,
    },
    productDescription: {
        type: String,
        required: true,
    },
    vendorName: {
        type: String,
        required: true,
    },
    amount: {
        type: String,
        required: true,
    },
    secondMessageId: {
        type: String,
        required: true,
    },
    whatsappNumber: {
        type: String,
        required: true,
    },
    time: {
        type: String,
        required: true,
    },
});
const messageUser = (0, mongoose_1.model)('MessageUser', messageUserSchema);
exports.default = messageUser;
