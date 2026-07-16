import fs from "node:fs";
import multer from "multer";

export const uploadDir = process.env.UPLOAD_DIR ?? "uploads";

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

export const upload = multer({ dest: uploadDir });
