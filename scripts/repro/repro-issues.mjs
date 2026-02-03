/**
 * Repro harness for reported business-logic/data-integrity issues.
 *
 * Goals:
 * - Be runnable without Next.js server.
 * - Avoid touching real data: uses a dedicated test DB by default.
 * - Keep dependencies minimal: uses mongoose + dotenv already in repo.
 *
 * Run:
 *   node scripts/repro/repro-issues.mjs
 *
 * Env:
 *   MONGODB_URI (required for DB-backed tests)
 *   REPRO_DB_NAME (optional; default: "docsflow_repro")
 */
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config({ path: ".env.local" });

function ok(condition, message) {
  if (!condition) throw new Error(message);
}

function section(title) {
  // eslint-disable-next-line no-console
  console.log(`\n=== ${title} ===`);
}

function test(title, fn) {
  // eslint-disable-next-line no-console
  console.log(`- ${title}`);
  return Promise.resolve()
    .then(fn)
    .then(
      () => {
        // eslint-disable-next-line no-console
        console.log("  PASS");
        return { title, pass: true };
      },
      (err) => {
        // eslint-disable-next-line no-console
        console.log("  FAIL:", err?.message || err);
        return { title, pass: false, error: err };
      }
    );
}

function deepClone(x) {
  return JSON.parse(JSON.stringify(x));
}

function isEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (!keysB.includes(k)) return false;
    if (!isEqual(a[k], b[k])) return false;
  }
  return true;
}

/**
 * Mirrors current `mergeSilently` array behavior in `TechStackManager.tsx`.
 * This is intentionally kept "bug-compatible" so we can reproduce the issue.
 */
function mergeSilently_bugCompatible({ target, incoming, base, locallyModifiedPaths }) {
  const merge = (t, inc, b, path = []) => {
    const result = { ...t };
    for (const key in inc) {
      const fullPathStr = [...path, key].join("::");
      const incValue = inc[key];
      const baseValue = b?.[key];

      if (Array.isArray(incValue)) {
        if (!locallyModifiedPaths.includes(fullPathStr)) {
          result[key] = deepClone(incValue);
        } else {
          result[key] = incValue.map((incItem, idx) => {
            const localItem = t[key]?.[idx];
            const bItem = baseValue?.[idx];
            if (localItem && bItem && isEqual(localItem, bItem)) {
              return deepClone(incItem);
            }
            return localItem || incItem;
          });
        }
      } else if (typeof incValue === "object" && incValue !== null) {
        result[key] = merge(t[key] || {}, incValue, baseValue || {}, [...path, key]);
      } else {
        if (!locallyModifiedPaths.includes(fullPathStr)) {
          result[key] = incValue;
        }
      }
    }
    return result;
  };

  return merge(target, incoming, base);
}

/**
 * Mirrors current `handleItemChange` behavior in `ArrayEditor` in `TechStackManager.tsx`.
 */
function handleItemChange_bugCompatible(items, idx, field, value) {
  const newItems = [...items];
  const currentItem = newItems[idx];

  if (typeof currentItem === "string") {
    if (field === "name") newItems[idx] = value;
    else newItems[idx] = { name: currentItem, [field]: value };
  } else {
    if (field === "url") newItems[idx] = { ...currentItem, url: value, link: value };
    else newItems[idx] = { ...currentItem, [field]: value };
  }
  return newItems;
}

/**
 * Mirrors the risky part of webhook commit processing:
 * `payload.commits.forEach(commit => commit.added.forEach(...))`
 */
function webhookProcessCommits_bugCompatible(payload, dataPath) {
  const allRemoved = new Set();
  const allModified = new Set();

  payload.commits.forEach((commit) => {
    commit.removed.forEach((f) => f.startsWith(dataPath) && f.endsWith(".json") && allRemoved.add(f));
    commit.added.forEach((f) => f.startsWith(dataPath) && f.endsWith(".json") && allModified.add(f));
    commit.modified.forEach((f) => f.startsWith(dataPath) && f.endsWith(".json") && allModified.add(f));
  });

  return { allRemoved, allModified };
}

async function main() {
  const MONGODB_URI = process.env.MONGODB_URI;
  const REPRO_DB_NAME = process.env.REPRO_DB_NAME || "docsflow_repro";

  const results = [];

  section("Pure-function repros (no DB)");

  results.push(
    await test("Issue 5: mergeSilently drops local additions when incoming array shorter", () => {
      // base (docs_flow_data baseline)
      const base = { general: [{ name: "React" }, { name: "Vue" }] };
      // target (localData): user added Angular at end
      const target = { general: [{ name: "React" }, { name: "Vue" }, { name: "Angular" }] };
      // incoming (remote update): still only 2 items
      const incoming = { general: [{ name: "React", version: "18.1" }, { name: "Vue" }] };

      const locallyModifiedPaths = ["general"]; // array path marked locally modified
      const merged = mergeSilently_bugCompatible({ target, incoming, base, locallyModifiedPaths });

      ok(Array.isArray(merged.general), "Expected merged.general to be an array");
      ok(merged.general.length === 2, "Repro: expected length 2 (Angular dropped) to match current behavior");
      ok(merged.general.find((x) => x?.name === "Angular") === undefined, "Repro: expected Angular to be missing");
    })
  );

  results.push(
    await test("Issue 12: editing string item non-name converts it to object (mixed types)", () => {
      const items = ["React", "Vue"];
      const updated = handleItemChange_bugCompatible(items, 0, "version", "18.0");
      ok(typeof updated[0] === "object" && updated[0].name === "React", "Expected item 0 to become object");
      ok(typeof updated[1] === "string", "Expected item 1 to remain a string (mixed array types)");
    })
  );

  results.push(
    await test("Issue 15: webhook commit processing throws when payload.commits missing/empty", () => {
      const payloadMissing = {};
      let threw = false;
      try {
        webhookProcessCommits_bugCompatible(payloadMissing, "data/tech-stack-data");
      } catch (e) {
        threw = true;
      }
      ok(threw, "Repro: expected throw when payload.commits is undefined");

      // Empty commits is not a throw, but results in no processing.
      const payloadEmpty = { commits: [] };
      const { allModified } = webhookProcessCommits_bugCompatible(payloadEmpty, "data/tech-stack-data");
      ok(allModified.size === 0, "Expected no modifications processed when commits is empty");
    })
  );

  if (!MONGODB_URI) {
    section("DB-backed repros (skipped)");
    // eslint-disable-next-line no-console
    console.log("MONGODB_URI not set; skipping DB-backed repro tests.");
  } else {
    section(`DB-backed repros (db: ${REPRO_DB_NAME})`);

    const conn = await mongoose.createConnection(MONGODB_URI, { dbName: REPRO_DB_NAME }).asPromise();

    const TechStackSchema = new mongoose.Schema(
      {
        _id: { type: String, required: true },
        version: { type: String, required: true },
        last_updated_by: { type: String },
        status: { type: String },
        data: mongoose.Schema.Types.Mixed,
        docs_flow_data: mongoose.Schema.Types.Mixed,
      },
      { timestamps: true, _id: false }
    );

    const TechStack =
      conn.models.TechStack || conn.model("TechStack", TechStackSchema, "tech_stack_data");

    // Clean slate for this harness run.
    await TechStack.deleteMany({ version: { $regex: /^repro-/ } });

    results.push(
      await test("Issue 4: updateDocsFlowData-style update returns 'success' even when no doc matched", async () => {
        const version = `repro-missing-${Date.now()}`;
        // Mirror current updateDocsFlowData behavior: it does not check result.
        const res = await TechStack.findOneAndUpdate(
          { version },
          { docs_flow_data: { general: [] }, status: "modified", last_updated_by: "docsflow" },
          { new: true } // still returns null if not found
        );
        ok(res === null, "Expected DB result null because no doc matched");
        // The real bug is: actions.ts would return { success: true } anyway.
      })
    );

    results.push(
      await test("Issue 8: updateDocsFlowData allows null/primitive docs_flow_data writes", async () => {
        const version = `repro-null-${Date.now()}`;
        const id = `${version}.json`;
        await TechStack.create({
          _id: id,
          version,
          data: { general: [{ name: "React" }] },
          docs_flow_data: { general: [{ name: "React" }] },
        });

        await TechStack.findOneAndUpdate(
          { version },
          { docs_flow_data: null, status: "modified", last_updated_by: "docsflow" }
        );
        const doc1 = await TechStack.findOne({ version }).lean();
        ok(doc1.docs_flow_data === null, "Expected docs_flow_data to be set to null (shows lack of validation)");

        await TechStack.findOneAndUpdate(
          { version },
          { docs_flow_data: "not-an-object", status: "modified", last_updated_by: "docsflow" }
        );
        const doc2 = await TechStack.findOne({ version }).lean();
        ok(doc2.docs_flow_data === "not-an-object", "Expected docs_flow_data to accept primitive (shows lack of validation)");
      })
    );

    results.push(
      await test("Issue 7: syncTechStack-style upsert overwrites existing docs_flow_data drafts", async () => {
        const version = `repro-sync-${Date.now()}`;
        const id = `${version}.json`;

        await TechStack.create({
          _id: id,
          version,
          data: { general: [{ name: "React" }] },
          docs_flow_data: { general: [{ name: "React" }, { name: "Angular" }] }, // draft addition
          status: "modified",
          last_updated_by: "docsflow",
        });

        // Mirror actions.ts syncTechStack write shape: overwrites BOTH data and docs_flow_data.
        const githubContent = { general: [{ name: "React" }] };
        await TechStack.findOneAndUpdate(
          { _id: id },
          {
            _id: id,
            version,
            last_updated_by: "github",
            status: "published",
            data: githubContent,
            docs_flow_data: githubContent, // <-- overwrite draft
          },
          { upsert: true }
        );

        const doc = await TechStack.findById(id).lean();
        ok(
          JSON.stringify(doc.docs_flow_data) === JSON.stringify(githubContent),
          "Repro: expected docs_flow_data overwritten to GitHub content"
        );
        ok(
          doc.docs_flow_data.general.length === 1,
          "Repro: expected Angular draft to be lost"
        );
      })
    );

    await conn.close();
  }

  section("Summary");
  const passCount = results.filter((r) => r.pass).length;
  const failCount = results.length - passCount;
  // eslint-disable-next-line no-console
  console.log(`Passed: ${passCount}/${results.length}  Failed: ${failCount}/${results.length}`);

  if (failCount > 0) process.exitCode = 1;
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

