import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "./cloudinary";

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    //@ts-ignore
    folder: "blog_images",
    allowed_formats: ["jpg", "jpeg", "png", "gif"],
  },
});

const excelStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    //@ts-ignore
    folder: "excel_files",
    resource_type: "auto",
    format: "xlsx",
  },
});

const pdfStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    //@ts-ignore
    folder: "pdf_files",
    resource_type: "raw",
    format: "pdf",
  },
});

const upload = multer({ storage });

export const uploadExcel = multer({
  storage: excelStorage,
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.mimetype === "application/vnd.ms-excel"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only Excel files are allowed"));
    }
  },
}).single("file");

export const uploadPdf = multer({
  storage: pdfStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
}).single("file");

export default upload;
