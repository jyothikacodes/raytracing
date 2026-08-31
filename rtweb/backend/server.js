// CSS 311 Assignment I - Ray Tracer Backend API
//
// Responsibility: run the compiled C++ ray tracer binaries as child
// processes, convert their PPM output to PNG (pure JS, no ImageMagick
// needed), and return { image, time, speedup, efficiency } to the
// React frontend. No rendering math lives here -- that's all in C++.

const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const app = express();
app.use(cors());
app.use(express.json());

const CPP_DIR = path.join(__dirname, "..", "cpp");
const SERIAL_BIN = path.join(CPP_DIR, "serial_raytracer");
const OPENMP_BIN = path.join(CPP_DIR, "openmp_raytracer");
const TMP_DIR = path.join(__dirname, "tmp");
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR);

// In-memory history of renders this session, and the serial baseline time
// per (width,height,spheres) key, used to compute speedup/efficiency.
let history = [];
const serialBaselines = {}; // key "WxH_S" -> time in seconds

function ppmToPngBase64(ppmPath) {
  const buf = fs.readFileSync(ppmPath);
  // Parse minimal PPM P6 header: "P6\n<W> <H>\n255\n" then raw RGB bytes
  let offset = 0;
  function readToken() {
    while (buf[offset] === 0x0a || buf[offset] === 0x20) offset++; // skip ws
    let start = offset;
    while (buf[offset] !== 0x0a && buf[offset] !== 0x20) offset++;
    return buf.slice(start, offset).toString();
  }
  const magic = readToken();      // "P6"
  const width = parseInt(readToken(), 10);
  const height = parseInt(readToken(), 10);
  readToken();                    // "255"
  offset += 1;                    // single whitespace byte before binary data
  const rgb = buf.slice(offset);

  const png = new PNG({ width, height });
  for (let i = 0, j = 0; i < width * height; i++, j += 3) {
    png.data[i * 4 + 0] = rgb[j];
    png.data[i * 4 + 1] = rgb[j + 1];
    png.data[i * 4 + 2] = rgb[j + 2];
    png.data[i * 4 + 3] = 255;
  }
  return PNG.sync.write(png).toString("base64");
}

function runBinary(binPath, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(binPath, args);
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error(stderr || `exit code ${code}`));
      try {
        const lastLine = stdout.trim().split("\n").pop();
        resolve(JSON.parse(lastLine));
      } catch (e) {
        reject(new Error("Could not parse ray tracer output: " + stdout));
      }
    });
    proc.on("error", reject);
  });
}

app.post("/api/render", async (req, res) => {
  try {
    const width = parseInt(req.body.width, 10) || 500;
    const height = parseInt(req.body.height, 10) || 500;
    const mode = req.body.mode === "openmp" ? "openmp" : "serial";
    const threads = mode === "openmp" ? (parseInt(req.body.threads, 10) || 4) : 1;
    const spheres = Math.min(3, Math.max(2, parseInt(req.body.spheres, 10) || 3));

    const outPath = path.join(TMP_DIR, `render_${Date.now()}.ppm`);
    let result;
    if (mode === "serial") {
      result = await runBinary(SERIAL_BIN, [width, height, outPath, spheres]);
    } else {
      result = await runBinary(OPENMP_BIN, [width, height, outPath, threads, spheres]);
    }

    const baselineKey = `${width}x${height}_${spheres}`;
    if (mode === "serial") {
      serialBaselines[baselineKey] = result.time;
    }
    const serialTime = serialBaselines[baselineKey];
    const speedup = (serialTime != null && result.time > 0) ? serialTime / result.time : null;
    const efficiency = (speedup != null && speedup > 0) ? speedup / threads : null;

    const imageBase64 = ppmToPngBase64(outPath);
    fs.unlink(outPath, () => {});

    const entry = {
      id: Date.now(),
      mode,
      threads,
      width,
      height,
      spheres,
      time: result.time,
      speedup,
      efficiency,
    };
    history.push(entry);

    res.json({ ...entry, image: `data:image/png;base64,${imageBase64}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/history", (req, res) => res.json(history));
app.post("/api/history/clear", (req, res) => { history = []; res.json({ ok: true }); });

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Ray tracer backend listening on http://localhost:${PORT}`));
