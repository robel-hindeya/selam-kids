/**
 * # NOTE: auth.js
 * Role: Authentication Middleware
 * Layer: Application / Security Middleware
 * Description: Verifies JWT tokens from cookies or Authorization headers and attaches user payload.
 */

import jwt from "jsonwebtoken";
import { query } from "../lib/postgres.js";

export async function requireAuth(req, res, next) {
    try {
        const token = req.cookies?.token;
        if (!token) return res.status(401).json({ error: "Not authenticated" });

        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const result = await query(
            "SELECT id, username, email, display_name, role, is_admin, is_super_admin, is_disabled FROM users WHERE id = $1",
            [payload.userId]
        );
        const user = result.rows[0];
        if (!user) return res.status(401).json({ error: "User not found" });
        if (user.is_disabled) {
            return res.status(403).json({ error: "Account disabled. Please contact administrator." });
        }

        req.userId = user.id;
        req.user = {
            _id: user.id,
            id: user.id,
            username: user.username,
            email: user.email,
            displayName: user.display_name,
            role: user.role,
            isAdmin: Boolean(user.is_admin),
            isSuperAdmin: Boolean(user.is_super_admin),
        };
        next();
    } catch {
        return res.status(401).json({ error: "Invalid or expired session" });
    }
}

export async function requireAdmin(req, res, next) {
    return requireAuth(req, res, () => {
        if (!req.user?.isAdmin && !req.user?.isSuperAdmin) {
            return res.status(403).json({ error: "Admin access required" });
        }
        next();
    });
}

export async function requireSuperAdmin(req, res, next) {
    return requireAuth(req, res, () => {
        if (!req.user?.isSuperAdmin) {
            return res.status(403).json({ error: "Super admin access required" });
        }
        next();
    });
}
