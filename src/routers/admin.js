import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc.js";
import { User } from "../models/User.js";
import { Order } from "../models/Order.js";
import { AdminLog } from "../models/AdminLog.js";
import { Product } from "../models/Product.js";
import { Category } from "../models/Category.js";
import { Review } from "../models/Review.js";

// Middleware: admin only
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user?.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

export const adminRouter = router({
  // Get dashboard stats
  getDashboard: adminProcedure.query(async () => {
    const [allOrders, totalUsers, totalProducts] = await Promise.all([
      Order.find().sort({ createdAt: -1 }).lean(),
      User.countDocuments(),
      Product.countDocuments()
    ]);

    const totalOrders = allOrders.length;
    const totalRevenue = allOrders.reduce((sum, order) => {
      const amount = parseFloat(order.totalPrice);
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);

    const recentOrders = allOrders.slice(0, 5).map(order => ({
      ...order,
      id: order._id.toString(),
      _id: undefined,
      user: order.user ? order.user.toString() : undefined
    }));

    return { totalOrders, totalRevenue, totalUsers, totalProducts, recentOrders };
  }),

  // Get all orders
  getOrders: adminProcedure.query(async () => {
    return await Order.find().sort({ createdAt: -1 }).lean();
  }),

  // Update order status
  updateOrderStatus: adminProcedure
    .input(z.object({
      orderId: z.string(),
      status: z.enum(["pending", "confirmed", "shipped", "delivered", "cancelled"]),
    }))
    .mutation(async ({ input, ctx }) => {
      await Order.findByIdAndUpdate(input.orderId, { status: input.status });
      await AdminLog.create({
        adminId: ctx.user._id || ctx.user.id,
        action: "UPDATE_ORDER_STATUS",
        entityType: "order",
        entityId: input.orderId,
        details: `Status changed to ${input.status}`,
      });
      return { success: true };
    }),

  // Users functionality removed as this is a guest checkout system

  // Get admin logs
  getLogs: adminProcedure.query(async () => {
    return await AdminLog.find().sort({ createdAt: -1 }).lean();
  }),

  /* -------------------------------------------------------------------------- */
  /*                               PRODUCTS CRUD                                */
  /* -------------------------------------------------------------------------- */
  
  createProduct: adminProcedure
    .input(z.object({
      title: z.string().min(1),
      handle: z.string().min(1),
      description: z.string().optional(),
      price: z.number().positive(),
      compareAtPrice: z.number().positive().nullable().optional(),
      isTrending: z.boolean().optional().default(false),
      categoryId: z.string(),
      imageUrl: z.preprocess(v => (v === "" || v == null) ? undefined : v, z.string().url().optional()),
      tags: z.array(z.string()).optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const existing = await Product.findOne({ handle: input.handle });
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Product handle already exists" });

      const newProduct = await Product.create({
        title: input.title,
        handle: input.handle.toLowerCase(),
        description: input.description,
        price: input.price,
        compareAtPrice: input.compareAtPrice,
        isTrending: input.isTrending,
        category: input.categoryId,
        images: input.imageUrl ? [{ url: input.imageUrl, altText: input.title }] : [],
        tags: input.tags || []
      });

      await AdminLog.create({
        adminId: ctx.user._id || ctx.user.id,
        action: "CREATE_PRODUCT",
        entityType: "product",
        entityId: newProduct._id,
        details: `Created product: ${input.title}`,
      });

      return newProduct;
    }),

  deleteProduct: adminProcedure
    .input(z.object({ productId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await Product.findByIdAndDelete(input.productId);
      await Review.deleteMany({ product: input.productId });
      
      await AdminLog.create({
        adminId: ctx.user._id || ctx.user.id,
        action: "DELETE_PRODUCT",
        entityType: "product",
        entityId: input.productId,
        details: `Deleted product ID: ${input.productId}`,
      });
      return { success: true };
    }),

  updateProduct: adminProcedure
    .input(z.object({
      productId: z.string(),
      title: z.string().min(1),
      description: z.string().optional(),
      price: z.number().positive(),
      compareAtPrice: z.number().positive().nullable().optional(),
      isTrending: z.boolean().optional().default(false),
      categoryId: z.string(),
      imageUrl: z.preprocess(v => (v === "" || v == null) ? undefined : v, z.string().url().optional()),
      tags: z.array(z.string()).optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const updated = await Product.findByIdAndUpdate(
        input.productId,
        {
          title: input.title,
          description: input.description,
          price: input.price,
          compareAtPrice: input.compareAtPrice,
          isTrending: input.isTrending,
          category: input.categoryId,
          ...(input.imageUrl && { images: [{ url: input.imageUrl, altText: input.title }] }),
          tags: input.tags || []
        },
        { new: true }
      );
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });

      await AdminLog.create({
        adminId: ctx.user._id || ctx.user.id,
        action: "UPDATE_PRODUCT",
        entityType: "product",
        entityId: input.productId,
        details: `Updated product: ${input.title}`,
      });
      return updated;
    }),

  /* -------------------------------------------------------------------------- */
  /*                              CATEGORIES CRUD                               */
  /* -------------------------------------------------------------------------- */

  createCategory: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      slug: z.string().min(1),
      image: z.string().url().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const existing = await Category.findOne({ $or: [{ name: input.name }, { slug: input.slug }] });
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Category name or slug already exists" });

      const newCategory = await Category.create({
        name: input.name,
        slug: input.slug.toLowerCase(),
        image: input.image
      });

      await AdminLog.create({
        adminId: ctx.user._id || ctx.user.id,
        action: "CREATE_CATEGORY",
        entityType: "category",
        entityId: newCategory._id,
        details: `Created category: ${input.name}`,
      });

      return newCategory;
    }),

  deleteCategory: adminProcedure
    .input(z.object({ categoryId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Check if products exist in this category
      const productsCount = await Product.countDocuments({ category: input.categoryId });
      if (productsCount > 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot delete category containing products" });
      }

      await Category.findByIdAndDelete(input.categoryId);
      
      await AdminLog.create({
        adminId: ctx.user._id || ctx.user.id,
        action: "DELETE_CATEGORY",
        entityType: "category",
        entityId: input.categoryId,
        details: `Deleted category ID: ${input.categoryId}`,
      });
      return { success: true };
    }),

  /* -------------------------------------------------------------------------- */
  /*                               REVIEWS MGT                                  */
  /* -------------------------------------------------------------------------- */

  getRecentReviews: adminProcedure.query(async () => {
    return await Review.find().sort({ createdAt: -1 }).limit(20).populate("product", "title").lean();
  }),

  deleteReview: adminProcedure
    .input(z.object({ reviewId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const review = await Review.findById(input.reviewId);
      if (review) {
        // Mongoose middleware on remove takes care of updating average
        await review.deleteOne();
      }
      return { success: true };
    }),

  createReview: adminProcedure
    .input(z.object({
      productId: z.string().min(1),
      authorName: z.string().min(1),
      rating: z.number().min(1).max(5),
      comment: z.string().min(1)
    }))
    .mutation(async ({ input, ctx }) => {
      const review = await Review.create({
        product: input.productId,
        authorName: input.authorName,
        rating: input.rating,
        comment: input.comment
      });

      await AdminLog.create({
        adminId: ctx.user._id || ctx.user.id,
        action: "CREATE_REVIEW",
        entityType: "review",
        entityId: review._id,
        details: `Created review for product ${input.productId}`,
      });

      return { success: true, review };
    }),

  updateReview: adminProcedure
    .input(z.object({
      reviewId: z.string().min(1),
      authorName: z.string().min(1).optional(),
      rating: z.number().min(1).max(5).optional(),
      comment: z.string().min(1).optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const { reviewId, ...updates } = input;
      const review = await Review.findByIdAndUpdate(reviewId, updates, { new: true });
      if (!review) throw new TRPCError({ code: "NOT_FOUND", message: "Review not found" });

      await AdminLog.create({
        adminId: ctx.user._id || ctx.user.id,
        action: "UPDATE_REVIEW",
        entityType: "review",
        entityId: review._id,
        details: `Updated review ${review._id}`,
      });

      return { success: true, review };
    }),

  autoGenerateDescription: adminProcedure
    .input(z.object({ title: z.string(), category: z.string().optional() }))
    .mutation(async ({ input }) => {
      const { title, category } = input;
      const t = title || "This product";
      const c = category ? category.toLowerCase() : "item";
      
      const templates = [
        `Elevate your everyday style with ${t}. Designed with both comfort and aesthetics in mind, this premium ${c} features high-quality materials and a modern silhouette. Perfect for any occasion, it seamlessly blends durability with contemporary fashion. Experience the perfect balance of form and function.`,
        `Meet your new wardrobe essential: ${t}. Crafted meticulously for the modern trendsetter, this ${c} offers an unbeatable combination of utility and street-ready style. Its versatile design ensures you stay comfortable while looking sharp, no matter where the day takes you.`,
        `Discover the ultimate upgrade with ${t}. We've re-engineered the classic ${c} to deliver superior performance and timeless appeal. Boasting meticulous stitching and an optimized fit, it's the definitive choice for those who demand excellence in their daily wear.`,
      ];
      
      const description = templates[Math.floor(Math.random() * templates.length)];
      return { success: true, description };
    }),

  autoGenerateReviews: adminProcedure
    .input(z.object({ productId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const names = ["Rohan S.", "Priya M.", "Karan V.", "Aisha K.", "Rahul D.", "Neha P.", "Amit R.", "Sneha B.", "Vikram T.", "Pooja C."];
      const comments = [
        "Absolutely love this! The quality is amazing for the price.",
        "Fits perfectly. Will definitely buy more from this store.",
        "Really good material. Exceeded my expectations.",
        "Super fast delivery and great packaging. Highly recommended.",
        "Very comfortable to wear. Matches the photos perfectly.",
        "Great addition to my wardrobe! Everyone asked me where I got it.",
        "Premium feel without the premium price tag. 5 stars!",
        "The fabric feels so rich. Very happy with this purchase."
      ];

      const reviewsToCreate = [];
      for (let i = 0; i < 5; i++) {
        const randomName = names[Math.floor(Math.random() * names.length)];
        const randomComment = comments[Math.floor(Math.random() * comments.length)];
        const randomRating = 5; // Always 5 stars

        reviewsToCreate.push({
          product: input.productId,
          authorName: randomName,
          rating: randomRating,
          comment: randomComment
        });
      }

      await Review.insertMany(reviewsToCreate);

      // Trigger the post save logic manually since insertMany bypasses it
      const productReviews = await Review.find({ product: input.productId });
      if (productReviews.length > 0) {
        const avgRating = productReviews.reduce((acc, item) => item.rating + acc, 0) / productReviews.length;
        await Product.findByIdAndUpdate(input.productId, {
          averageRating: avgRating,
          totalReviews: productReviews.length
        });
      }

      await AdminLog.create({
        adminId: ctx.user._id || ctx.user.id,
        action: "AUTO_GENERATE_REVIEWS",
        entityType: "product",
        entityId: input.productId,
        details: "Auto-generated 5 reviews"
      });

      return { success: true, count: 5 };
    }),

  /* -------------------------------------------------------------------------- */
  /*                               SETTINGS MGT                                 */
  /* -------------------------------------------------------------------------- */
  
  getSettings: adminProcedure.query(async () => {
    // Dynamic import to avoid circular dependencies if any
    const { SiteSettings } = await import("../models/SiteSettings.js");
    return await SiteSettings.getSettings();
  }),

  updateSettings: adminProcedure
    .input(z.object({
      storeName: z.string().min(1),
      supportEmail: z.string().email(),
      supportPhone: z.string().min(1),
      storeAddress: z.string().min(1),
      instagramUrl: z.string().url().or(z.literal(''))
    }))
    .mutation(async ({ input, ctx }) => {
      const { SiteSettings } = await import("../models/SiteSettings.js");
      const settings = await SiteSettings.getSettings();
      
      settings.storeName = input.storeName;
      settings.supportEmail = input.supportEmail;
      settings.supportPhone = input.supportPhone;
      settings.storeAddress = input.storeAddress;
      settings.instagramUrl = input.instagramUrl;
      await settings.save();

      await AdminLog.create({
        adminId: ctx.user._id || ctx.user.id,
        action: "UPDATE_SETTINGS",
        entityType: "settings",
        entityId: settings._id,
        details: "Updated global store settings",
      });

      return { success: true, settings };
    }),
});
