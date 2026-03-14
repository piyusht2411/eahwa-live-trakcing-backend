"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadPdf = exports.uploadExcel = void 0;
const multer_1 = __importDefault(require("multer"));
const multer_storage_cloudinary_1 = require("multer-storage-cloudinary");
const cloudinary_1 = __importDefault(require("./cloudinary"));
const storage = new multer_storage_cloudinary_1.CloudinaryStorage({
    cloudinary: cloudinary_1.default,
    params: {
        //@ts-ignore
        folder: "blog_images",
        allowed_formats: ["jpg", "jpeg", "png", "gif"],
    },
});
const excelStorage = new multer_storage_cloudinary_1.CloudinaryStorage({
    cloudinary: cloudinary_1.default,
    params: {
        //@ts-ignore
        folder: "excel_files",
        resource_type: "auto",
        format: "xlsx",
    },
});
const pdfStorage = new multer_storage_cloudinary_1.CloudinaryStorage({
    cloudinary: cloudinary_1.default,
    params: {
        //@ts-ignore
        folder: "pdf_files",
        resource_type: "raw",
        format: "pdf",
    },
});
const upload = (0, multer_1.default)({ storage });
exports.uploadExcel = (0, multer_1.default)({
    storage: excelStorage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype ===
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
            file.mimetype === "application/vnd.ms-excel") {
            cb(null, true);
        }
        else {
            cb(new Error("Only Excel files are allowed"));
        }
    },
}).single("file");
exports.uploadPdf = (0, multer_1.default)({
    storage: pdfStorage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === "application/pdf") {
            cb(null, true);
        }
        else {
            cb(new Error("Only PDF files are allowed"));
        }
    },
}).single("file");
exports.default = upload;
