import { Router } from "express";
import passport from "../auth/google.js";
import jwt from "jsonwebtoken";

const router = Router();

// Start Google OAuth flow
router.get(
    "/google",
    passport.authenticate("google", { scope: ["profile", "email"], session: false })
);

// Google OAuth callback
router.get(
    "/google/callback",
    passport.authenticate("google", { failureRedirect: "/auth", session: false }),
    (req, res) => {
        const user = req.user;
        const token = jwt.sign({ userId: user._id.toString() }, process.env.JWT_SECRET, {
            expiresIn: "30d",
        });

        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        });

        res.redirect(`${process.env.FRONTEND_URL ?? ""}/home`);
    }
);

// Logout
router.post("/logout", (req, res) => {
    res.clearCookie("token");
    res.json({ ok: true });
});

export default router;
