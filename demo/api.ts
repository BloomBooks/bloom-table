import fs from "fs/promises";
import path from "path";
import { JSDOM } from "jsdom";

export async function getExamples(req, res, next) {
  console.log(`[API] ${req.method} request to /api/examples`);
  if (req.method !== "GET") return next();

  try {
    const toExample = async (dir: string, group: "exercises" | "tests", file: string) => {
      const pngFile = file.replace(".html", ".png");
      // Preferred location: under the same group dir
      const preferredPngPath = path.join(__dirname, group, pngFile);
      const legacyPngPath = path.join(__dirname, "pages", pngFile);
      // Check preferred first
      const preferredExists = await fs
        .access(preferredPngPath)
        .then(() => true)
        .catch(() => false);
      let pngExists = preferredExists;
      let pngPathRel: string | undefined = preferredExists ? `./${group}/${pngFile}` : undefined;
      if (!preferredExists) {
        // If only legacy exists, try to move it into the preferred location to keep things tidy
        const legacyExists = await fs
          .access(legacyPngPath)
          .then(() => true)
          .catch(() => false);
        if (legacyExists) {
          try {
            await fs.mkdir(path.dirname(preferredPngPath), { recursive: true });
            await fs.rename(legacyPngPath, preferredPngPath);
            pngExists = true;
            pngPathRel = `./${group}/${pngFile}`;
          } catch (moveErr) {
            console.warn(
              `[API] Could not move PNG from legacy location: ${legacyPngPath} -> ${preferredPngPath}:`,
              moveErr,
            );
            // Fall back to referencing legacy path so UI still shows image
            pngExists = true;
            pngPathRel = `./pages/${pngFile}`;
          }
        }
      }
      return {
        name: file
          .replace(".html", "")
          .replace(/([a-z])([A-Z])/g, "$1 $2")
          .replace(/^\w/, (c) => c.toUpperCase())
          .replace(/\d+/, (match) => ` ${match}`),
        htmlFile: file,
        pngFile: pngExists ? pngFile : undefined,
        pngPath: pngPathRel,
        group,
      };
    };

    const loadDir = async (group: "exercises" | "tests") => {
      const dir = path.join(__dirname, group);
      const files = await fs
        .readdir(dir)
        .then((arr) => arr)
        .catch(() => [] as string[]);
      const htmls = files.filter((f) => f.endsWith(".html") && f !== "index.html");
      return Promise.all(htmls.map((f) => toExample(dir, group, f)));
    };

    const [exercises, tests] = await Promise.all([loadDir("exercises"), loadDir("tests")]);

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end(JSON.stringify({ exercises, tests }));
  } catch (error) {
    res.statusCode = 500;
    console.error("Error reading directories:", error);
    res.end(JSON.stringify({ error: "Failed to read example directories" }));
  }
}

export async function handleSaveExampleRequest(req, res) {
  console.log(`[API] ${req.method} request to /api/save-example`);

  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight request
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method === "POST") {
    console.log("[API] Processing POST request");
    try {
      // Parse the request body
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.from(chunk));
      }
      const bodyStr = Buffer.concat(chunks).toString();
      console.log(`[API] Received body: ${bodyStr.substring(0, 100)}...`);
      const body = JSON.parse(bodyStr);

      const { exampleName, content } = body;

      if (!exampleName || content === undefined) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing exampleName or content." }));
        return;
      }

      // Prevent directory traversal
      const safeExampleName = path.normalize(exampleName).replace(/^(\.\.[\\/])+/g, "");
      if (safeExampleName.includes("..")) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Invalid example name." }));
        return;
      }

      // Determine the file path: if a group prefix is provided (tests/ or exercises/), use it
      let filePath: string | undefined;
      const withHtml = `${safeExampleName}.html`;
      const prefixed = path.resolve(__dirname, withHtml);
      const withinDemo = prefixed.startsWith(path.resolve(__dirname));
      if (withinDemo) {
        const exists = await fs
          .access(prefixed)
          .then(() => true)
          .catch(() => false);
        if (exists) filePath = prefixed;
      }
      // Fallback: try looking under tests/ then exercises/ for legacy unprefixed names
      if (!filePath && !safeExampleName.includes("/")) {
        const candidates = [
          path.resolve(__dirname, "tests", withHtml),
          path.resolve(__dirname, "exercises", withHtml),
        ];
        for (const p of candidates) {
          // eslint-disable-next-line no-await-in-loop
          const exists = await fs
            .access(p)
            .then(() => true)
            .catch(() => false);
          if (exists) {
            filePath = p;
            break;
          }
        }
      }

      console.log(`[API] Attempting to save to file: ${filePath}`);
      console.log(`[API] Current directory: ${__dirname}`);

      try {
        if (!filePath) {
          throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
        }
        await fs.access(filePath); // Check if file exists
        console.log(`[API] File exists: ${filePath}`);

        const html = await fs.readFile(filePath, "utf-8");
        const dom = new JSDOM(html);
        const { document } = dom.window;

        // Look for either id="page" or class="page"
        const pageElement = document.querySelector("#page") || document.querySelector(".page");
        if (!pageElement) {
          res.statusCode = 404;
          res.end(
            JSON.stringify({
              error: `Could not find a page element (with id='page' or class='page') in ${safeExampleName}.html`,
            }),
          );
          return;
        }

        pageElement.innerHTML = content;

        const newHtml = dom.serialize();
        await fs.writeFile(filePath, newHtml, "utf-8");

        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ message: "File saved successfully." }));
      } catch (error) {
        if (error.code === "ENOENT") {
          res.statusCode = 404;
          res.end(
            JSON.stringify({
              error: `Example file not found: ${safeExampleName}.html`,
            }),
          );
          return;
        }
        console.error("Error saving file:", error);
        res.statusCode = 500;
        res.end(
          JSON.stringify({
            error: "Internal server error while saving file.",
          }),
        );
      }
    } catch (error) {
      console.error("Error processing request:", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: "Internal server error." }));
    }
  } else {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method not allowed" }));
  }
}
