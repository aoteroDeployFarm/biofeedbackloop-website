/**
 * gen-manifest.js — regenerate functions/functions.yaml after each tsc build.
 *
 * The Firebase CLI reads functions.yaml first (detectFromYaml) and skips the
 * firebase-functions binary entirely. On this project's external disk (/Volumes)
 * the binary startup alone takes 5+ seconds, pushing past the 10 s spec-discovery
 * timeout. A static manifest bypasses that entirely.
 *
 * Run: node scripts/gen-manifest.js  (or via `npm run build`)
 */

"use strict";

const path = require("path");
const fs = require("fs");
const loader = require(path.join(__dirname, "../node_modules/firebase-functions/lib/runtime/loader.js"));
const manifest = require(path.join(__dirname, "../node_modules/firebase-functions/lib/runtime/manifest.js"));

const functionsDir = path.resolve(__dirname, "..");

loader
  .loadStack(functionsDir)
  .then((stack) => {
    const wire = manifest.stackToWire(stack);
    const lines = [];
    lines.push(`specVersion: ${wire.specVersion}`);

    if (wire.params && wire.params.length > 0) {
      lines.push("params:");
      for (const p of wire.params) {
        lines.push(`  - type: ${p.type}`);
        lines.push(`    name: ${p.name}`);
      }
    } else {
      lines.push("params: []");
    }

    lines.push("requiredAPIs: []");
    lines.push("extensions: {}");
    lines.push("endpoints:");

    for (const [name, ep] of Object.entries(wire.endpoints)) {
      lines.push(`  ${name}:`);
      lines.push(`    platform: ${ep.platform}`);
      if (ep.region) {
        lines.push("    region:");
        for (const r of ep.region) lines.push(`      - ${r}`);
      }
      lines.push(`    availableMemoryMb: ${ep.availableMemoryMb}`);
      lines.push(`    timeoutSeconds: ${ep.timeoutSeconds}`);
      lines.push(`    minInstances: ${ep.minInstances}`);
      lines.push(`    maxInstances: ${ep.maxInstances}`);
      lines.push(`    ingressSettings: ${ep.ingressSettings}`);
      lines.push(`    concurrency: ${ep.concurrency}`);
      lines.push(`    serviceAccountEmail: ${ep.serviceAccountEmail}`);
      lines.push(`    vpc: ${ep.vpc}`);
      lines.push(`    labels: {}`);

      if (ep.secretEnvironmentVariables && ep.secretEnvironmentVariables.length > 0) {
        lines.push("    secretEnvironmentVariables:");
        for (const s of ep.secretEnvironmentVariables) {
          lines.push(`      - key: ${s.key}`);
        }
      } else {
        lines.push("    secretEnvironmentVariables: []");
      }

      if (ep.callableTrigger !== undefined) {
        lines.push("    callableTrigger: {}");
      } else if (ep.httpsTrigger !== undefined) {
        lines.push("    httpsTrigger: {}");
      } else if (ep.eventTrigger) {
        const et = ep.eventTrigger;
        lines.push("    eventTrigger:");
        lines.push(`      eventType: ${et.eventType}`);
        if (et.eventFilters && Object.keys(et.eventFilters).length > 0) {
          lines.push("      eventFilters:");
          for (const [k, v] of Object.entries(et.eventFilters)) {
            lines.push(`        ${k}: "${v}"`);
          }
        }
        if (et.eventFilterPathPatterns && Object.keys(et.eventFilterPathPatterns).length > 0) {
          lines.push("      eventFilterPathPatterns:");
          for (const [k, v] of Object.entries(et.eventFilterPathPatterns)) {
            lines.push(`        ${k}: "${v}"`);
          }
        }
        lines.push(`      retry: ${et.retry}`);
      }

      lines.push(`    entryPoint: ${ep.entryPoint}`);
    }

    const yaml = lines.join("\n") + "\n";
    const outPath = path.join(functionsDir, "functions.yaml");
    fs.writeFileSync(outPath, yaml);
    console.log(`[gen-manifest] wrote ${outPath}`);
  })
  .catch((err) => {
    console.error("[gen-manifest] failed:", err.message);
    process.exit(1);
  });
