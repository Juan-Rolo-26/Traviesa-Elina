const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const prisma = require("../lib/prisma");
const { requireMabel } = require("../middleware/mabelAuth");

const router = express.Router();

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

// GET all slides
router.get("/", async (req, res) => {
    try {
        const slides = await prisma.heroSlide.findMany({
            orderBy: { position: "asc" },
        });
        res.json(slides);
    } catch (error) {
        console.error("[hero-slides/list]", error.message);
        res.status(500).json({ error: "No se pudieron cargar los slides" });
    }
});

// POST new slide (admin only)
router.post("/", requireMabel, upload.single("media"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No se envió ningún archivo" });
        }

        const type = req.file.mimetype.startsWith("video/") ? "video" : "image";
        const url = `/uploads/hero/${req.file.filename}`;
        const durationMs = req.body.durationMs ? Number(req.body.durationMs) : 6000;

        // Get max position
        const maxPos = await prisma.heroSlide.aggregate({ _max: { position: true } });
        const position = (maxPos._max.position ?? -1) + 1;

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

        // Delete file from disk
        const filePath = path.join(__dirname, "..", "..", slide.url);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        await prisma.heroSlide.delete({ where: { id: req.params.id } });
        res.json({ ok: true });
    } catch (error) {
        console.error("[hero-slides/delete]", error.message);
        res.status(400).json({ error: error.message || "No se pudo eliminar" });
    }
});

module.exports = router;
