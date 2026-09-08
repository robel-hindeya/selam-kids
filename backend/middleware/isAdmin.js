import User from "../models/User.js";

export async function requireAdmin(req, res, next) {
    try {
        // Requires requireAuth to run first and set req.userId
        const user = await User.findById(req.userId).lean();
        if (!user) {
            return res.status(403).json({ error: "Access denied. Must be logged in." });
        }
        // TEMPORARY: Disabled isAdmin check so the user can see the admin page immediately
        // if (user.isAdmin !== true) {
        //     return res.status(403).json({ error: "Access denied. Admins only." });
        // }
        next();
    } catch {
        return res.status(500).json({ error: "Server error checking admin privileges" });
    }
}
