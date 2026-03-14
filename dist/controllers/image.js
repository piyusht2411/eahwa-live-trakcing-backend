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
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadPdfFile = exports.uploadExcelFile = exports.uploadImages = void 0;
const multer_1 = require("../config/multer");
const uploadImages = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).json({ message: "No files uploaded" });
        }
        const imageUrls = files.map((file) => file.path);
        res.status(200).json({
            message: "Images uploaded successfully!",
            images: imageUrls,
        });
    }
    catch (error) {
        console.error("Error uploading images:", error);
        res
            .status(500)
            .json({ message: "Error uploading images", error: error.message });
    }
});
exports.uploadImages = uploadImages;
const uploadExcelFile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        (0, multer_1.uploadExcel)(req, res, (err) => __awaiter(void 0, void 0, void 0, function* () {
            if (err) {
                return res.status(400).json({
                    success: false,
                    message: err.message,
                });
            }
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: "Please upload an Excel file",
                });
            }
            return res.status(200).json({
                success: true,
                message: "File uploaded successfully",
                fileUrl: req.file.path,
            });
        }));
    }
    catch (error) {
        console.error("Error uploading file:", error);
        return res.status(500).json({
            success: false,
            message: "Error uploading file",
            error: error,
        });
    }
});
exports.uploadExcelFile = uploadExcelFile;
const uploadPdfFile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        (0, multer_1.uploadPdf)(req, res, (err) => __awaiter(void 0, void 0, void 0, function* () {
            if (err) {
                return res.status(400).json({
                    success: false,
                    message: err.message,
                });
            }
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: "Please upload a PDF file",
                });
            }
            return res.status(200).json({
                success: true,
                message: "File uploaded successfully",
                fileUrl: req.file.path,
            });
        }));
    }
    catch (error) {
        console.error("Error uploading PDF file:", error);
        return res.status(500).json({
            success: false,
            message: "Error uploading PDF file",
            error: error,
        });
    }
});
exports.uploadPdfFile = uploadPdfFile;
