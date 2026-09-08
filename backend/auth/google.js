import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js";

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL,
        },
        async (_accessToken, _refreshToken, profile, done) => {
            try {
                let user = await User.findOne({ googleId: profile.id });

                if (!user) {
                    // Generate a unique username from display name
                    const base = (profile.displayName || profile.emails?.[0]?.value?.split("@")[0] || "user")
                        .toLowerCase()
                        .replace(/[^a-z0-9]/g, "");
                    let username = base;
                    let count = 1;
                    while (await User.findOne({ username })) {
                        username = `${base}${count++}`;
                    }

                    user = await User.create({
                        googleId: profile.id,
                        email: profile.emails?.[0]?.value ?? "",
                        displayName: profile.displayName ?? "",
                        username,
                        avatarUrl: profile.photos?.[0]?.value ?? "",
                        legacyPoints: 0,
                    });
                }

                return done(null, user);
            } catch (err) {
                return done(err, null);
            }
        }
    )
);

export default passport;
