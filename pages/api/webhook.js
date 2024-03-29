import "@/preserve.entity.config.json";
import { buffer } from "micro";
import prisma from "@/prisma/prisma";

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_SIGNING_SECRET;

const fullfillOrder = async (session) => {
  console.log(`✅ ORDER PLACED SUCCESS: ${session.id}`);

  let user = await prisma.user.findUnique({
    where: { email: session.metadata.email },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: session.metadata.email,
      },
    });
  }

  await prisma.order.create({
    data: {
      transactionId: session.id,
      amountTotal: session.amount_total / 100,
      name: session.metadata.name,
      mobile: session.metadata.mobile,
      address: session.metadata.address,
      courseTitle: session.metadata.courseTitle,
      courseId: session.metadata.courseId,
      user: {
        connect: { id: user.id },
      },
    },
  });

  return;
};

async function webhook(req, res) {
  if (req.method === "POST") {
    const requestBuffer = await buffer(req);
    const payload = requestBuffer.toString();
    const sig = req.headers["stripe-signature"];

    let event;

    try {
      event = stripe.webhooks.constructEvent(payload, sig, endpointSecret);
    } catch (error) {
      console.log(`❌️ WEBHOOK ERROR, ${error.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      try {
        await fullFillOrder(session);
      } catch (error) {
        console.log(`❌️ DB ERROR, ${error.message}`);
      }

      console.log(`🟢️ DATA UPDATED:`, session.id);
      return res.status(200).send(`DATA UPLOADED: ${session.id}`);
    }
  }
}

export default webhook;

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};
