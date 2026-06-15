import { z } from "zod";
import { publicProcedure, adminProcedure, router } from "./trpc.js";

export const systemRouter = router({
  health: publicProcedure
    .input(z.object({ timestamp: z.number().min(0) }))
    .query(() => ({ ok: true })),

  notifyOwner: adminProcedure
    .input(z.object({
      title: z.string().min(1),
      content: z.string().min(1),
    }))
    .mutation(async () => {
      // Notification service not configured in standalone MERN build
      return { success: false };
    }),
});
