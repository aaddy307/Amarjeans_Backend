import "dotenv/config";
import mongoose from 'mongoose';

async function dropIndex() {
  const url = process.env.MONGODB_URL;
  if (!url) throw new Error("MONGODB_URL is not set in .env");

  await mongoose.connect(url);
  try {
    await mongoose.connection.collection('reviews').dropIndex('product_1_user_1');
    console.log('Index dropped successfully');
  } catch (err) {
    console.error('Error dropping index:', err.message);
  }
  process.exit(0);
}

dropIndex();
