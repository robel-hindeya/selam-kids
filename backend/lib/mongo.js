import mongoose from "mongoose";

let connectionPromise;

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
    .then(() => {
      console.log("✅ MongoDB connected");
      return mongoose.connection;
    })
    .catch((error) => {
      connectionPromise = undefined;
      throw error;
    });

  return connectionPromise;
}
