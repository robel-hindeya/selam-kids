import mongoose from "mongoose";

// Magazine Model
const magazineSchema = new mongoose.Schema(
    {
        title: { type: String, required: true },
        description: { type: String, default: "" },
        coverUrl: { type: String, required: true },
        minutes: { type: Number, default: 5 },
        likes: { type: Number, default: 0 },
        edition: { type: String, default: "New Edition" },
        category: { type: String, default: "Magazine" },
        date: { type: String, default: "" },
        paragraphs: { type: [String], default: [] },
        funFact: { type: String, default: "" },
        targetUrl: { type: String, default: "" }, // E.g., link to read it
        active: { type: Boolean, default: true },
    },
    { timestamps: true }
);

// Feedback Model
const feedbackSchema = new mongoose.Schema(
    {
        type: { type: String, enum: ["God", "Drawing", "Family"], required: true },
        message: { type: String, required: true },
        imageUrl: { type: String, default: "" }, // For drawings or photos
        familyName: { type: String, default: "" },
        kidUsername: { type: String, default: "" },
        // If submitted by logged in user:
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true }
);

// Banner Model
const bannerSchema = new mongoose.Schema(
    {
        title: { type: String, required: true },
        kicker: { type: String, default: "" },
        imageUrl: { type: String, required: true },
        active: { type: Boolean, default: true },
        order: { type: Number, default: 0 },
    },
    { timestamps: true }
);

export const Magazine = mongoose.model("Magazine", magazineSchema);
export const Feedback = mongoose.model("Feedback", feedbackSchema);
export const Banner = mongoose.model("Banner", bannerSchema);
