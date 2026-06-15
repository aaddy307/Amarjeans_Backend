import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  authorName: {
    type: String,
    required: true,
    trim: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    required: true,
    trim: true
  }
}, { timestamps: true });

// Unique constraints removed as we auto-generate multiple reviews

// After saving a review, update the product's average rating
reviewSchema.post('save', async function() {
  const Product = mongoose.model('Product');
  const reviews = await this.constructor.find({ product: this.product });
  
  if (reviews.length > 0) {
    const avgRating = reviews.reduce((acc, item) => item.rating + acc, 0) / reviews.length;
    await Product.findByIdAndUpdate(this.product, {
      averageRating: avgRating,
      totalReviews: reviews.length
    });
  }
});

// Also handle when a review is deleted
reviewSchema.post('remove', async function() {
  const Product = mongoose.model('Product');
  const reviews = await this.constructor.find({ product: this.product });
  
  if (reviews.length > 0) {
    const avgRating = reviews.reduce((acc, item) => item.rating + acc, 0) / reviews.length;
    await Product.findByIdAndUpdate(this.product, {
      averageRating: avgRating,
      totalReviews: reviews.length
    });
  } else {
    await Product.findByIdAndUpdate(this.product, {
      averageRating: 0,
      totalReviews: 0
    });
  }
});

export const Review = mongoose.model('Review', reviewSchema);
