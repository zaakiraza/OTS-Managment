import express from "express";
import { login, getMe, changePassword } from "../Controller/authController.js";
import { verifyToken } from "../Middleware/auth.js";

const router = express.Router();

router.post("/login", login);
router.get("/me", verifyToken, getMe);
router.put("/change-password", verifyToken, changePassword);

export default router;
