import os from "node:os";
import fs from "node:fs";
import { createLogger } from "../logger.js";

const log = createLogger("tool:system");

/** A structured snapshot of the machine: OS, CPU, RAM, disk, network.
 *  All cross-platform (no shell calls) so it works on Windows, macOS, and Linux. */
export function getSystemInfo(): string {
  log.info("system_info");

  const info: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    hostname: os.hostname(),
    platform: `${os.type()} ${os.release()} (${os.arch()})`,
    uptime_hours: Math.round((os.uptime() / 3600) * 10) / 10,
    user: process.env.USER ?? process.env.USERNAME ?? "unknown",
    cpu: {
      cores: os.cpus().length,
      model: os.cpus()[0]?.model?.trim() ?? "unknown",
      load_1m: os.loadavg()[0].toFixed(2), // always 0 on Windows
    },
    memory: {
      total_gb: round1(os.totalmem() / 1e9),
      free_gb: round1(os.freemem() / 1e9),
      used_pct: Math.round((1 - os.freemem() / os.totalmem()) * 100),
    },
  };

  // Disk usage via built-in statfs (cross-platform — no `df`).
  try {
    const root = process.platform === "win32" ? `${process.env.SystemDrive ?? "C:"}\\` : "/";
    const s = fs.statfsSync(root);
    const total = s.bsize * s.blocks;
    const free = s.bsize * s.bavail;
    info.disk = {
      total_gb: round1(total / 1e9),
      free_gb: round1(free / 1e9),
      used_pct: Math.round((1 - free / total) * 100),
    };
  } catch {
    /* disk info optional */
  }

  // Non-internal network interfaces and their IPs.
  const ifaces: Record<string, string[]> = {};
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    const ips = (addrs ?? []).filter((a) => !a.internal).map((a) => a.address);
    if (ips.length) ifaces[name] = ips;
  }
  info.network = ifaces;

  return JSON.stringify(info, null, 2);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}