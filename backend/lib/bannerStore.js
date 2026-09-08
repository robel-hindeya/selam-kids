import fs from "fs";
import path from "path";

const dataDir = path.resolve("data");
const bannersFile = path.join(dataDir, "banners.json");
const magazinesFile = path.join(dataDir, "magazines.json");

function readBanners() {
    if (!fs.existsSync(bannersFile)) return [];
    try {
        return JSON.parse(fs.readFileSync(bannersFile, "utf8"));
    } catch {
        return [];
    }
}

function writeBanners(banners) {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(bannersFile, JSON.stringify(banners, null, 2));
}

function readMagazines() {
    if (!fs.existsSync(magazinesFile)) return [];
    try {
        return JSON.parse(fs.readFileSync(magazinesFile, "utf8"));
    } catch {
        return [];
    }
}

function writeMagazines(magazines) {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(magazinesFile, JSON.stringify(magazines, null, 2));
}

export function getBanners({ activeOnly = false } = {}) {
    const banners = readBanners().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return activeOnly ? banners.filter((banner) => banner.active !== false) : banners;
}

export function addBanner(data) {
    const banner = {
        _id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: data.title,
        kicker: data.kicker ?? "",
        imageUrl: data.imageUrl,
        active: true,
        order: Number(data.order ?? 0),
        createdAt: new Date().toISOString(),
    };
    writeBanners([banner, ...readBanners()]);
    return banner;
}

export function removeBanner(id) {
    const banners = readBanners();
    writeBanners(banners.filter((banner) => banner._id !== id));
}

export function updateBanner(id, data) {
    const banners = readBanners();
    const index = banners.findIndex((banner) => banner._id === id);
    if (index === -1) return null;
    banners[index] = { ...banners[index], ...data, active: true };
    writeBanners(banners);
    return banners[index];
}

export function getMagazines({ activeOnly = false } = {}) {
    const magazines = readMagazines().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return activeOnly ? magazines.filter((magazine) => magazine.active !== false) : magazines;
}

export function addMagazine(data) {
    const magazine = {
        _id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: data.title,
        description: data.description ?? "",
        coverUrl: data.coverUrl,
        minutes: Number(data.minutes ?? 5),
        likes: Number(data.likes ?? 0),
        edition: data.edition ?? "New Edition",
        category: data.category ?? "Magazine",
        date: data.date ?? new Date().toISOString().slice(0, 10),
        paragraphs: Array.isArray(data.paragraphs) ? data.paragraphs : [],
        funFact: data.funFact ?? "",
        targetUrl: data.targetUrl ?? "",
        active: true,
        createdAt: new Date().toISOString(),
    };
    writeMagazines([magazine, ...readMagazines()]);
    return magazine;
}

export function removeMagazine(id) {
    writeMagazines(readMagazines().filter((magazine) => magazine._id !== id));
}

export function updateMagazine(id, data) {
    const magazines = readMagazines();
    const index = magazines.findIndex((magazine) => magazine._id === id);
    if (index === -1) return null;
    magazines[index] = { ...magazines[index], ...data, active: true };
    writeMagazines(magazines);
    return magazines[index];
}

export function getMagazine(id) {
    return readMagazines().find((magazine) => magazine._id === id) ?? null;
}
