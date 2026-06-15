/**
 * Shopify Storefront API adapter — pure JavaScript.
 */
import { TRPCError } from "@trpc/server";
import { normalizeCart, normalizeCollection, normalizeProduct } from "./shopifyNormalize.js";

export const SHOPIFY_API_VERSION = "2025-04";

function getShopifyStoreDomain() {
  return process.env.SHOPIFY_STORE_DOMAIN ?? "";
}
function getShopifyStorefrontToken() {
  return process.env.SHOPIFY_STOREFRONT_API_ACCESS_TOKEN ?? "";
}
export function isShopifyConfigured() {
  return Boolean(getShopifyStoreDomain() && getShopifyStorefrontToken());
}
function shopifyStorefrontEndpoint() {
  return `https://${getShopifyStoreDomain()}/api/${SHOPIFY_API_VERSION}/graphql.json`;
}

async function storefrontFetch(query, variables) {
  if (!isShopifyConfigured()) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Shopify Storefront API is not configured. Add SHOPIFY_STORE_DOMAIN and SHOPIFY_STOREFRONT_API_ACCESS_TOKEN to your .env file.",
    });
  }

  let response;
  try {
    response = await fetch(shopifyStorefrontEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": getShopifyStorefrontToken(),
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch (err) {
    console.error("[Shopify] Network error", err);
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Shopify Storefront API is unreachable" });
  }

  if (!response.ok) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Shopify returned HTTP ${response.status}` });
  }

  const json = await response.json();
  if (json.errors?.length) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: json.errors[0].message });
  }
  if (!json.data) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Shopify returned no data" });
  }
  return json.data;
}

function unwrapCart(payload, context) {
  if (payload.userErrors?.length) {
    throw new TRPCError({ code: "BAD_REQUEST", message: payload.userErrors[0].message });
  }
  if (!payload.cart) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `${context} returned no cart` });
  }
  return normalizeCart(payload.cart);
}

// GraphQL Fragments
const MONEY_FRAGMENT = `fragment MoneyFields on MoneyV2 { amount currencyCode }`;
const IMAGE_FRAGMENT = `fragment ImageFields on Image { url altText width height }`;
const VARIANT_FRAGMENT = `${MONEY_FRAGMENT}
  fragment VariantFields on ProductVariant {
    id title availableForSale
    price { ...MoneyFields }
    compareAtPrice { ...MoneyFields }
    selectedOptions { name value }
  }`;
const PRODUCT_FRAGMENT = `${IMAGE_FRAGMENT} ${VARIANT_FRAGMENT}
  fragment ProductFields on Product {
    id title handle description descriptionHtml productType vendor tags
    options { name values }
    priceRange {
      minVariantPrice { ...MoneyFields }
      maxVariantPrice { ...MoneyFields }
    }
    images(first: 8) { edges { node { ...ImageFields } } }
    variants(first: 25) { edges { node { ...VariantFields } } }
  }`;
const COLLECTION_FRAGMENT = `${IMAGE_FRAGMENT}
  fragment CollectionFields on Collection {
    id handle title description image { ...ImageFields }
  }`;
const CART_FRAGMENT = `${MONEY_FRAGMENT}
  fragment CartFields on Cart {
    id checkoutUrl totalQuantity
    cost {
      totalAmount { ...MoneyFields }
      subtotalAmount { ...MoneyFields }
    }
    lines(first: 100) {
      edges {
        node {
          id quantity
          cost { totalAmount { ...MoneyFields } }
          merchandise {
            ... on ProductVariant {
              id title price { ...MoneyFields }
              product { handle title images(first: 1) { edges { node { url altText width height } } } }
            }
          }
        }
      }
    }
  }`;

const dummyProducts = [
  { id: "gid://shopify/Product/1", handle: "casual-shirt", title: "Premium Casual Shirt", description: "High-quality cotton blend shirt perfect for any occasion.", descriptionHtml: "<p>High-quality cotton blend shirt perfect for any occasion.</p>", productType: "Shirts", vendor: "AMAR JEANS", tags: ["Shirts", "Casual", "Cotton"], images: [{ url: "https://images.unsplash.com/photo-1596755094514-f87e32f6b717?w=1000", altText: "Shirt", width: 1000, height: 1000 }], priceRange: { min: { amount: "1299.00", currencyCode: "INR" }, max: { amount: "1299.00", currencyCode: "INR" } }, options: [{ name: "Size", values: ["M", "L", "XL"] }], variants: [{ id: "gid://shopify/ProductVariant/1", title: "L", price: { amount: "1299.00", currencyCode: "INR" }, compareAtPrice: null, availableForSale: true, selectedOptions: [{ name: "Size", value: "L" }] }] },
  { id: "gid://shopify/Product/2", handle: "graphic-tshirt", title: "Graphic T-Shirt", description: "Comfortable everyday t-shirt with premium print.", descriptionHtml: "<p>Comfortable everyday t-shirt with premium print.</p>", productType: "T Shirts", vendor: "AMAR JEANS", tags: ["T Shirts", "Casual"], images: [{ url: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1000", altText: "T Shirt", width: 1000, height: 1000 }], priceRange: { min: { amount: "699.00", currencyCode: "INR" }, max: { amount: "699.00", currencyCode: "INR" } }, options: [{ name: "Size", values: ["S", "M", "L"] }], variants: [{ id: "gid://shopify/ProductVariant/2", title: "M", price: { amount: "699.00", currencyCode: "INR" }, compareAtPrice: null, availableForSale: true, selectedOptions: [{ name: "Size", value: "M" }] }] },
  { id: "gid://shopify/Product/3", handle: "classic-denim", title: "Classic Blue Jeans", description: "Durable classic denim jeans.", descriptionHtml: "<p>Durable classic denim jeans.</p>", productType: "Jeans", vendor: "AMAR JEANS", tags: ["Jeans", "Denim"], images: [{ url: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=1000", altText: "Jeans", width: 1000, height: 1000 }], priceRange: { min: { amount: "2499.00", currencyCode: "INR" }, max: { amount: "2499.00", currencyCode: "INR" } }, options: [{ name: "Size", values: ["30", "32", "34"] }], variants: [{ id: "gid://shopify/ProductVariant/3", title: "32", price: { amount: "2499.00", currencyCode: "INR" }, compareAtPrice: null, availableForSale: true, selectedOptions: [{ name: "Size", value: "32" }] }] },
  { id: "gid://shopify/Product/4", handle: "cotton-trousers", title: "Formal Cotton Pants", description: "Breathable formal cotton pants.", descriptionHtml: "<p>Breathable formal cotton pants.</p>", productType: "Cotton Pants", vendor: "AMAR JEANS", tags: ["Cotton Pants", "Formal"], images: [{ url: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=1000", altText: "Pants", width: 1000, height: 1000 }], priceRange: { min: { amount: "1899.00", currencyCode: "INR" }, max: { amount: "1899.00", currencyCode: "INR" } }, options: [{ name: "Size", values: ["32", "34"] }], variants: [{ id: "gid://shopify/ProductVariant/4", title: "32", price: { amount: "1899.00", currencyCode: "INR" }, compareAtPrice: null, availableForSale: true, selectedOptions: [{ name: "Size", value: "32" }] }] },
  { id: "gid://shopify/Product/5", handle: "gym-sando", title: "Active Gym Sando", description: "Sweat-wicking gym sando for workouts.", descriptionHtml: "<p>Sweat-wicking gym sando for workouts.</p>", productType: "Sando", vendor: "AMAR JEANS", tags: ["Sando", "Activewear"], images: [{ url: "https://images.unsplash.com/photo-1503342394128-c104d54dba01?w=1000", altText: "Sando", width: 1000, height: 1000 }], priceRange: { min: { amount: "399.00", currencyCode: "INR" }, max: { amount: "399.00", currencyCode: "INR" } }, options: [{ name: "Size", values: ["M", "L"] }], variants: [{ id: "gid://shopify/ProductVariant/5", title: "M", price: { amount: "399.00", currencyCode: "INR" }, compareAtPrice: null, availableForSale: true, selectedOptions: [{ name: "Size", value: "M" }] }] },
  { id: "gid://shopify/Product/6", handle: "comfort-underwear", title: "Premium Underwear Set", description: "Super soft cotton underwear.", descriptionHtml: "<p>Super soft cotton underwear.</p>", productType: "Underwear", vendor: "AMAR JEANS", tags: ["Underwear", "Essentials"], images: [{ url: "https://images.unsplash.com/photo-1621516439121-7241286c8d45?w=1000", altText: "Underwear", width: 1000, height: 1000 }], priceRange: { min: { amount: "599.00", currencyCode: "INR" }, max: { amount: "599.00", currencyCode: "INR" } }, options: [{ name: "Size", values: ["M", "L"] }], variants: [{ id: "gid://shopify/ProductVariant/6", title: "M", price: { amount: "599.00", currencyCode: "INR" }, compareAtPrice: null, availableForSale: true, selectedOptions: [{ name: "Size", value: "M" }] }] },
  { id: "gid://shopify/Product/7", handle: "summer-shorts", title: "Summer Casual Shorts", description: "Lightweight shorts for summer days.", descriptionHtml: "<p>Lightweight shorts for summer days.</p>", productType: "Shots", vendor: "AMAR JEANS", tags: ["Shots", "Summer"], images: [{ url: "https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=1000", altText: "Shorts", width: 1000, height: 1000 }], priceRange: { min: { amount: "899.00", currencyCode: "INR" }, max: { amount: "899.00", currencyCode: "INR" } }, options: [{ name: "Size", values: ["30", "32"] }], variants: [{ id: "gid://shopify/ProductVariant/7", title: "32", price: { amount: "899.00", currencyCode: "INR" }, compareAtPrice: null, availableForSale: true, selectedOptions: [{ name: "Size", value: "32" }] }] },
  { id: "gid://shopify/Product/8", handle: "track-pants", title: "Athletic Track Pants", description: "Comfortable track pants for lounging or running.", descriptionHtml: "<p>Comfortable track pants for lounging or running.</p>", productType: "Track pants", vendor: "AMAR JEANS", tags: ["Track pants", "Activewear"], images: [{ url: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=1000", altText: "Track Pants", width: 1000, height: 1000 }], priceRange: { min: { amount: "1099.00", currencyCode: "INR" }, max: { amount: "1099.00", currencyCode: "INR" } }, options: [{ name: "Size", values: ["M", "L"] }], variants: [{ id: "gid://shopify/ProductVariant/8", title: "L", price: { amount: "1099.00", currencyCode: "INR" }, compareAtPrice: null, availableForSale: true, selectedOptions: [{ name: "Size", value: "L" }] }] },
  { id: "gid://shopify/Product/9", handle: "classic-hoddie", title: "Winter Warm Hoodie", description: "Thick cotton hoodie for winter.", descriptionHtml: "<p>Thick cotton hoodie for winter.</p>", productType: "Hoddie", vendor: "AMAR JEANS", tags: ["Hoddie", "Winter"], images: [{ url: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=1000", altText: "Hoodie", width: 1000, height: 1000 }], priceRange: { min: { amount: "1999.00", currencyCode: "INR" }, max: { amount: "1999.00", currencyCode: "INR" } }, options: [{ name: "Size", values: ["L", "XL"] }], variants: [{ id: "gid://shopify/ProductVariant/9", title: "L", price: { amount: "1999.00", currencyCode: "INR" }, compareAtPrice: null, availableForSale: true, selectedOptions: [{ name: "Size", value: "L" }] }] },
  { id: "gid://shopify/Product/10", handle: "rain-coat", title: "Waterproof Rain Coat", description: "High-quality waterproof raincoat.", descriptionHtml: "<p>High-quality waterproof raincoat.</p>", productType: "Rain cot", vendor: "AMAR JEANS", tags: ["Rain cot", "Monsoon"], images: [{ url: "https://images.unsplash.com/photo-1525244510065-27ecaa9b3d1b?w=1000", altText: "Raincoat", width: 1000, height: 1000 }], priceRange: { min: { amount: "1499.00", currencyCode: "INR" }, max: { amount: "1499.00", currencyCode: "INR" } }, options: [{ name: "Size", values: ["Free Size"] }], variants: [{ id: "gid://shopify/ProductVariant/10", title: "Free Size", price: { amount: "1499.00", currencyCode: "INR" }, compareAtPrice: null, availableForSale: true, selectedOptions: [{ name: "Size", value: "Free Size" }] }] },
  { id: "gid://shopify/Product/11", handle: "cotton-towel", title: "Soft Bath Towel", description: "Ultra-absorbent soft cotton bath towel.", descriptionHtml: "<p>Ultra-absorbent soft cotton bath towel.</p>", productType: "Towel", vendor: "AMAR JEANS", tags: ["Towel", "Essentials"], images: [{ url: "https://images.unsplash.com/photo-1616627561839-074385245ca6?w=1000", altText: "Towel", width: 1000, height: 1000 }], priceRange: { min: { amount: "499.00", currencyCode: "INR" }, max: { amount: "499.00", currencyCode: "INR" } }, options: [{ name: "Color", values: ["White", "Blue"] }], variants: [{ id: "gid://shopify/ProductVariant/11", title: "White", price: { amount: "499.00", currencyCode: "INR" }, compareAtPrice: null, availableForSale: true, selectedOptions: [{ name: "Color", value: "White" }] }] }
];

// Catalog
export async function listProducts(options = {}) {
  if (!isShopifyConfigured()) {
    return dummyProducts;
  }

  const first = options.first ?? 24;
  if (options.collectionHandle) {
    const data = await storefrontFetch(
      `${PRODUCT_FRAGMENT}
       query productsByCollection($handle: String!, $first: Int!) {
         collection(handle: $handle) {
           products(first: $first) { edges { node { ...ProductFields } } }
         }
       }`,
      { handle: options.collectionHandle, first }
    );
    if (!data.collection) return [];
    return data.collection.products.edges.map(e => normalizeProduct(e.node));
  }

  const data = await storefrontFetch(
    `${PRODUCT_FRAGMENT}
     query listProducts($first: Int!) {
       products(first: $first, sortKey: TITLE) { edges { node { ...ProductFields } } }
     }`,
    { first }
  );
  return data.products.edges.map(e => normalizeProduct(e.node));
}

export async function getProductByHandle(handle) {
  if (!isShopifyConfigured()) {
    const product = dummyProducts.find(p => p.handle === handle);
    if (!product) throw new TRPCError({ code: "NOT_FOUND", message: `Product "${handle}" not found` });
    return product;
  }

  const data = await storefrontFetch(
    `${PRODUCT_FRAGMENT}
     query productByHandle($handle: String!) {
       productByHandle(handle: $handle) { ...ProductFields }
     }`,
    { handle }
  );
  if (!data.productByHandle) {
    throw new TRPCError({ code: "NOT_FOUND", message: `Product "${handle}" not found` });
  }
  return normalizeProduct(data.productByHandle);
}

export async function listCollections(first = 10) {
  const data = await storefrontFetch(
    `${COLLECTION_FRAGMENT}
     query listCollections($first: Int!) {
       collections(first: $first) { edges { node { ...CollectionFields } } }
     }`,
    { first }
  );
  return data.collections.edges.map(e => normalizeCollection(e.node));
}

export async function getCollectionByHandle(handle) {
  const data = await storefrontFetch(
    `${COLLECTION_FRAGMENT}
     query collectionByHandle($handle: String!) {
       collection(handle: $handle) { ...CollectionFields }
     }`,
    { handle }
  );
  if (!data.collection) {
    throw new TRPCError({ code: "NOT_FOUND", message: `Collection "${handle}" not found` });
  }
  return normalizeCollection(data.collection);
}

// Cart
export async function createCart(lines) {
  const data = await storefrontFetch(
    `${CART_FRAGMENT}
     mutation cartCreate($input: CartInput!) {
       cartCreate(input: $input) {
         cart { ...CartFields }
         userErrors { code field message }
       }
     }`,
    { input: { lines: lines.map(l => ({ merchandiseId: l.variantId, quantity: l.quantity })) } }
  );
  return unwrapCart(data.cartCreate, "cartCreate");
}

export async function getCart(cartId) {
  const data = await storefrontFetch(
    `${CART_FRAGMENT}
     query getCart($cartId: ID!) {
       cart(id: $cartId) { ...CartFields }
     }`,
    { cartId }
  );
  return data.cart ? normalizeCart(data.cart) : null;
}

export async function addCartLines(cartId, lines) {
  const data = await storefrontFetch(
    `${CART_FRAGMENT}
     mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
       cartLinesAdd(cartId: $cartId, lines: $lines) {
         cart { ...CartFields }
         userErrors { code field message }
       }
     }`,
    { cartId, lines: lines.map(l => ({ merchandiseId: l.variantId, quantity: l.quantity })) }
  );
  return unwrapCart(data.cartLinesAdd, "cartLinesAdd");
}

export async function updateCartLines(cartId, updates) {
  const data = await storefrontFetch(
    `${CART_FRAGMENT}
     mutation cartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
       cartLinesUpdate(cartId: $cartId, lines: $lines) {
         cart { ...CartFields }
         userErrors { code field message }
       }
     }`,
    { cartId, lines: updates.map(u => ({ id: u.lineId, quantity: u.quantity })) }
  );
  return unwrapCart(data.cartLinesUpdate, "cartLinesUpdate");
}

export async function removeCartLines(cartId, lineIds) {
  const data = await storefrontFetch(
    `${CART_FRAGMENT}
     mutation cartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
       cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
         cart { ...CartFields }
         userErrors { code field message }
       }
     }`,
    { cartId, lineIds }
  );
  return unwrapCart(data.cartLinesRemove, "cartLinesRemove");
}
