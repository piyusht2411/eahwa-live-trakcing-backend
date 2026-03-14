import { Router } from "express";

import upload from "../config/multer";
import {
  uploadExcelFile,
  uploadImages,
  uploadPdfFile,
} from "../controllers/image";

const router = Router();
router.post("/upload-images", upload.array("images", 10), uploadImages);
router.post("/upload-excel", uploadExcelFile);
router.post("/upload-pdf", uploadPdfFile);

export default router;
