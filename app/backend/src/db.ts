import mongoose from "mongoose";

export async function connectMongo() {
  const uri = process.env.MONGODB_URI || "";
  if (!uri) {
    console.warn("MONGODB_URI not set, skipping connection");
    return;
  }
  await mongoose.connect(uri);
}
