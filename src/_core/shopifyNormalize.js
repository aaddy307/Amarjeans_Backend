/**
 * Shopify normalize helpers — pure JavaScript.
 * Converts raw Shopify Storefront API shapes to backend-agnostic objects.
 */

function normalizeMoney(m) {
  return { amount: m.amount, currencyCode: m.currencyCode };
}

function normalizeImage(i) {
  return { url: i.url, altText: i.altText ?? null, width: i.width, height: i.height };
}

function normalizeProductOption(o) {
  return { name: o.name, values: o.values };
}

function normalizeVariant(v) {
  return {
    id: v.id,
    title: v.title,
    price: normalizeMoney(v.price),
    compareAtPrice: v.compareAtPrice ? normalizeMoney(v.compareAtPrice) : null,
    availableForSale: v.availableForSale,
    selectedOptions: (v.selectedOptions ?? []).map(o => ({ name: o.name, value: o.value })),
  };
}

export function normalizeProduct(p) {
  return {
    id: p.id,
    handle: p.handle,
    title: p.title,
    description: p.description,
    descriptionHtml: p.descriptionHtml,
    productType: p.productType || null,
    vendor: p.vendor || null,
    tags: p.tags ?? [],
    images: p.images.edges.map(e => normalizeImage(e.node)),
    priceRange: {
      min: normalizeMoney(p.priceRange.minVariantPrice),
      max: normalizeMoney(p.priceRange.maxVariantPrice),
    },
    options: (p.options ?? []).map(normalizeProductOption),
    variants: p.variants.edges.map(e => normalizeVariant(e.node)),
  };
}

export function normalizeCollection(c) {
  return {
    id: c.id,
    handle: c.handle,
    title: c.title,
    description: c.description,
    image: c.image ? normalizeImage(c.image) : null,
  };
}

function normalizeCartItem(line) {
  const img = line.merchandise.product.images.edges[0]?.node ?? null;
  return {
    lineId: line.id,
    variantId: line.merchandise.id,
    productHandle: line.merchandise.product.handle,
    productTitle: line.merchandise.product.title,
    variantTitle: line.merchandise.title,
    image: img ? normalizeImage(img) : null,
    unitPrice: normalizeMoney(line.merchandise.price),
    quantity: line.quantity,
    lineTotal: normalizeMoney(line.cost.totalAmount),
  };
}

export function withChannelParam(checkoutUrl) {
  if (!checkoutUrl) return checkoutUrl;
  return checkoutUrl.includes("?")
    ? `${checkoutUrl}&channel=online_store`
    : `${checkoutUrl}?channel=online_store`;
}

export function normalizeCart(c) {
  return {
    id: c.id,
    checkoutUrl: withChannelParam(c.checkoutUrl),
    items: c.lines.edges.map(e => normalizeCartItem(e.node)),
    itemCount: c.totalQuantity,
    subtotal: normalizeMoney(c.cost.subtotalAmount),
    total: normalizeMoney(c.cost.totalAmount),
  };
}
