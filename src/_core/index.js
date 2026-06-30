import "dotenv/config";
import { ENV } from "./env.js";
import express from "express";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStorageProxy } from "./storageProxy.js";
import { appRouter } from "../routers.js";
import { createContext } from "./context.js";
import { connectDB } from "../db.js";
import { uploadRouter } from "../routers/upload.js";

function isPortAvailable(port) {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => { server.close(() => resolve(true)); });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort = 3000) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Connect to MongoDB first
  await connectDB();

  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use(cookieParser());
  // Uploads directory
  const _dirname = path.dirname(fileURLToPath(import.meta.url));
  app.use("/uploads", express.static(path.resolve(_dirname, "../../public/uploads")));

  // API Routes
  app.use("/api/upload", uploadRouter);

  // tRPC API
  app.use("/api/trpc", createExpressMiddleware({
    router: appRouter,
    createContext,
  }));

  // Serve static files from public directory (if needed for production)
  app.use(express.static(path.resolve(_dirname, "../../public")));

  const preferredPort = parseInt(process.env.PORT || "5000"); // Change to 5000 default to avoid conflict with client
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`🚀 AMAR JEANS Server running on http://localhost:${port}/`);
    console.log(`📦 MongoDB: ${ENV.mongodbUrl}`);
  });
}

startServer().catch(console.error);
