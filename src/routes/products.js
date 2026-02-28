const express = require("express");
const path = require("path");
const multer = require("multer");
const prisma = require("../lib/prisma");
const { requireMabel } = require("../middleware/mabelAuth");
const { parsePriceToCents, formatCentsToNumber } = require("../utils/pricing");

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, "..", "..", "uploads");
    try {
      require("fs").mkdirSync(uploadsDir, { recursive: true });
      cb(null, uploadsDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, "-").toLowerCase();
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({ storage });
const uploadMedia = upload.array("media", 10);

function runUpload(req, res) {
  return new Promise((resolve, reject) => {
    uploadMedia(req, res, (error) => {
      if (!error) {
        resolve();
        return;
      }
      if (error instanceof multer.MulterError) {
        reject(new Error(`Upload error: ${error.message}`));
        return;
      }
      reject(error);
    });
  });
}

function normalizeProduct(product) {
  const media = (product.media || [])
    .sort((a, b) => a.position - b.position)
    .map((item) => ({ url: item.url, type: item.type, position: item.position }));
  const cover = media.find((item) => item.type === "image");
  return {
    ...product,
    price: formatCentsToNumber(product.price),
    media,
    image: cover?.url || product.image,
  };
}

function inferType(file) {
  return file.mimetype.startsWith("video/") ? "video" : "image";
}

function ensureCoverIsImage(mediaItems) {
  if (mediaItems.length === 0) return;
  if (mediaItems[0].type !== "image") {
    throw new Error("Cover must be an image");
  }
}

function trimString(value) {
  return String(value || "").trim();
}

function hasDiagAccess(req) {
  const configuredKey = trimString(process.env.DIAG_KEY);
  const headerKey = trimString(req.headers["x-diag-key"]);
  const queryKey = trimString(req.query?.key);
  const providedKey = headerKey || queryKey;
  return Boolean(providedKey && configuredKey === providedKey);
}

router.get("/", async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { stock: { gt: 0 } },
      orderBy: { createdAt: "desc" },
      include: { media: true },
    });
    return res.json(products.map(normalizeProduct));
  } catch (error) {
    console.error("[products/list] error", {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
    });
    if (hasDiagAccess(req)) {
      return res.status(500).json({
        error: "No se pudieron cargar productos",
        debug: {
          message: error?.message || "unknown",
          code: error?.code || null,
          meta: error?.meta || null,
        },
      });
    }
    return res.status(500).json({ error: "No se pudieron cargar productos" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({ where: { id }, include: { media: true } });
    if (!product) return res.status(404).json({ error: "Not found" });
    return res.json(normalizeProduct(product));
  } catch (error) {
    console.error("[products/detail] error", {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
    });
    return res.status(500).json({ error: "No se pudo cargar el producto" });
  }
});

router.post("/", requireMabel, async (req, res) => {
  try {
    await runUpload(req, res);
    const { name, price, width, height, weight, stock, description } = req.body;
    const files = req.files || [];
    if (!name || !price || !width || !height || !weight || files.length === 0) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (![width, height, weight].every((value) => Number.isFinite(Number(value)))) {
      return res.status(400).json({ error: "Width, height and weight must be valid numbers" });
    }
    if (stock !== undefined && !Number.isFinite(Number(stock))) {
      return res.status(400).json({ error: "Stock must be a valid number" });
    }

    const mediaItems = files.map((file, index) => ({
      url: `/uploads/${file.filename}`,
      type: inferType(file),
      position: index,
    }));

    ensureCoverIsImage(mediaItems);

    const cover = mediaItems.find((item) => item.type === "image");

    const product = await prisma.product.create({
      data: {
        name,
        price: parsePriceToCents(price),
        width: Number(width),
        height: Number(height),
        weight: Number(weight),
        stock: stock ? Number(stock) : 1,
        description: description || null,
        image: cover?.url || "/uploads/placeholder.png",
        media: {
          create: mediaItems.map((item) => ({
            url: item.url,
            type: item.type,
            position: item.position,
          })),
        },
      },
      include: { media: true },
    });

    return res.status(201).json(normalizeProduct(product));
  } catch (error) {
    console.error("[products/create] error", {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
    });
    return res.status(400).json({ error: error?.message || "No se pudo crear el producto" });
  }
});

router.put("/:id", requireMabel, async (req, res) => {
  const { id } = req.params;
  try {
    await runUpload(req, res);
    const payload = {};
    const { name, price, width, height, weight, stock, description, existingMedia } = req.body;

    if (name) payload.name = name;
    if (price) payload.price = parsePriceToCents(price);
    if (width) payload.width = Number(width);
    if (height) payload.height = Number(height);
    if (weight) payload.weight = Number(weight);
    if (stock !== undefined) payload.stock = Number(stock);
    if (description !== undefined) payload.description = description || null;

    const providedExisting = existingMedia ? JSON.parse(existingMedia) : [];
    const newFiles = req.files || [];
    const newItems = newFiles.map((file) => ({
      url: `/uploads/${file.filename}`,
      type: inferType(file),
    }));

    const combined = [...providedExisting, ...newItems].map((item, index) => ({
      url: item.url,
      type: item.type,
      position: index,
    }));

    if (combined.length > 0) {
      ensureCoverIsImage(combined);
      const cover = combined.find((item) => item.type === "image");
      payload.image = cover?.url || payload.image;
      payload.media = {
        deleteMany: {},
        create: combined.map((item) => ({
          url: item.url,
          type: item.type,
          position: item.position,
        })),
      };
    }

    const updated = await prisma.product.update({
      where: { id },
      data: payload,
      include: { media: true },
    });

    if (updated.stock <= 0) {
      await prisma.product.delete({ where: { id } });
      return res.json({ deleted: true });
    }

    return res.json(normalizeProduct(updated));
  } catch (error) {
    console.error("[products/update] error", {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
    });
    return res.status(400).json({ error: error?.message || "No se pudo actualizar el producto" });
  }
});

router.delete("/:id", requireMabel, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.product.delete({ where: { id } });
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
