const {
  promises: { readFile },
  readFileSync,
} = require("fs");
const { createServer } = require("http");
const { createSecureServer } = require("http2");

function cors(req, res) {
  if (req.headers["origin"]) {
    res.setHeader("access-control-allow-origin", req.headers["origin"]);
    res.setHeader("access-control-allow-credentials", "true");
    if (req.headers["access-control-request-headers"]) {
      res.setHeader(
        "access-control-allow-headers",
        req.headers["access-control-request-headers"]
      );
    }
  }
}

function getCookies(req) {
  return (req.headers["cookie"] || "")
    .split(";")
    .filter((x) => x)
    .map((x) => x.split("="))
    .reduce((map, [key, value]) => {
      map[key.trim()] = (value || "").trim();
      return map;
    }, {});
}

function getOrigin(req) {
  return req.httpVersion === "2.0"
    ? `${req.scheme}://${req.authority}`
    : `http://${req.headers["host"]}`;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (d) => chunks.push(d));
    req.on("end", () => resolve(chunks.join("")));
    req.on("error", (e) => reject(e));
  });
}

const HANDLERS = {
  // OPTIONS
  OPTIONS: (req, res) => {
    // status, headers
    res.statusCode = 200;
    cors(req, res);
  },
  GET: {
    // GET /
    "/": async (req, res) => {
      // status, headers
      res.statusCode = 200;
      res.setHeader("cache-control", "no-store");
      res.setHeader("content-type", "text/html");
      cors(req, res);

      // body
      const html = (await readFile("index.html")).toString();
      res.write(
        html.replace(
          "{result}",
          `Cookies sent to ${getOrigin(req)} <pre>${JSON.stringify(
            getCookies(req),
            null,
            2
          )}</pre>`
        )
      );
    },
    // GET /get-cookies
    "/get-cookies": (req, res) => {
      // status, headers
      res.statusCode = 200;
      res.setHeader("cache-control", "no-store");
      res.setHeader("content-type", "application/json");
      cors(req, res);

      // body
      res.write(JSON.stringify(getCookies(req)));
    },
  },
  POST: {
    // POST /clear-cookies
    "/clear-cookies": (req, res) => {
      // status, headers
      res.statusCode = 200;
      res.setHeader("clear-site-data", '"cookies"');
      cors(req, res);
    },
    // POST /set-cookies
    "/set-cookies": async (req, res) => {
      // request body
      const reqBody = await readBody(req);
      const { cookiesToSet } = JSON.parse(reqBody);
      const cookies = cookiesToSet.map(
        ({ name, value, sameSite, secure }) =>
          `${name}=${value}; HttpOnly${secure ? "; Secure" : ""}${
            sameSite ? `; SameSite=${sameSite}` : ""
          }; Expires=${new Date(Date.now() + 3600000).toUTCString()}`
      );

      // status, headers
      res.statusCode = 200;
      res.setHeader("content-type", "application/json");
      res.setHeader("set-cookie", cookies);
      cors(req, res);

      // body
      res.write(JSON.stringify({ status: "OK" }));
    },
  },
};

const handler = async (req, res) => {
  console.info(`${req.method} ${getOrigin(req)}${req.url}`);

  try {
    if (typeof HANDLERS[req.method] === "function") {
      await HANDLERS[req.method](req, res);
    } else if (HANDLERS[req.method] && HANDLERS[req.method][req.url]) {
      await HANDLERS[req.method][req.url](req, res);
    } else {
      // status headers
      res.statusCode = 404;
      res.setHeader("content-type", "text/plain");
      cors(req, res);

      // body
      res.write(`No resource found for: ${req.method} ${req.url}`);
    }
  } catch (e) {
    console.error(e);

    // status, headers
    res.statusCode = 500;
    res.setHeader("content-type", "text/plain");
    cors(req, res);

    // body
    res.write(`Failed to process ${req.method} ${req.url}: ${e.toString()}`);
  } finally {
    if (!res.writableEnded) {
      res.end();
    }
  }
};

// HTTP server
const httpServer = createServer(handler);
httpServer.listen(8080);

// HTTPS server
const httpsServer = createSecureServer(
  {
    cert: readFileSync("cert.pem"),
    key: readFileSync("key.pem"),
    allowHTTP1: true,
  },
  handler
);
httpsServer.listen(8443);

console.info("Server started!");
