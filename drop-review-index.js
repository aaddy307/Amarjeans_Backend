import mongoose from 'mongoose';

async function dropIndex() {
  await mongoose.connect('mongodb://localhost:27017/amar_jeans');
  try {
    await mongoose.connection.collection('reviews').dropIndex('product_1_user_1');
    console.log('Index dropped successfully');
  } catch (err) {
    console.error('Error dropping index:', err.message);
  }
  process.exit(0);
}

dropIndex();
