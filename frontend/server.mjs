import { createServer } from "https";
import { parse } from "url";
import { readFileSync } from "fs";
import next from "next";

const dev = true;
const hostname = "local.exams.kptmangaluru.in";
const port = 443;

const app = next({
  dev,
  hostname,
  port,
});

const handle = app.getRequestHandler();

const httpsOptions = {
  key: readFileSync("./cert/local.exams.kptmangaluru.in-key.pem"),
  cert: readFileSync("./cert/local.exams.kptmangaluru.in.pem"),
};

app.prepare().then(() => {
  createServer(httpsOptions, async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (error) {
      console.error("Error occurred handling", req.url, error);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  }).listen(port, hostname, () => {
    console.log(`> Ready on https://${hostname}`);
  });
});