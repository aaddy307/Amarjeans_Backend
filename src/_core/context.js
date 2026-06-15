import { jwtVerify } from "jose";
import { User } from "../models/User.js";
import { ENV } from "./env.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logPath = path.join(__dirname, "../context-log.txt");

function logAuth(msg) {
  try { fs.appendFileSync(logPath, `${new Date().toISOString()} - ${msg}\n`); } catch(e) {}
}

export async function createContext(opts) {
  let user = null;

  let token = opts.req.cookies?.["app_session_id"];
  logAuth(`Request to ${opts.req.originalUrl}. Token found in cookies: ${!!token}`);

  if (!token && opts.req.headers.cookie) {
    const match = opts.req.headers.cookie.match(new RegExp('(^| )' + "app_session_id" + '=([^;]+)'));
    if (match) {
      token = match[2];
      logAuth(`Token found via regex fallback: true`);
    }
  }

  if (token) {
    try {
      const secret = new TextEncoder().encode(ENV.cookieSecret);
      const { payload } = await jwtVerify(token, secret);
      logAuth(`JWT verified. UserId: ${payload.userId}, Role: ${payload.role}`);

      // Special case: admin token uses a fake userId not in DB
      if (payload.role === "admin") {
        user = {
          id: payload.userId,
          name: "Amar Waghmare",
          email: payload.email,
          role: "admin",
        };
        logAuth(`Admin user restored from JWT payload`);
      } else if (payload.userId) {
        const dbUser = await User.findById(payload.userId).lean();
        logAuth(`User found in DB: ${!!dbUser}`);
        if (dbUser) {
          user = {
            id: dbUser._id.toString(),
            name: dbUser.name,
            email: dbUser.email,
            role: dbUser.role,
          };
        }
      }
    } catch (err) {
      logAuth(`JWT Verify Error: ${err.message}`);
    }
  } else {
    logAuth(`No token present. Headers: ${JSON.stringify(opts.req.headers)}`);
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
