/**
 * # NOTE: isAdmin.js
 * Role: Role-Based Access Control Guard
 * Layer: Application / Security Middleware
 * Description: Guards administrative routes, ensuring only authorized admin users proceed.
 */

import User from "../models/User.js";

export async function requireAdmin(req, res, next) {
    try {
        // Requires requireAuth to run first and set req.userId
        const user = await User.findById(req.userId).lean();
        if (!user) {
            return res.status(403).json({ error: "Access denied. Must be logged in." });
        }
        if (user.isAdmin !== true) {
            return res.status(403).json({ error: "Access denied. Admins only." });
        }
        next();
    } catch {
        return res.status(500).json({ error: "Server error checking admin privileges" });
    }
}

export async function requireSuperAdmin(req, res, next) {
    try {
        const user = await User.findById(req.userId).lean();
        if (!user?.isSuperAdmin) {
            return res.status(403).json({ error: "Access denied. Super administrators only." });
        }
        next();
    } catch {
        return res.status(500).json({ error: "Server error checking super administrator privileges" });
    }
}
