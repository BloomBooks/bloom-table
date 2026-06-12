import fs from "fs/promises";
import path from "path";
import { JSDOM } from "jsdom";

export async function getExamples(req, res, next) {
  console.log(`[API] ${req.method} request to /api/examples`);
  if (req.method === "GET") {
    try {
      const demoDir = path.join(__dirname, "pages");
      const files = await fs.readdir(demoDir);
      const htmlFiles = await Promise.all(
        files
          .filter((file) => file.endsWith(".html") && file !== "index.html")
          .map(async (file) => {
            // look for a corresponding PNG file
            const pngFile = file.replace(".html", ".png");
            const pngPath = path.join(demoDir, pngFile);
            const pngExists = await fs
              .access(pngPath)
              .then(() => true)
              .catch(() => false);
            return {
              name: file
                .replace(".html", "")
                .replace(/([a-z])([A-Z])/g, "$1 $2") // Add space before capitals
                .replace(/^\w/, (c) => c.toUpperCase()) // Capitalize first letter
                .replace(/\d+/, (match) => ` ${match}`), // Add space before numbers
              htmlFile: file,
              pngFile: pngExists ? pngFile : undefined, // Only include PNG if it exists
            };
          }),
      );

      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.end(JSON.stringify(htmlFiles));
    } catch (error) {
      res.statusCode = 500;
      console.error("Error reading directory:", error);
      res.end(JSON.stringify({ error: "Failed to read directory" }));
    }
  } else {
    next();
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

      // Determine the file path
      const filePath = path.resolve(__dirname, "pages", `${safeExampleName}.html`);

      console.log(`[API] Attempting to save to file: ${filePath}`);
      console.log(`[API] Current directory: ${__dirname}`);
      console.log(
        `[API] Available files: ${(await fs.readdir(path.join(__dirname, "pages"))).join(", ")}`,
      );

      try {
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
