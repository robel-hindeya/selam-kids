import crypto from "node:crypto";
import { query } from "../lib/postgres.js";

const id = () => crypto.randomUUID();
const json = (value, fallback = []) => JSON.stringify(value ?? fallback);
const date = (value) => (value ? new Date(value) : new Date());

function userDoc(row) {
  if (!row) return null;
  return {
    _id: row.id,
    googleId: row.google_id,
    username: row.username,
    email: row.email,
    displayName: row.display_name,
    gender: row.gender,
    age: row.age,
    avatarUrl: row.avatar_url,
    legacyPoints: row.legacy_points,
    isAdmin: row.is_admin,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function contentDoc(row, type) {
  if (!row) return null;
  if (type === "banner")
    return {
      _id: row.id,
      title: row.title,
      kicker: row.kicker,
      imageUrl: row.image_url,
      active: row.active,
      order: row.display_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  if (type === "feedback")
    return {
      _id: row.id,
      type: row.type,
      message: row.message,
      imageUrl: row.image_url,
      familyName: row.family_name,
      kidUsername: row.kid_username,
      userId: row.user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  return {
    _id: row.id,
    title: row.title,
    description: row.description,
    coverUrl: row.cover_url,
    minutes: row.minutes,
    likes: row.likes,
    edition: row.edition,
    category: row.category,
    date: row.date,
    paragraphs: row.paragraphs,
    funFact: row.fun_fact,
    targetUrl: row.target_url,
    storyImages: row.story_images,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

class Query {
  constructor(load) {
    this.load = load;
    this.sortBy = null;
    this.populateUser = false;
  }
  sort(value) {
    this.sortBy = value;
    return this;
  }
  populate() {
    this.populateUser = true;
    return this;
  }
  then(resolve, reject) {
    return this.load(this.sortBy, this.populateUser).then(resolve, reject);
  }
  catch(reject) {
    return this.then(undefined, reject);
  }
}

function makeContentModel(type) {
  const table = type === "banner" ? "banners" : type === "feedback" ? "feedback" : "magazines";
  const fields =
    type === "banner"
      ? "id, title, kicker, image_url, active, display_order, created_at, updated_at"
      : type === "feedback"
        ? "id, type, message, image_url, family_name, kid_username, user_id, created_at, updated_at"
        : "id, title, description, cover_url, minutes, likes, edition, category, date, paragraphs, fun_fact, target_url, story_images, active, created_at, updated_at";

  const find = (filter = {}) =>
    new Query(async (sort, populateUser) => {
      const conditions = [];
      const values = [];
      for (const [key, value] of Object.entries(filter)) {
        const column = key === "active" ? "active" : key;
        values.push(value);
        conditions.push(`${column} = $${values.length}`);
      }
      const order = sort?.order ? "display_order ASC, created_at DESC" : "created_at DESC";
      const result = await query(
        `SELECT ${fields} FROM ${table}${conditions.length ? ` WHERE ${conditions.join(" AND ")}` : ""} ORDER BY ${order}`,
        values,
      );
      const docs = result.rows.map((row) => contentDoc(row, type));
      if (populateUser && type === "feedback") {
        for (const doc of docs) {
          if (doc.userId) {
            const user = await query(
              "SELECT id, display_name, email, username FROM users WHERE id = $1",
              [doc.userId],
            );
            if (user.rows[0])
              doc.userId = {
                _id: user.rows[0].id,
                displayName: user.rows[0].display_name,
                email: user.rows[0].email,
                username: user.rows[0].username,
              };
          }
        }
      }
      return docs;
    });

  return {
    find,
    findById: async (value) =>
      contentDoc(
        (await query(`SELECT ${fields} FROM ${table} WHERE id = $1`, [value])).rows[0],
        type,
      ),
    findByIdAndDelete: async (value) =>
      contentDoc(
        (await query(`DELETE FROM ${table} WHERE id = $1 RETURNING ${fields}`, [value])).rows[0],
        type,
      ),
    findByIdAndUpdate: async (value, data) => {
      const allowed =
        type === "banner"
          ? {
              title: "title",
              kicker: "kicker",
              imageUrl: "image_url",
              active: "active",
              order: "display_order",
            }
          : {
              title: "title",
              description: "description",
              coverUrl: "cover_url",
              minutes: "minutes",
              likes: "likes",
              edition: "edition",
              category: "category",
              date: "date",
              paragraphs: "paragraphs",
              funFact: "fun_fact",
              targetUrl: "target_url",
              storyImages: "story_images",
              active: "active",
            };
      const entries = Object.entries(data).filter(([key]) => allowed[key]);
      if (!entries.length) return makeContentModel(type).findById(value);
      const values = entries.map(([key, field]) =>
        field === "paragraphs" || field === "story_images" ? json(data[key]) : data[key],
      );
      const assignments = entries.map(([, field], index) => `${field} = $${index + 1}`).join(", ");
      const result = await query(
        `UPDATE ${table} SET ${assignments}, updated_at = NOW() WHERE id = $${values.length + 1} RETURNING ${fields}`,
        [...values, value],
      );
      return contentDoc(result.rows[0], type);
    },
    create: async (data) => {
      const now = new Date();
      if (type === "banner") {
        const result = await query(
          `INSERT INTO banners (id, title, kicker, image_url, active, display_order, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING ${fields}`,
          [
            id(),
            data.title,
            data.kicker ?? "",
            data.imageUrl ?? "",
            data.active !== false,
            Number(data.order ?? 0),
            now,
          ],
        );
        return contentDoc(result.rows[0], type);
      }
      if (type === "feedback") {
        const result = await query(
          `INSERT INTO feedback (id, type, message, image_url, family_name, kid_username, user_id, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${fields}`,
          [
            id(),
            data.type,
            data.message,
            data.imageUrl ?? "",
            data.familyName ?? "",
            data.kidUsername ?? "",
            data.userId ?? null,
            now,
          ],
        );
        return contentDoc(result.rows[0], type);
      }
      const result = await query(
        `INSERT INTO magazines (id, title, description, cover_url, minutes, likes, edition, category, date, paragraphs, fun_fact, target_url, story_images, active, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13::jsonb,$14,$15) RETURNING ${fields}`,
        [
          id(),
          data.title,
          data.description ?? "",
          data.coverUrl ?? "",
          Number(data.minutes ?? 5),
          Number(data.likes ?? 0),
          data.edition ?? "New Edition",
          data.category ?? "Magazine",
          data.date ?? "",
          json(data.paragraphs),
          data.funFact ?? "",
          data.targetUrl ?? "",
          json(data.storyImages),
          true,
          now,
        ],
      );
      return contentDoc(result.rows[0], type);
    },
  };
}

export const Magazine = makeContentModel("magazine");
export const Banner = makeContentModel("banner");
export const Feedback = makeContentModel("feedback");

const User = {
  findOne: async (filter) => {
    const [key, value] = Object.entries(filter)[0];
    const column = { googleId: "google_id", username: "username", email: "email" }[key] || key;
    return userDoc(
      (await query("SELECT * FROM users WHERE " + column + " = $1 LIMIT 1", [value])).rows[0],
    );
  },
  findById: (value) => ({
    lean: async () => userDoc((await query("SELECT * FROM users WHERE id = $1", [value])).rows[0]),
  }),
  findByIdAndUpdate: (value, data) => ({
    lean: async () => {
      const fields = {
        displayName: "display_name",
        username: "username",
        gender: "gender",
        age: "age",
        avatarUrl: "avatar_url",
      };
      const entries = Object.entries(data).filter(([key]) => fields[key]);
      const values = entries.map(([key]) => data[key]);
      const assignments = entries
        .map(([key], index) => `${fields[key]} = $${index + 1}`)
        .join(", ");
      const result = await query(
        `UPDATE users SET ${assignments}, updated_at = NOW() WHERE id = $${values.length + 1} RETURNING *`,
        [...values, value],
      );
      return userDoc(result.rows[0]);
    },
  }),
  create: async (data) => {
    const result = await query(
      `INSERT INTO users (id, google_id, username, email, display_name, gender, age, avatar_url, legacy_points) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        id(),
        data.googleId ?? null,
        data.username ?? null,
        data.email ?? null,
        data.displayName ?? "",
        data.gender ?? "",
        data.age ?? null,
        data.avatarUrl ?? "",
        data.legacyPoints ?? 0,
      ],
    );
    return userDoc(result.rows[0]);
  },
};

export default User;
