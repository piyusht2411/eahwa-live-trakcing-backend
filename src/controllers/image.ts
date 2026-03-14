import { Request, Response } from "express";
import { uploadExcel, uploadPdf } from "../config/multer";

export const uploadImages = async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const imageUrls = files.map((file) => file.path);

    res.status(200).json({
      message: "Images uploaded successfully!",
      images: imageUrls,
    });
  } catch (error: any) {
    console.error("Error uploading images:", error);
    res
      .status(500)
      .json({ message: "Error uploading images", error: error.message });
  }
};

export const uploadExcelFile = async (req: Request, res: Response) => {
  try {
    uploadExcel(req, res, async (err) => {
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
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return res.status(500).json({
      success: false,
      message: "Error uploading file",
      error: error,
    });
  }
};

export const uploadPdfFile = async (req: Request, res: Response) => {
  try {
    uploadPdf(req, res, async (err) => {
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
    });
  } catch (error) {
    console.error("Error uploading PDF file:", error);
    return res.status(500).json({
      success: false,
      message: "Error uploading PDF file",
      error: error,
    });
  }
};
