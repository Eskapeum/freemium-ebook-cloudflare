var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-V9nyQY/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// .wrangler/tmp/bundle-V9nyQY/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// ../shared/utils.ts
function generateUUID() {
  return crypto.randomUUID();
}
__name(generateUUID, "generateUUID");
function log(level, message, context, requestId) {
  const entry = {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    level,
    message,
    context,
    requestId
  };
  console.log(JSON.stringify(entry));
}
__name(log, "log");
function createErrorResponse(error, status = 500, code, details) {
  const errorResponse = {
    error,
    code,
    details
  };
  return Response.json(errorResponse, { status });
}
__name(createErrorResponse, "createErrorResponse");
function createSuccessResponse(data, status = 200) {
  return Response.json(data, { status });
}
__name(createSuccessResponse, "createSuccessResponse");
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};
function addCorsHeaders(response) {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}
__name(addCorsHeaders, "addCorsHeaders");
function handleOptions() {
  return new Response(null, { headers: CORS_HEADERS });
}
__name(handleOptions, "handleOptions");
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
__name(isValidEmail, "isValidEmail");
function generateDiscountCode() {
  return `CREATOR10-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;
}
__name(generateDiscountCode, "generateDiscountCode");
async function withRetry(operation, maxRetries = 3, delay = 100) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1)
        throw error;
      await new Promise((resolve) => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
  throw new Error("Max retries exceeded");
}
__name(withRetry, "withRetry");
function getRequestId(request) {
  return request.headers.get("cf-ray") || generateUUID();
}
__name(getRequestId, "getRequestId");
function getClientIP(request) {
  return request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "unknown";
}
__name(getClientIP, "getClientIP");
function getUserAgent(request) {
  return request.headers.get("User-Agent") || "unknown";
}
__name(getUserAgent, "getUserAgent");
async function parseJSON(request) {
  try {
    return await request.json();
  } catch (error) {
    throw new Error("Invalid JSON in request body");
  }
}
__name(parseJSON, "parseJSON");
async function trackEvent(event, properties, env, email) {
  try {
    const analyticsData = {
      event,
      properties,
      timestamp: Date.now(),
      email,
      ...properties
    };
    await env.ANALYTICS_KV.put(
      `event:${Date.now()}:${generateUUID()}`,
      JSON.stringify(analyticsData),
      { expirationTtl: 86400 }
      // 24 hours
    );
  } catch (error) {
    log("error", "Failed to track analytics event", { error: error.message, event });
  }
}
__name(trackEvent, "trackEvent");
async function checkRateLimit(key, limit, window, env) {
  const now = Date.now();
  const windowStart = now - window * 1e3;
  const current = await env.CACHE_KV.get(`rate_limit:${key}`, "json");
  if (!current || current.timestamp < windowStart) {
    await env.CACHE_KV.put(
      `rate_limit:${key}`,
      JSON.stringify({ count: 1, timestamp: now }),
      { expirationTtl: window }
    );
    return true;
  }
  if (current.count >= limit) {
    return false;
  }
  await env.CACHE_KV.put(
    `rate_limit:${key}`,
    JSON.stringify({ count: current.count + 1, timestamp: current.timestamp }),
    { expirationTtl: window }
  );
  return true;
}
__name(checkRateLimit, "checkRateLimit");

// ../shared/db-helpers.ts
var EmailSubscriberDB = class {
  constructor(env) {
    this.env = env;
  }
  async findByEmail(email) {
    return withRetry(async () => {
      const result = await this.env.DB.prepare(
        "SELECT * FROM email_subscribers WHERE email = ?"
      ).bind(email).first();
      return result;
    });
  }
  async create(data) {
    return withRetry(async () => {
      const id = generateUUID();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      await this.env.DB.prepare(`
        INSERT INTO email_subscribers 
        (id, email, first_name, last_name, discount_code, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        data.email,
        data.firstName || null,
        data.lastName || null,
        data.discountCode || null,
        now,
        now
      ).run();
      return this.findByEmail(data.email);
    });
  }
  async updateEmailsSent(email) {
    return withRetry(async () => {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      await this.env.DB.prepare(`
        UPDATE email_subscribers 
        SET emails_sent = emails_sent + 1, 
            last_email_sent = ?,
            updated_at = ?
        WHERE email = ?
      `).bind(now, now, email).run();
    });
  }
  async updateAccess(email, hasAccess, hasPurchased) {
    return withRetry(async () => {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      if (hasPurchased !== void 0) {
        await this.env.DB.prepare(`
          UPDATE email_subscribers 
          SET has_access = ?, has_purchased = ?, updated_at = ?
          WHERE email = ?
        `).bind(hasAccess ? 1 : 0, hasPurchased ? 1 : 0, now, email).run();
      } else {
        await this.env.DB.prepare(`
          UPDATE email_subscribers 
          SET has_access = ?, updated_at = ?
          WHERE email = ?
        `).bind(hasAccess ? 1 : 0, now, email).run();
      }
    });
  }
};
__name(EmailSubscriberDB, "EmailSubscriberDB");
var ReadingProgressDB = class {
  constructor(env) {
    this.env = env;
  }
  async findByEmail(email) {
    return withRetry(async () => {
      const result = await this.env.DB.prepare(
        "SELECT * FROM reading_progress WHERE email = ? ORDER BY chapter_number"
      ).bind(email).all();
      return result.results;
    });
  }
  async findByEmailAndChapter(email, chapterNumber) {
    return withRetry(async () => {
      const result = await this.env.DB.prepare(
        "SELECT * FROM reading_progress WHERE email = ? AND chapter_number = ?"
      ).bind(email, chapterNumber).first();
      return result;
    });
  }
  async upsert(data) {
    return withRetry(async () => {
      const id = generateUUID();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const videosWatchedJson = JSON.stringify(data.videosWatched || []);
      const quizzesPassedJson = JSON.stringify(data.quizzesPassed || []);
      await this.env.DB.prepare(`
        INSERT INTO reading_progress 
        (id, email, chapter_number, completed, time_spent, videos_watched, quizzes_passed, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(email, chapter_number) DO UPDATE SET
          completed = excluded.completed,
          time_spent = excluded.time_spent,
          videos_watched = excluded.videos_watched,
          quizzes_passed = excluded.quizzes_passed,
          updated_at = excluded.updated_at
      `).bind(
        id,
        data.email,
        data.chapterNumber,
        data.completed ? 1 : 0,
        data.timeSpent || 0,
        videosWatchedJson,
        quizzesPassedJson,
        now,
        now
      ).run();
      return this.findByEmailAndChapter(data.email, data.chapterNumber);
    });
  }
  async getCompletionStats(email) {
    return withRetry(async () => {
      const result = await this.env.DB.prepare(`
        SELECT 
          COUNT(*) as total_chapters,
          SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed_chapters,
          SUM(time_spent) as total_time_spent
        FROM reading_progress 
        WHERE email = ?
      `).bind(email).first();
      return {
        totalChapters: result?.total_chapters || 0,
        completedChapters: result?.completed_chapters || 0,
        totalTimeSpent: result?.total_time_spent || 0
      };
    });
  }
};
__name(ReadingProgressDB, "ReadingProgressDB");
var UserSessionDB = class {
  constructor(env) {
    this.env = env;
  }
  async create(userEmail, sessionToken, expiresAt) {
    return withRetry(async () => {
      const id = generateUUID();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      await this.env.DB.prepare(`
        INSERT INTO user_sessions 
        (id, user_email, session_token, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        id,
        userEmail,
        sessionToken,
        expiresAt.toISOString(),
        now
      ).run();
      return {
        id,
        user_email: userEmail,
        session_token: sessionToken,
        expires_at: expiresAt.toISOString(),
        created_at: now
      };
    });
  }
  async findByToken(sessionToken) {
    return withRetry(async () => {
      const result = await this.env.DB.prepare(
        "SELECT * FROM user_sessions WHERE session_token = ? AND expires_at > ?"
      ).bind(sessionToken, (/* @__PURE__ */ new Date()).toISOString()).first();
      return result;
    });
  }
  async deleteByToken(sessionToken) {
    return withRetry(async () => {
      await this.env.DB.prepare(
        "DELETE FROM user_sessions WHERE session_token = ?"
      ).bind(sessionToken).run();
    });
  }
  async deleteExpired() {
    return withRetry(async () => {
      await this.env.DB.prepare(
        "DELETE FROM user_sessions WHERE expires_at <= ?"
      ).bind((/* @__PURE__ */ new Date()).toISOString()).run();
    });
  }
};
__name(UserSessionDB, "UserSessionDB");
var ContentAccessLogDB = class {
  constructor(env) {
    this.env = env;
  }
  async log(data) {
    return withRetry(async () => {
      const id = generateUUID();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      await this.env.DB.prepare(`
        INSERT INTO content_access_logs 
        (id, email, chapter_number, access_type, ip_address, user_agent, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        data.email,
        data.chapterNumber || null,
        data.accessType,
        data.ipAddress || null,
        data.userAgent || null,
        now
      ).run();
    });
  }
  async getAccessStats(email) {
    return withRetry(async () => {
      const result = await this.env.DB.prepare(`
        SELECT 
          SUM(CASE WHEN access_type = 'view' THEN 1 ELSE 0 END) as total_views,
          SUM(CASE WHEN access_type = 'download' THEN 1 ELSE 0 END) as total_downloads,
          SUM(CASE WHEN access_type = 'share' THEN 1 ELSE 0 END) as total_shares,
          MAX(created_at) as last_access
        FROM content_access_logs 
        WHERE email = ?
      `).bind(email).first();
      return {
        totalViews: result?.total_views || 0,
        totalDownloads: result?.total_downloads || 0,
        totalShares: result?.total_shares || 0,
        lastAccess: result?.last_access || null
      };
    });
  }
};
__name(ContentAccessLogDB, "ContentAccessLogDB");

// ../email-worker/src/handlers/signup.ts
async function handleEmailSignup(request, env) {
  const requestId = getRequestId(request);
  try {
    const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";
    const rateLimitKey = `signup:${clientIP}`;
    const isAllowed = await checkRateLimit(rateLimitKey, 3, 60, env);
    if (!isAllowed) {
      log("warn", "Rate limit exceeded for signup", { clientIP }, requestId);
      return createErrorResponse("Too many signup attempts. Please try again later.", 429);
    }
    const data = await parseJSON(request);
    if (!data.email || !isValidEmail(data.email)) {
      log("warn", "Invalid email in signup request", { email: data.email }, requestId);
      return createErrorResponse("Valid email is required", 400);
    }
    const email = data.email.toLowerCase().trim();
    const firstName = data.firstName?.trim();
    const lastName = data.lastName?.trim();
    const emailDB = new EmailSubscriberDB(env);
    const existingUser = await emailDB.findByEmail(email);
    if (existingUser) {
      log("info", "User already exists, returning existing data", { email }, requestId);
      const response2 = {
        success: true,
        message: "Welcome back! You already have access.",
        user: {
          email: existingUser.email,
          first_name: existingUser.first_name,
          has_access: existingUser.has_access,
          has_purchased: existingUser.has_purchased
        },
        hasAccess: existingUser.has_access,
        discountCode: existingUser.discount_code
      };
      return createSuccessResponse(response2);
    }
    const discountCode = generateDiscountCode();
    const newUser = await emailDB.create({
      email,
      firstName,
      lastName,
      discountCode
    });
    try {
      await env.EMAIL_QUEUE.send({
        type: "welcome",
        email,
        firstName,
        discountCode
      });
      log("info", "Welcome email queued", { email }, requestId);
    } catch (queueError) {
      log("error", "Failed to queue welcome email", {
        email,
        error: queueError.message
      }, requestId);
    }
    await trackEvent("user_signup", {
      email,
      firstName,
      hasDiscount: !!discountCode,
      source: "web"
    }, env, email);
    const response = {
      success: true,
      message: "Welcome! You now have access to the first 7 chapters.",
      user: {
        email: newUser.email,
        first_name: newUser.first_name,
        has_access: newUser.has_access,
        has_purchased: newUser.has_purchased
      },
      hasAccess: true,
      discountCode
    };
    log("info", "User signup successful", { email }, requestId);
    return createSuccessResponse(response);
  } catch (error) {
    log("error", "Email signup error", {
      error: error.message,
      stack: error.stack
    }, requestId);
    return createErrorResponse("Signup failed. Please try again.", 500);
  }
}
__name(handleEmailSignup, "handleEmailSignup");

// ../auth-worker/src/jwt.ts
async function generateJWT(payload, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, "");
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, "");
  const data = encoder.encode(`${encodedHeader}.${encodedPayload}`);
  const signature = await crypto.subtle.sign("HMAC", key, data);
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}
__name(generateJWT, "generateJWT");
async function verifyJWT(token, secret) {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) {
    throw new Error("Invalid token format");
  }
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const data = encoder.encode(`${header}.${payload}`);
  const signatureBuffer = Uint8Array.from(
    atob(signature.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0)
  );
  const isValid = await crypto.subtle.verify("HMAC", key, signatureBuffer, data);
  if (!isValid) {
    throw new Error("Invalid token signature");
  }
  const decodedPayload = JSON.parse(atob(payload));
  if (decodedPayload.exp && decodedPayload.exp < Math.floor(Date.now() / 1e3)) {
    throw new Error("Token expired");
  }
  return decodedPayload;
}
__name(verifyJWT, "verifyJWT");
function createJWTPayload(email, type = "session", expirationMinutes = 60 * 24 * 7, additionalData) {
  const now = Math.floor(Date.now() / 1e3);
  return {
    email,
    type,
    exp: now + expirationMinutes * 60,
    iat: now,
    ...additionalData
  };
}
__name(createJWTPayload, "createJWTPayload");

// ../auth-worker/src/handlers/login.ts
async function handleMagicLinkLogin(request, env) {
  const requestId = getRequestId(request);
  try {
    const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";
    const rateLimitKey = `magic_link:${clientIP}`;
    const isAllowed = await checkRateLimit(rateLimitKey, 5, 60, env);
    if (!isAllowed) {
      log("warn", "Rate limit exceeded for magic link", { clientIP }, requestId);
      return createErrorResponse("Too many requests. Please try again later.", 429);
    }
    const data = await parseJSON(request);
    if (!data.email || !isValidEmail(data.email)) {
      log("warn", "Invalid email in magic link request", { email: data.email }, requestId);
      return createErrorResponse("Valid email is required", 400);
    }
    const email = data.email.toLowerCase().trim();
    const emailDB = new EmailSubscriberDB(env);
    const user = await emailDB.findByEmail(email);
    if (!user) {
      log("warn", "Magic link requested for non-existent user", { email }, requestId);
      return createErrorResponse("User not found. Please sign up first.", 404);
    }
    const payload = createJWTPayload(email, "magic_link", 15);
    const token = await generateJWT(payload, env.JWT_SECRET);
    try {
      await env.EMAIL_QUEUE.send({
        type: "magic_link",
        email,
        firstName: user.first_name,
        token,
        loginUrl: `${env.FRONTEND_URL}/auth/verify?token=${token}`
      });
      log("info", "Magic link email queued", { email }, requestId);
    } catch (queueError) {
      log("error", "Failed to queue magic link email", {
        email,
        error: queueError.message
      }, requestId);
      return createErrorResponse("Failed to send magic link. Please try again.", 500);
    }
    const response = {
      success: true,
      message: "Magic link sent to your email"
    };
    log("info", "Magic link sent successfully", { email }, requestId);
    return createSuccessResponse(response);
  } catch (error) {
    log("error", "Magic link login error", {
      error: error.message,
      stack: error.stack
    }, requestId);
    return createErrorResponse("Login failed. Please try again.", 500);
  }
}
__name(handleMagicLinkLogin, "handleMagicLinkLogin");

// ../auth-worker/src/handlers/verify.ts
async function handleVerifyToken(request, env) {
  const requestId = getRequestId(request);
  try {
    const data = await parseJSON(request);
    if (!data.token) {
      log("warn", "Missing token in verify request", {}, requestId);
      return createErrorResponse("Token is required", 400);
    }
    let payload;
    try {
      payload = await verifyJWT(data.token, env.JWT_SECRET);
    } catch (jwtError) {
      log("warn", "Invalid or expired token", { error: jwtError.message }, requestId);
      return createErrorResponse("Invalid or expired token", 401);
    }
    if (payload.type !== "magic_link") {
      log("warn", "Invalid token type for verification", { type: payload.type }, requestId);
      return createErrorResponse("Invalid token type", 401);
    }
    const emailDB = new EmailSubscriberDB(env);
    const user = await emailDB.findByEmail(payload.email);
    if (!user) {
      log("warn", "User not found during token verification", { email: payload.email }, requestId);
      return createErrorResponse("User not found", 404);
    }
    const sessionPayload = createJWTPayload(
      user.email,
      "session",
      60 * 24 * 7,
      // 7 days
      {
        userId: user.id,
        hasAccess: user.has_access,
        hasPurchased: user.has_purchased
      }
    );
    const sessionToken = await generateJWT(sessionPayload, env.JWT_SECRET);
    const sessionDB = new UserSessionDB(env);
    const expiresAt = new Date(sessionPayload.exp * 1e3);
    try {
      await sessionDB.create(user.email, sessionToken, expiresAt);
      log("info", "Session created successfully", { email: user.email }, requestId);
    } catch (sessionError) {
      log("error", "Failed to create session", {
        email: user.email,
        error: sessionError.message
      }, requestId);
    }
    try {
      const sessionData = {
        userId: user.id,
        email: user.email,
        hasAccess: user.has_access,
        hasPurchased: user.has_purchased,
        createdAt: Date.now()
      };
      await env.SESSIONS_KV.put(
        `session:${sessionToken}`,
        JSON.stringify(sessionData),
        { expirationTtl: 7 * 24 * 60 * 60 }
        // 7 days
      );
    } catch (kvError) {
      log("warn", "Failed to cache session in KV", {
        email: user.email,
        error: kvError.message
      }, requestId);
    }
    const response = {
      success: true,
      token: sessionToken,
      user: {
        email: user.email,
        firstName: user.first_name,
        hasAccess: user.has_access,
        hasPurchased: user.has_purchased
      }
    };
    log("info", "Token verified and session created", { email: user.email }, requestId);
    return createSuccessResponse(response);
  } catch (error) {
    log("error", "Token verification error", {
      error: error.message,
      stack: error.stack
    }, requestId);
    return createErrorResponse("Verification failed. Please try again.", 500);
  }
}
__name(handleVerifyToken, "handleVerifyToken");

// ../progress-worker/src/handlers/update.ts
async function handleProgressUpdate(request, env) {
  const requestId = getRequestId(request);
  try {
    const data = await parseJSON(request);
    if (!data.email || !isValidEmail(data.email)) {
      log("warn", "Invalid email in progress update", { email: data.email }, requestId);
      return createErrorResponse("Valid email is required", 400);
    }
    if (!data.chapterNumber || data.chapterNumber < 1) {
      log("warn", "Invalid chapter number", { chapterNumber: data.chapterNumber }, requestId);
      return createErrorResponse("Valid chapter number is required", 400);
    }
    const email = data.email.toLowerCase().trim();
    const progressDB = new ReadingProgressDB(env);
    const updatedProgress = await progressDB.upsert({
      email,
      chapterNumber: data.chapterNumber,
      completed: data.completed,
      timeSpent: data.timeSpent,
      videosWatched: data.videosWatched,
      quizzesPassed: data.quizzesPassed
    });
    const accessLogDB = new ContentAccessLogDB(env);
    await accessLogDB.log({
      email,
      chapterNumber: data.chapterNumber,
      accessType: "view",
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request)
    });
    if (data.completed) {
      await trackEvent("chapter_completed", {
        email,
        chapterNumber: data.chapterNumber,
        timeSpent: data.timeSpent
      }, env, email);
    }
    if (data.videosWatched && data.videosWatched.length > 0) {
      await trackEvent("videos_watched", {
        email,
        chapterNumber: data.chapterNumber,
        videoCount: data.videosWatched.length,
        videos: data.videosWatched
      }, env, email);
    }
    if (data.quizzesPassed && data.quizzesPassed.length > 0) {
      await trackEvent("quizzes_completed", {
        email,
        chapterNumber: data.chapterNumber,
        quizCount: data.quizzesPassed.length,
        quizzes: data.quizzesPassed
      }, env, email);
    }
    try {
      const cacheKey = `progress:${email}`;
      const allProgress = await progressDB.findByEmail(email);
      await env.CACHE_KV.put(
        cacheKey,
        JSON.stringify(allProgress),
        { expirationTtl: 300 }
        // 5 minutes
      );
    } catch (cacheError) {
      log("warn", "Failed to cache progress", {
        email,
        error: cacheError.message
      }, requestId);
    }
    const response = {
      success: true,
      progress: [updatedProgress]
    };
    log("info", "Progress updated successfully", {
      email,
      chapterNumber: data.chapterNumber,
      completed: data.completed
    }, requestId);
    return createSuccessResponse(response);
  } catch (error) {
    log("error", "Progress update error", {
      error: error.message,
      stack: error.stack
    }, requestId);
    return createErrorResponse("Failed to update progress. Please try again.", 500);
  }
}
__name(handleProgressUpdate, "handleProgressUpdate");

// ../progress-worker/src/handlers/get.ts
async function handleGetProgress(request, env) {
  const requestId = getRequestId(request);
  try {
    const url = new URL(request.url);
    const email = url.searchParams.get("email");
    if (!email || !isValidEmail(email)) {
      log("warn", "Invalid email in progress get request", { email }, requestId);
      return createErrorResponse("Valid email is required", 400);
    }
    const normalizedEmail = email.toLowerCase().trim();
    let progress;
    try {
      const cacheKey = `progress:${normalizedEmail}`;
      const cached = await env.CACHE_KV.get(cacheKey, "json");
      if (cached) {
        log("info", "Progress retrieved from cache", { email: normalizedEmail }, requestId);
        const response2 = {
          success: true,
          progress: cached
        };
        return createSuccessResponse(response2);
      }
    } catch (cacheError) {
      log("warn", "Failed to get progress from cache", {
        email: normalizedEmail,
        error: cacheError.message
      }, requestId);
    }
    const progressDB = new ReadingProgressDB(env);
    progress = await progressDB.findByEmail(normalizedEmail);
    try {
      const cacheKey = `progress:${normalizedEmail}`;
      await env.CACHE_KV.put(
        cacheKey,
        JSON.stringify(progress),
        { expirationTtl: 300 }
        // 5 minutes
      );
    } catch (cacheError) {
      log("warn", "Failed to cache progress", {
        email: normalizedEmail,
        error: cacheError.message
      }, requestId);
    }
    const response = {
      success: true,
      progress
    };
    log("info", "Progress retrieved successfully", {
      email: normalizedEmail,
      progressCount: progress.length
    }, requestId);
    return createSuccessResponse(response);
  } catch (error) {
    log("error", "Progress get error", {
      error: error.message,
      stack: error.stack
    }, requestId);
    return createErrorResponse("Failed to retrieve progress. Please try again.", 500);
  }
}
__name(handleGetProgress, "handleGetProgress");

// ../progress-worker/src/handlers/analytics.ts
async function handleProgressAnalytics(request, env) {
  const requestId = getRequestId(request);
  try {
    const url = new URL(request.url);
    const email = url.searchParams.get("email");
    if (!email || !isValidEmail(email)) {
      log("warn", "Invalid email in analytics request", { email }, requestId);
      return createErrorResponse("Valid email is required", 400);
    }
    const normalizedEmail = email.toLowerCase().trim();
    const progressDB = new ReadingProgressDB(env);
    const completionStats = await progressDB.getCompletionStats(normalizedEmail);
    const accessLogDB = new ContentAccessLogDB(env);
    const accessStats = await accessLogDB.getAccessStats(normalizedEmail);
    const completionRate = completionStats.totalChapters > 0 ? completionStats.completedChapters / completionStats.totalChapters * 100 : 0;
    const averageTimePerChapter = completionStats.completedChapters > 0 ? completionStats.totalTimeSpent / completionStats.completedChapters : 0;
    const allProgress = await progressDB.findByEmail(normalizedEmail);
    const currentStreak = calculateReadingStreak(allProgress);
    const analytics = {
      completion: {
        totalChapters: completionStats.totalChapters,
        completedChapters: completionStats.completedChapters,
        completionRate: Math.round(completionRate * 100) / 100,
        totalTimeSpent: completionStats.totalTimeSpent,
        averageTimePerChapter: Math.round(averageTimePerChapter)
      },
      engagement: {
        totalViews: accessStats.totalViews,
        totalDownloads: accessStats.totalDownloads,
        totalShares: accessStats.totalShares,
        lastAccess: accessStats.lastAccess,
        currentStreak
      },
      progress: allProgress.map((p) => ({
        chapterNumber: p.chapter_number,
        completed: p.completed,
        timeSpent: p.time_spent,
        videosWatched: JSON.parse(p.videos_watched || "[]").length,
        quizzesPassed: JSON.parse(p.quizzes_passed || "[]").length,
        lastUpdated: p.updated_at
      }))
    };
    log("info", "Analytics retrieved successfully", {
      email: normalizedEmail,
      completionRate,
      totalChapters: completionStats.totalChapters
    }, requestId);
    return createSuccessResponse(analytics);
  } catch (error) {
    log("error", "Analytics error", {
      error: error.message,
      stack: error.stack
    }, requestId);
    return createErrorResponse("Failed to retrieve analytics. Please try again.", 500);
  }
}
__name(handleProgressAnalytics, "handleProgressAnalytics");
function calculateReadingStreak(progress) {
  if (progress.length === 0)
    return 0;
  const sortedProgress = progress.filter((p) => p.completed).sort((a, b) => a.chapter_number - b.chapter_number);
  if (sortedProgress.length === 0)
    return 0;
  let maxStreak = 1;
  let currentStreak = 1;
  for (let i = 1; i < sortedProgress.length; i++) {
    if (sortedProgress[i].chapter_number === sortedProgress[i - 1].chapter_number + 1) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }
  return maxStreak;
}
__name(calculateReadingStreak, "calculateReadingStreak");

// src/index.ts
var src_default = {
  async fetch(request, env, ctx) {
    const requestId = getRequestId(request);
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    log("info", "Test worker request", {
      method,
      path,
      userAgent: request.headers.get("User-Agent"),
      ip: request.headers.get("CF-Connecting-IP")
    }, requestId);
    if (method === "OPTIONS") {
      return handleOptions();
    }
    try {
      let response;
      switch (true) {
        case (path === "/email/signup" && method === "POST"):
          response = await handleEmailSignup(request, env);
          break;
        case (path === "/auth/magic-link" && method === "POST"):
          response = await handleMagicLinkLogin(request, env);
          break;
        case (path === "/auth/verify" && method === "POST"):
          response = await handleVerifyToken(request, env);
          break;
        case (path === "/progress" && method === "POST"):
          response = await handleProgressUpdate(request, env);
          break;
        case (path === "/progress" && method === "GET"):
          response = await handleGetProgress(request, env);
          break;
        case (path === "/progress/analytics" && method === "GET"):
          response = await handleProgressAnalytics(request, env);
          break;
        case (path === "/health" && method === "GET"):
          response = await handleHealthCheck(env);
          break;
        case (path === "/test/full-journey" && method === "POST"):
          response = await handleFullJourneyTest(request, env);
          break;
        case (path === "/test/database" && method === "GET"):
          response = await handleDatabaseTest(env);
          break;
        default:
          log("warn", "Test worker route not found", { method, path }, requestId);
          response = new Response(JSON.stringify({
            error: "Not Found",
            message: "The requested endpoint does not exist",
            availableEndpoints: [
              "POST /email/signup",
              "POST /auth/magic-link",
              "POST /auth/verify",
              "POST /progress",
              "GET /progress",
              "GET /progress/analytics",
              "GET /health",
              "POST /test/full-journey",
              "GET /test/database"
            ]
          }), {
            status: 404,
            headers: { "Content-Type": "application/json" }
          });
      }
      response = addCorsHeaders(response);
      log("info", "Test worker response", {
        status: response.status,
        method,
        path
      }, requestId);
      return response;
    } catch (error) {
      log("error", "Test worker error", {
        error: error.message,
        stack: error.stack,
        method,
        path
      }, requestId);
      const errorResponse = new Response(
        JSON.stringify({
          error: "Internal server error",
          requestId
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
      return addCorsHeaders(errorResponse);
    }
  }
};
async function handleHealthCheck(env) {
  const healthChecks = {
    worker: { status: "healthy" },
    database: { status: "unknown" },
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
  try {
    await env.DB.prepare("SELECT 1").first();
    healthChecks.database.status = "healthy";
  } catch (error) {
    healthChecks.database.status = "error";
  }
  const overallStatus = Object.values(healthChecks).every(
    (check) => typeof check === "object" && check.status === "healthy"
  ) ? "healthy" : "degraded";
  return new Response(JSON.stringify({
    status: overallStatus,
    checks: healthChecks,
    version: "1.0.0"
  }), {
    status: overallStatus === "healthy" ? 200 : 503,
    headers: { "Content-Type": "application/json" }
  });
}
__name(handleHealthCheck, "handleHealthCheck");
async function handleDatabaseTest(env) {
  try {
    const tables = await env.DB.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all();
    const testResults = {
      tablesFound: tables.results.map((t) => t.name),
      expectedTables: ["email_subscribers", "reading_progress", "user_sessions", "content_access_logs"],
      schemaValid: false,
      sampleData: {}
    };
    testResults.schemaValid = testResults.expectedTables.every(
      (table) => testResults.tablesFound.includes(table)
    );
    if (testResults.schemaValid) {
      for (const table of testResults.expectedTables) {
        try {
          const count = await env.DB.prepare(`SELECT COUNT(*) as count FROM ${table}`).first();
          testResults.sampleData[table] = count.count;
        } catch (error) {
          testResults.sampleData[table] = `Error: ${error.message}`;
        }
      }
    }
    return new Response(JSON.stringify({
      success: true,
      database: testResults
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleDatabaseTest, "handleDatabaseTest");
async function handleFullJourneyTest(request, env) {
  try {
    const testEmail = `test-${Date.now()}@example.com`;
    const results = [];
    const signupRequest = new Request(request.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        firstName: "Test",
        lastName: "User"
      })
    });
    const signupResponse = await handleEmailSignup(signupRequest, env);
    const signupData = await signupResponse.json();
    results.push({
      step: "email_signup",
      success: signupResponse.status === 200,
      data: signupData
    });
    if (signupResponse.status !== 200) {
      return new Response(JSON.stringify({
        success: false,
        message: "Email signup failed",
        results
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    const progressRequest = new Request(request.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        chapterNumber: 1,
        completed: true,
        timeSpent: 300,
        videosWatched: ["video1"],
        quizzesPassed: ["quiz1"]
      })
    });
    const progressResponse = await handleProgressUpdate(progressRequest, env);
    const progressData = await progressResponse.json();
    results.push({
      step: "progress_update",
      success: progressResponse.status === 200,
      data: progressData
    });
    const getProgressUrl = new URL(request.url);
    getProgressUrl.searchParams.set("email", testEmail);
    const getProgressRequest = new Request(getProgressUrl.toString(), {
      method: "GET"
    });
    const getProgressResponse = await handleGetProgress(getProgressRequest, env);
    const getProgressData = await getProgressResponse.json();
    results.push({
      step: "get_progress",
      success: getProgressResponse.status === 200,
      data: getProgressData
    });
    const analyticsUrl = new URL(request.url);
    analyticsUrl.pathname = "/progress/analytics";
    analyticsUrl.searchParams.set("email", testEmail);
    const analyticsRequest = new Request(analyticsUrl.toString(), {
      method: "GET"
    });
    const analyticsResponse = await handleProgressAnalytics(analyticsRequest, env);
    const analyticsData = await analyticsResponse.json();
    results.push({
      step: "get_analytics",
      success: analyticsResponse.status === 200,
      data: analyticsData
    });
    const allSuccessful = results.every((result) => result.success);
    return new Response(JSON.stringify({
      success: allSuccessful,
      message: allSuccessful ? "Full journey test completed successfully" : "Some steps failed",
      testEmail,
      results
    }), {
      status: allSuccessful ? 200 : 500,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleFullJourneyTest, "handleFullJourneyTest");

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-V9nyQY/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-V9nyQY/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
