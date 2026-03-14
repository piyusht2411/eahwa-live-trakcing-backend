"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("../config/multer"));
const image_1 = require("../controllers/image");
const router = (0, express_1.Router)();
router.post("/upload-images", multer_1.default.array("images", 10), image_1.uploadImages);
router.post("/upload-excel", image_1.uploadExcelFile);
router.post("/upload-pdf", image_1.uploadPdfFile);
exports.default = router;
