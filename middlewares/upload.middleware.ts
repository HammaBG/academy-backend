import multer from 'multer';
import path from 'path';

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext.match(/\.(jpg|jpeg|png|webp|gif)$/)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (jpg, jpeg, png, webp, gif) are allowed'));
    }
  },
});
