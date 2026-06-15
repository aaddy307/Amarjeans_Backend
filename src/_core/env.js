export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "amar-jeans-super-secret-key-2024",
  mongodbUrl: process.env.MONGODB_URL ?? "mongodb://localhost:27017/amar_jeans",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  shopifyStoreDomain: process.env.SHOPIFY_STORE_DOMAIN ?? "",
  shopifyStorefrontAccessToken: process.env.SHOPIFY_STOREFRONT_API_ACCESS_TOKEN ?? "",
  adminEmail: process.env.ADMIN_EMAIL ?? "admin@amarjeans.com",
  adminPassword: process.env.ADMIN_PASSWORD ?? "amarjeansadmin",
};
