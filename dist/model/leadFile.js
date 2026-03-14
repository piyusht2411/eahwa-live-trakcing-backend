"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const fileUploadSchema = new mongoose_1.Schema({
    fileUrl: {
        type: String,
        required: true,
    },
    uploadedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    uploadDate: {
        type: Date,
        default: Date.now,
    },
    leadCount: {
        type: Number,
        default: 0,
    },
    leads: [
        {
            type: mongoose_1.Schema.Types.ObjectId,
            ref: "Lead",
        },
    ],
});
const LeadFile = (0, mongoose_1.model)("FileUpload", fileUploadSchema);
exports.default = LeadFile;
