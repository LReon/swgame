import express from "express";
import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";
import jwt from "jsonwebtoken";
import config from "./config";

const prisma = new PrismaClient();
const app: express.Express = express();

app.use(express.json());

// -----------------------------
// VerifyToken()
// -----------------------------
async function VerifyToken(req: express.Request, res: express.Response, next: any) {
  const authHeader = req.headers["authorization"];

  if (authHeader !== undefined) {
    if (authHeader.split(" ")[0] === "Bearer") {
      try {
        const token = jwt.verify(
          authHeader.split(" ")[1],
          config.jwt_secret || ""
        ) as jwt.JwtPayload;

        const result = await prisma.user.findFirst({
          where: { name: token.name }
        });

        if (result != null && token.exp && Date.now() < token.exp * 1000) {
          next();
        } else {
          res.json({ error: "auth error" });
        }
      } catch (e: any) {
        res.json({ error: e.message });
      }
    } else {
      res.json({ error: "header format error" });
    }
  } else {
    res.json({ error: "header error" });
  }
}

// -----------------------------
// ユーザー登録
// -----------------------------
app.post("/users/register", async (req: express.Request, res: express.Response): Promise<void> => {
  const name = req.body.name;

  const exists = await prisma.user.findFirst({
    where: { name: name }
  });

  if (exists != null) {
    res.json({ register_status: "user exists" });
    return;
  }

  const salt = Math.random().toString(36).slice(-8);

  const password = createHash("sha256")
    .update(req.body.password + salt + config.pepper, "utf8")
    .digest("hex");

  await prisma.user.create({
    data: {
      name: name,
      password: password,
      salt: salt
    }
  });

  res.json({ register_status: "success" });
});

// -----------------------------
// ログイン
// -----------------------------
app.post("/users/login", async (req: express.Request, res: express.Response): Promise<void> => {
  const name = req.body.name;

  const saltres: any = await prisma.user.findFirst({
    where: { name: name }
  });

  if (saltres != null) {
    const salt: any = saltres.salt;

    const password = createHash("sha256")
      .update(req.body.password + salt + config.pepper, "utf8")
      .digest("hex");

    const result: any = await prisma.user.findFirst({
      where: { name: name, password: password }
    });

    if (result != null) {
      const token = jwt.sign(
        { name: name },
        config.jwt_secret || "",
        { expiresIn: "1h" }
      );

      res.json({ login_status: "success", token: token });
    } else {
      res.json({ login_status: "failed" });
    }
  } else {
    res.json({ login_status: "No User found." });
  }
});

// -----------------------------
// スコア登録（POST）★追加した部分
// -----------------------------
app.post("/scores", VerifyToken, async (req: express.Request, res: express.Response): Promise<void> => {
  const { score } = req.body;

  const authHeader = req.headers["authorization"];
  const token = jwt.verify(authHeader!.split(" ")[1], config.jwt_secret || "") as jwt.JwtPayload;

  const user = await prisma.user.findFirst({
    where: { name: token.name }
  });

  if (!user) {
    res.json({ status_code: 401, message: "User not found" });
    return;
  }

  const result = await prisma.score.create({
    data: {
      userId: user.id,
      score: score
    }
  });

  if (result != null) {
    res.json({ status_code: 200 });
  } else {
    res.json({ status_code: 500 });
  }
});

// -----------------------------
// スコア一覧（GET）
// -----------------------------
app.get("/scores", VerifyToken, async (req: express.Request, res: express.Response): Promise<void> => {
  const scores = await prisma.score.findMany({
    orderBy: [{ score: "desc" }],
    include: { user: true },
    take: 5
  });

  res.json(scores);
});

app.get("/", (req, res) => {
  res.json({ status: "ok" });
});

if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
