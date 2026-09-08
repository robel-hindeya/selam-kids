import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
    try {
        const token = req.cookies?.token;
        if (!token) return res.status(401).json({ error: "Not authenticated" });

        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = payload.userId;
        next();
    } catch {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
}
