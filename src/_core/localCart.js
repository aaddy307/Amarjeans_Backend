import { Cart } from "../models/Cart.js";
import { Product } from "../models/Product.js";

function formatMoney(amount) {
  return { amount: amount.toString(), currencyCode: "INR" };
}

function formatCart(cartDoc) {
  let totalQuantity = 0;
  let totalAmount = 0;
  
  const items = cartDoc.items.map(item => {
    totalQuantity += item.quantity;
    const price = item.product?.price || 0;
    const lineTotal = price * item.quantity;
    totalAmount += lineTotal;
    
    const img = (item.product?.images && item.product.images.length > 0) 
      ? { url: item.product.images[0].url, width: 500, height: 500, altText: item.product.images[0].altText || "" } 
      : (item.product?.imageUrl ? { url: item.product.imageUrl, width: 500, height: 500, altText: "" } : null);
    
    return {
      lineId: item._id.toString(),
      variantId: item.product?._id.toString() || "unknown",
      productHandle: item.product?.handle || "unknown",
      productTitle: item.product?.title || "Unknown",
      variantTitle: "Default",
      image: img,
      unitPrice: formatMoney(price),
      quantity: item.quantity,
      lineTotal: formatMoney(lineTotal),
    };
  }).filter(i => i.variantId !== "unknown");

  return {
    id: cartDoc._id.toString(),
    checkoutUrl: "/checkout",
    items,
    itemCount: totalQuantity,
    subtotal: formatMoney(totalAmount),
    total: formatMoney(totalAmount),
  };
}

export async function createCart(lines) {
  const cart = new Cart({ items: [] });
  for (const line of lines) {
    cart.items.push({ product: line.variantId, quantity: line.quantity });
  }
  await cart.save();
  await cart.populate('items.product');
  return formatCart(cart);
}

export async function getCart(cartId) {
  try {
    const cart = await Cart.findById(cartId).populate('items.product');
    if (!cart) return null;
    return formatCart(cart);
  } catch(e) {
    return null;
  }
}

export async function addCartLines(cartId, lines) {
  const cart = await Cart.findById(cartId);
  if (!cart) throw new Error("Cart not found");
  
  for (const line of lines) {
    const existing = cart.items.find(i => i.product.toString() === line.variantId);
    if (existing) {
      existing.quantity += line.quantity;
    } else {
      cart.items.push({ product: line.variantId, quantity: line.quantity });
    }
  }
  await cart.save();
  await cart.populate('items.product');
  return formatCart(cart);
}

export async function updateCartLines(cartId, lines) {
  const cart = await Cart.findById(cartId);
  if (!cart) throw new Error("Cart not found");
  
  for (const line of lines) {
    const existing = cart.items.id(line.lineId);
    if (existing) {
      existing.quantity = line.quantity;
    }
  }
  await cart.save();
  await cart.populate('items.product');
  return formatCart(cart);
}

export async function removeCartLines(cartId, lineIds) {
  const cart = await Cart.findById(cartId);
  if (!cart) throw new Error("Cart not found");
  
  for (const lineId of lineIds) {
    cart.items.pull(lineId);
  }
  await cart.save();
  await cart.populate('items.product');
  return formatCart(cart);
}
