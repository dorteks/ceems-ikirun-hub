import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import XLSX from "xlsx";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Load the TypeScript under test with isolated database/session dependencies.
function loadTs(relativePath, dependencies = {}, cache = new Map()) {
  const filename = path.resolve(root, relativePath);
  if (cache.has(filename)) return cache.get(filename).exports;
  const loadedModule = { exports: {} };
  cache.set(filename, loadedModule);
  const localRequire = createRequire(filename);
  const source = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const resolve = (specifier) => {
    if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
    const candidate = specifier.startsWith("@/")
      ? path.join(root, specifier.slice(2))
      : specifier.startsWith(".")
        ? path.resolve(path.dirname(filename), specifier)
        : null;
    if (candidate && existsSync(`${candidate}.ts`)) {
      return loadTs(`${candidate}.ts`, dependencies, cache);
    }
    return localRequire(specifier);
  };
  new Function("require", "module", "exports", source)(resolve, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

function spreadsheet(rows) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Customers");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

function importService() {
  const writes = [];
  const { parseAndImportXlsx } = loadTs("server/services/importService.ts", {
    "@/server/db/prisma": { prisma: { customer: { findMany: async () => [] } } },
    "./customerService": {
      importCustomers: async (customers) => {
        writes.push(customers);
        return { imported: customers.length };
      },
    },
  });
  return { parseAndImportXlsx, writes };
}

test("PAKTIM, Ikirun service centers and suspended/disconnect statuses validate and commit", async () => {
  const { parseAndImportXlsx, writes } = importService();
  const buffer = spreadsheet([
    { Account_number: "test-1", Meter_type: " paktim ", Service_Center: "IREE", Status: "DISCONNECT" },
    { Account_number: "test-2", Meter_type: "POSTPAID", Service_Center: "EWETA", Status: "SUSPENDED" },
    { Account_number: "test-3", Service_Center: "Station Road" },
  ]);
  const preview = await parseAndImportXlsx(buffer);
  assert.equal(preview.invalid_count, 0);
  assert.equal(preview.preview[0].meter_type, "PAKTIM");
  assert.equal(preview.preview[0].status, "DISCONNECTED");
  assert.equal(preview.preview[2].service_center, "STATION_ROAD");
  assert.equal(writes.length, 0);
  const result = await parseAndImportXlsx(buffer, { commit: true });
  assert.equal(result.imported, 3);
  assert.equal(writes[0][0].meter_type, "PAKTIM");
  assert.equal(writes[0][0].status, "DISCONNECTED");
});

test("non-enum fields accept arbitrary or missing values in preview and commit", async () => {
  const { parseAndImportXlsx, writes } = importService();
  const buffer = spreadsheet([
    {
      NIN: "pending-123", Phone_Number: "extension 4", email: "pending",
      Latitude: 100, Longitude: 200,
    },
    { Account_number: "test-2", NIN: "123" },
  ]);
  const preview = await parseAndImportXlsx(buffer);
  assert.equal(preview.valid_count, 2);
  assert.equal(preview.invalid_count, 0);
  assert.deepEqual(preview.errors, []);
  assert.equal(writes.length, 0);

  const result = await parseAndImportXlsx(buffer, { commit: true });
  assert.equal(result.imported, 2);
  assert.equal(writes[0][0].account_number, null);
  assert.equal(writes[0][0].nin, "pending-123");
  assert.equal(writes[0][0].phone, "extension 4");
  assert.equal(writes[0][0].email, "pending");
  assert.equal(writes[0][0].latitude, 100);
  assert.equal(writes[0][0].longitude, 200);
  assert.equal(writes[0][1].nin, "123");
});

test("unsupported enum values become blank in preview and commit", async () => {
  const { parseAndImportXlsx, writes } = importService();
  const buffer = spreadsheet([
    { Account_number: "test-1" },
    {
      Account_number: "test-2", Customer_type: "unknown", Meter_type: "unknown",
      "Meter Phase": "unknown", "Customer Category (MD1,MD2,NMD)": "unknown",
      Premise_Type: "unknown", Service_Center: "unknown", Status: "C",
    },
    { Account_number: "test-3", Premise_Type: 7031989999, Status: "D" },
  ]);
  const preview = await parseAndImportXlsx(buffer);
  assert.equal(preview.valid_count, 3);
  assert.equal(preview.invalid_count, 0);
  assert.deepEqual(preview.errors, []);
  const enumFields = [
    "customer_type", "meter_type", "meter_phase", "customer_category",
    "premise_type", "service_center", "status",
  ];
  for (const field of enumFields) {
    assert.equal(preview.preview[1][field], null);
  }
  assert.equal(preview.preview[2].premise_type, null);
  assert.equal(preview.preview[2].status, null);
  assert.equal(writes.length, 0);

  const result = await parseAndImportXlsx(buffer, { commit: true });
  assert.equal(result.imported, 3);
  assert.equal(result.invalid_count, 0);
  for (const field of enumFields) {
    assert.equal(writes[0][1][field], null);
  }
  assert.equal(writes[0][2].premise_type, null);
  assert.equal(writes[0][2].status, null);
});

test("unsupported enum values after the first batch do not block a large import", async () => {
  const { parseAndImportXlsx, writes } = importService();
  const rows = Array.from({ length: 501 }, (_, index) => ({ Account_number: `test-${index}` }));
  rows.push({ Account_number: "invalid", Status: "C" });
  const result = await parseAndImportXlsx(spreadsheet(rows), { commit: true });
  assert.equal(result.invalid_count, 0);
  assert.equal(result.imported, 502);
  assert.deepEqual(result.errors, []);
  assert.equal(writes.length, 1);
  assert.equal(writes[0][501].status, null);
});

function importRoute({ job, result } = {}) {
  const calls = [];
  const validResult = { total_rows: 1, valid_count: 1, invalid_count: 0, imported: 1 };
  const record = { id: 42, status: "COMMITTED", fileName: "test.xlsx", importedRows: 1 };
  const { POST } = loadTs("app/api/customers/import/route.ts", {
    "next/headers": { cookies: async () => ({ get: () => ({ value: "1" }) }) },
    "../../../../server/services/userService": {
      getSessionUser: async () => ({ id: 1, name: "Tester", username: "tester", role: "Data Manager" }),
    },
    "../../../../server/services/importService": {
      parseAndImportXlsx: async () => { calls.push("parse"); return result ?? validResult; },
    },
    "../../../../server/services/importJobService": {
      getImportJobById: async () => { calls.push("getJob"); return job ?? null; },
      updateImportJob: async () => { calls.push("updateJob"); return record; },
      createImportJob: async () => { calls.push("createJob"); return record; },
    },
    "../../../../server/services/auditService": {
      recordAuditEvent: async () => { calls.push("audit"); },
    },
  });
  const request = (jobId) => ({
    formData: async () => new Map([
      ["file", { name: "test.xlsx", arrayBuffer: async () => new ArrayBuffer(0) }],
      ["commit", "true"], ["jobId", jobId ?? null],
    ]),
  });
  return { POST, calls, request };
}

test("failed, missing and inaccessible jobs are rejected before any import", async () => {
  for (const [job, expected] of [
    [null, 404],
    [{ status: "FAILED", uploadedBy: { id: 1 } }, 409],
    [{ status: "VALIDATED", uploadedBy: { id: 2 } }, 403],
  ]) {
    const { POST, calls, request } = importRoute({ job });
    assert.equal((await POST(request("42"))).status, expected);
    assert.deepEqual(calls, ["getJob"]);
  }
});

test("commit revalidation errors return 409 with row details and do not update jobs", async () => {
  const errors = [{ row: 2, errors: ['status: invalid value "C"'] }];
  for (const jobId of [null, "42"]) {
    const { POST, calls, request } = importRoute({
      job: { status: "VALIDATED", uploadedBy: { id: 1 } },
      result: { total_rows: 1, valid_count: 0, invalid_count: 1, errors },
    });
    const response = await POST(request(jobId));
    assert.equal(response.status, 409);
    assert.deepEqual((await response.json()).errors, errors);
    assert.deepEqual(calls, jobId ? ["getJob", "parse"] : ["parse"]);
  }
});

test("valid commits check the job first and then update its record and audit", async () => {
  const { POST, calls, request } = importRoute({
    job: { status: "VALIDATED", uploadedBy: { id: 1 } },
  });
  const response = await POST(request("42"));
  assert.equal(response.status, 201);
  assert.equal((await response.json()).imported, 1);
  assert.deepEqual(calls, ["getJob", "parse", "updateJob", "audit"]);
});
