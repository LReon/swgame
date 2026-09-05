const app = require("./dist/app").default;
const serverless = require("serverless-http");

module.exports = serverless(app);

