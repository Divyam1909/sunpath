import { randomBytes, randomInt } from "node:crypto";

/** 192 random bits. Used for every public link: lead, quote and project status. */
export const newToken = () => randomBytes(24).toString("base64url");

export const newLeadCode = () => `LD-${randomInt(31000, 99999)}`;
export const newProjectCode = () => `PR-${randomInt(1000, 9999)}`;
