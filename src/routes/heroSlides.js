const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const prisma = require("../lib/prisma");
const { requireMabel } = require("../middleware/mabelAuth");

const router = express.Router();

const MAX_SLIDES = 10;

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadsDir = path.join(__dirname, "..", "..", "uploads", "hero");
        fs.mkdirSync(uploadsDir, { recursive: true });
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const safeName = file.originalname.replace(/\s+/g, "-").toLowerCase();
        cb(null, `${Date.now()}-${safeName}`);
    },
});

const upload = multer({ storage });

/* ── Auto-seed: copy existing static videos into DB on first load ── */
const STATIC_SEED = [
    { file: "blanqueria_y_bazar.mp4", mobile: "blanqueria_y_bazar_mobile.mp4", duration: 5000 },
    { file: "diseno_sin_titulo.mp4", mobile: null, duration: 5000 },
    { file: "renova_tu_cama.mp4", mobile: "renova_tu_cama_mobile.mp4", duration: 5000 },
    { file: "promo-del-mes-2.mp4", mobile: "promo_del_mes_2_mobile.mp4", duration: 6000 },
    { file: "arma-tu-paquete-2.mp4", mobile: "arma_tu_paquete_2_mobile.mp4", duration: 8000 },
];

let seedDone = false;

async function seedIfEmpty() {
    if (seedDone) return;
    seedDone = true;

    const count = await prisma.heroSlide.count();
    if (count > 0) return; // already has data

    const assetsDir = path.join(__dirname, "..", "..", "frontend", "src", "assets", "hero");
    const uploadsDir = path.join(__dirname, "..", "..", "uploads", "hero");
    fs.mkdirSync(uploadsDir, { recursive: true });

    for (let i = 0; i < STATIC_SEED.length; i++) {
        const s = STATIC_SEED[i];

        // Copy desktop video
        const srcPath = path.join(assetsDir, s.file);
        const destPath = path.join(uploadsDir, s.file);
        if (fs.existsSync(srcPath) && !fs.existsSync(destPath)) {
            fs.copyFileSync(srcPath, destPath);
        }

        // Copy mobile video if exists
        let mobileSrc = null;
        if (s.mobile) {
            const mobileSrcPath = path.join(assetsDir, s.mobile);
            const mobileDestPath = path.join(uploadsDir, s.mobile);
            if (fs.existsSync(mobileSrcPath) && !fs.existsSync(mobileDestPath)) {
                fs.copyFileSync(mobileSrcPath, mobileDestPath);
            }
            mobileSrc = `/uploads/hero/${s.mobile}`;
        }

        await prisma.heroSlide.create({
            data: {
                url: `/uploads/hero/${s.file}`,
                mobileSrc,
                type: "video",
                position: i + 1, // 1-based, higher = later
                durationMs: s.duration,
            },
        });
    }

    console.log("[hero-slides] Seeded", STATIC_SEED.length, "static slides into DB");
}

/* ── Routes ── */

// GET all slides (ordered: lowest position = shown first)
router.get("/", async (req, res) => {
    try {
        await seedIfEmpty();
        const slides = await prisma.heroSlide.findMany({
            orderBy: { position: "asc" },
        });
        res.json(slides);
    } catch (error) {
        console.error("[hero-slides/list]", error.message);
        res.status(500).json({ error: "No se pudieron cargar los slides" });
    }
});

// POST new slide (admin only) — goes FIRST in the carousel
router.post("/", requireMabel, upload.single("media"), async (req, res) => {
    try {
        // Enforce max limit
        const count = await prisma.heroSlide.count();
        if (count >= MAX_SLIDES) {
            // Delete the uploaded file since we're rejecting
            if (req.file) {
                const filePath = path.join(__dirname, "..", "..", "uploads", "hero", req.file.filename);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
            return res.status(400).json({ error: `Máximo ${MAX_SLIDES} flyers en el carrusel. Eliminá uno antes de agregar otro.` });
        }

        if (!req.file) {
            return res.status(400).json({ error: "No se envió ningún archivo" });
        }

        const type = req.file.mimetype.startsWith("video/") ? "video" : "image";
        const url = `/uploads/hero/${req.file.filename}`;
        const durationMs = req.body.durationMs ? Number(req.body.durationMs) : 6000;

        // New slides get position = min(existing) - 1 so they appear FIRST
        const minPos = await prisma.heroSlide.aggregate({ _min: { position: true } });
        const position = (minPos._min.position ?? 0) - 1;

        const slide = await prisma.heroSlide.create({
            data: { url, type, position, durationMs },
        });

        res.status(201).json(slide);
    } catch (error) {
        console.error("[hero-slides/create]", error.message);
        res.status(400).json({ error: error.message || "No se pudo crear el slide" });
    }
});

// DELETE slide (admin only)
router.delete("/:id", requireMabel, async (req, res) => {
    try {
        const slide = await prisma.heroSlide.findUnique({ where: { id: req.params.id } });
        if (!slide) return res.status(404).json({ error: "Slide no encontrado" });

        // Delete desktop file from disk
        const filePath = path.join(__dirname, "..", "..", slide.url);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Delete mobile file from disk if exists
        if (slide.mobileSrc) {
            const mobileFilePath = path.join(__dirname, "..", "..", slide.mobileSrc);
            if (fs.existsSync(mobileFilePath)) {
                fs.unlinkSync(mobileFilePath);
            }
        }

        await prisma.heroSlide.delete({ where: { id: req.params.id } });
        res.json({ ok: true });
    } catch (error) {
        console.error("[hero-slides/delete]", error.message);
        res.status(400).json({ error: error.message || "No se pudo eliminar" });
    }
});

module.exports = router;
