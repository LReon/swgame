"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const crypto_1 = require("crypto");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = __importDefault(require("./config"));
const prisma = new client_1.PrismaClient();
const app = (0, express_1.default)();
app.use(express_1.default.json());
// -----------------------------
// VerifyToken()
// -----------------------------
async function VerifyToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    if (authHeader !== undefined) {
        if (authHeader.split(" ")[0] === "Bearer") {
            try {
                const token = jsonwebtoken_1.default.verify(authHeader.split(" ")[1], config_1.default.jwt_secret || "");
                const result = await prisma.user.findFirst({
                    where: { name: token.name }
                });
                if (result != null && token.exp && Date.now() < token.exp * 1000) {
                    next();
                }
                else {
                    res.json({ error: "auth error" });
                }
            }
            catch (e) {
                res.json({ error: e.message });
            }
        }
        else {
            res.json({ error: "header format error" });
        }
    }
    else {
        res.json({ error: "header error" });
    }
}
// -----------------------------
// ユーザー登録
// -----------------------------
app.post("/users/register", async (req, res) => {
    const name = req.body.name;
    const exists = await prisma.user.findFirst({
        where: { name: name }
    });
    if (exists != null) {
        res.json({ register_status: "user exists" });
        return;
    }
    const salt = Math.random().toString(36).slice(-8);
    const password = (0, crypto_1.createHash)("sha256")
        .update(req.body.password + salt + config_1.default.pepper, "utf8")
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
app.post("/users/login", async (req, res) => {
    const name = req.body.name;
    const saltres = await prisma.user.findFirst({
        where: { name: name }
    });
    if (saltres != null) {
        const salt = saltres.salt;
        const password = (0, crypto_1.createHash)("sha256")
            .update(req.body.password + salt + config_1.default.pepper, "utf8")
            .digest("hex");
        const result = await prisma.user.findFirst({
            where: { name: name, password: password }
        });
        if (result != null) {
            const token = jsonwebtoken_1.default.sign({ name: name }, config_1.default.jwt_secret || "", { expiresIn: "1h" });
            res.json({ login_status: "success", token: token });
        }
        else {
            res.json({ login_status: "failed" });
        }
    }
    else {
        res.json({ login_status: "No User found." });
    }
});
// -----------------------------
// スコア登録（POST）★追加した部分
// -----------------------------
app.post("/scores", VerifyToken, async (req, res) => {
    const { score } = req.body;
    const authHeader = req.headers["authorization"];
    const token = jsonwebtoken_1.default.verify(authHeader.split(" ")[1], config_1.default.jwt_secret || "");
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
    }
    else {
        res.json({ status_code: 500 });
    }
});
// -----------------------------
// スコア一覧（GET）
// -----------------------------
app.get("/scores", VerifyToken, async (req, res) => {
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
exports.default = app;
