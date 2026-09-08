import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        googleId: { type: String, unique: true, sparse: true },
        username: { type: String, unique: true, sparse: true, trim: true, lowercase: true },
        email: { type: String, unique: true, sparse: true, trim: true, lowercase: true },
        displayName: { type: String, trim: true },
        gender: { type: String, enum: ["male", "female", "other", ""], default: "" },
        age: { type: Number, min: 0, max: 120 },
        avatarUrl: { type: String, default: "" },
        legacyPoints: { type: Number, default: 0 },
        isAdmin: { type: Boolean, default: false },
    },
    { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;
