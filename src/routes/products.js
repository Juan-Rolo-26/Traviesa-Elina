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
  const wholesaleOffers = (product.wholesaleOffers || []).map((offer) => ({
    ...offer,
    price: formatCentsToNumber(offer.price),
  }));
  return {
    ...product,
    price: formatCentsToNumber(product.price),
    discountPrice: product.discountPrice != null ? formatCentsToNumber(product.discountPrice) : null,
    media,
    wholesaleOffers,
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
    const { category } = req.query;
    const where = { stock: { gt: 0 } };
    if (category) {
      where.category = category;
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { media: true, wholesaleOffers: true },
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
    const product = await prisma.product.findUnique({
      where: { id },
      include: { media: true, wholesaleOffers: true },
    });
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
    const { name, price, discountPrice, category, stock, description, isWholesale, wholesaleOffers } = req.body;
    const files = req.files || [];
    if (!name || !price || files.length === 0) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (stock !== undefined && !Number.isFinite(Number(stock))) {
      return res.status(400).json({ error: "Stock must be a valid number" });
    }

    const offersData = wholesaleOffers ? JSON.parse(wholesaleOffers) : [];

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
        discountPrice: discountPrice ? parsePriceToCents(discountPrice) : null,
        category: category || null,
        isWholesale: isWholesale === "true",
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
        wholesaleOffers: {
          create: offersData.map((o) => ({
            quantity: Number(o.quantity),
            price: parsePriceToCents(o.price),
          })),
        },
      },
      include: { media: true, wholesaleOffers: true },
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
    const { name, price, discountPrice, category, stock, description, isWholesale, wholesaleOffers, existingMedia } = req.body;

    if (name) payload.name = name;
    if (price) payload.price = parsePriceToCents(price);

    if (discountPrice !== undefined) {
      if (discountPrice === "") {
        payload.discountPrice = null;
      } else {
        payload.discountPrice = parsePriceToCents(discountPrice);
      }
    }

    if (category !== undefined) {
      payload.category = category === "" ? null : category;
    }

    if (isWholesale !== undefined) {
      payload.isWholesale = isWholesale === "true";
    }

    if (wholesaleOffers !== undefined) {
      const offersData = JSON.parse(wholesaleOffers);
      payload.wholesaleOffers = {
        deleteMany: {},
        create: offersData.map((o) => ({
          quantity: Number(o.quantity),
          price: parsePriceToCents(o.price),
        })),
      };
    }

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
