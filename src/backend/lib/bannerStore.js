import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "data");
const bannersFile = path.join(dataDir, "banners.json");
const magazinesFile = path.join(dataDir, "magazines.json");
const feedbackFile = path.join(dataDir, "feedback.json");
const usersFile = path.join(dataDir, "users.json");

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

function readFeedback() {
    if (!fs.existsSync(feedbackFile)) return [];
    try {
        return JSON.parse(fs.readFileSync(feedbackFile, "utf8"));
    } catch {
        return [];
    }
}

function writeFeedback(feedback) {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(feedbackFile, JSON.stringify(feedback, null, 2));
}

function readUsers() {
  if (!fs.existsSync(usersFile)) return [];
  try {
    return JSON.parse(fs.readFileSync(usersFile, "utf8"));
  } catch {
    return [];
  }
}

function writeUsers(users) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
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
    storyImages: Array.isArray(data.storyImages)
      ? data.storyImages
      : data.storyImageUrl
        ? [data.storyImageUrl]
        : [],
    storyImageUrl: data.storyImageUrl ?? "",
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

export function getFeedback() {
    return readFeedback().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function addFeedback(data) {
    const feedback = {
        _id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ...data,
        createdAt: new Date().toISOString(),
    };
    writeFeedback([feedback, ...readFeedback()]);
    return feedback;
}

export function removeFeedback(id) {
  writeFeedback(readFeedback().filter((feedback) => feedback._id !== id));
}

export function upsertUser(data) {
  const users = readUsers();
  const index = users.findIndex((user) => user.googleId === data.googleId || user.email === data.email);
  const user = {
    _id: index === -1 ? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` : users[index]._id,
    username: data.username ?? "",
    googleId: data.googleId,
    email: data.email ?? "",
    displayName: data.displayName ?? "",
    gender: data.gender ?? "",
    age: data.age,
    avatarUrl: data.avatarUrl ?? "",
    legacyPoints: data.legacyPoints ?? 0,
    isAdmin: data.isAdmin ?? false,
    updatedAt: new Date().toISOString(),
    ...(index === -1 ? { createdAt: new Date().toISOString() } : {}),
  };
  if (index === -1) users.push(user);
  else users[index] = { ...users[index], ...user };
  writeUsers(users);
  return users[index === -1 ? users.length - 1 : index];
}

export function getUser(id) {
  return readUsers().find((user) => user._id === id) ?? null;
}

export function updateUser(id, updates) {
  const users = readUsers();
  const index = users.findIndex((user) => user._id === id);
  if (index === -1) return null;
  users[index] = { ...users[index], ...updates, updatedAt: new Date().toISOString() };
  writeUsers(users);
  return users[index];
}
