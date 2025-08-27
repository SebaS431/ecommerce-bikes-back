"use strict";

// @ts-ignore
const stripe = require('stripe')(process.env.STRIPE_KEY);

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::order.order', ({ strapi }) => ({
  async create(ctx) {
    const { products } = ctx.request.body;

    try {
      console.log("BODY:", ctx.request.body);

      const lineItems = await Promise.all(
        products.map(async (product) => {
          console.log("PRODUCT:", product);

          const item = await strapi.service("api::product.product").findOne(product.documentId);

          console.log("ITEM:", item);

          return {
            price_data: {
              currency: "eur",
              product_data: {
                name: item.productName, // ⚠️ chequeá que este campo exista
              },
              unit_amount: Math.round(item.price * 100),
            },
            quantity: 1,
          };
        })
      );

      console.log("LINE ITEMS:", lineItems);

      const session = await stripe.checkout.sessions.create({
        shipping_address_collection: { allowed_countries: ["AR", "ES"] },
        payment_method_types: ["card"],
        mode: "payment",
        success_url: process.env.CLIENT_URL + "/success",
        cancel_url: process.env.CLIENT_URL + "/successError",
        line_items: lineItems,
      });

      await strapi.service("api::order.order").create({
        data: {
          products: products.map(p => p.id), // importante: IDs
          stripeId: session.id,
        }
      });

      return { stripeSession: session };

    } catch (error) {
      console.error("ERROR EN ORDER:", error);
      ctx.response.status = 500;
      return { error: error.message };
    }
  }
}))
