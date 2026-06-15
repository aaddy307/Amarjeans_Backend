import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  image: {
    type: String,
    default: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=800"
  }
}, { timestamps: true });

export const Category = mongoose.model('Category', categorySchema);
