import mongoose from "mongoose";

let connectionPromise;

function withoutLocalMetadata({ _id, createdAt, updatedAt, ...content }) {
  return content;
}

async function seedEmptyCollections() {
  const [{ Banner, Magazine }, { getBanners, getMagazines }] = await Promise.all([
    import("../models/Content.js"),
    import("./bannerStore.js"),
  ]);
  const [bannerCount, magazineCount] = await Promise.all([
    Banner.countDocuments(),
    Magazine.countDocuments(),
  ]);
  const writes = [];

  if (bannerCount === 0) {
    const banners = getBanners();
    if (banners.length > 0) writes.push(Banner.insertMany(banners.map(withoutLocalMetadata)));
  }
  if (magazineCount === 0) {
    const magazines = getMagazines();
    if (magazines.length > 0) writes.push(Magazine.insertMany(magazines.map(withoutLocalMetadata)));
  }

  if (writes.length > 0) {
    await Promise.all(writes);
    console.log("Seeded empty MongoDB collections from backend/data");
  }
}

export function getMongoUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  if (process.env.NODE_ENV === "production") {
    throw new Error("MONGODB_URI is required in production");
  }
  return "mongodb://localhost:27017/selamkids";
}

export function connectMongo() {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose.connection);
  if (connectionPromise) return connectionPromise;

  connectionPromise = mongoose
    .connect(getMongoUri(), {
      serverSelectionTimeoutMS: 10_000,
      maxPoolSize: 10,
    })
    .then(async () => {
      try {
        await seedEmptyCollections();
      } catch (error) {
        console.warn("Could not seed MongoDB from local data:", error.message);
      }
      console.log("✅ MongoDB connected");
      return mongoose.connection;
    })
    .catch((error) => {
      connectionPromise = undefined;
      throw error;
    });

  return connectionPromise;
}
