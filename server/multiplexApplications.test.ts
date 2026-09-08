import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createMultiplexApplicationRouter } from "./multiplexApplications";
const valid = {submissionId: "123e4567-e89b-42d3-a456-426614174000", name: "Test Applicant", email: "test@example.com", attendedEvent: "yes", location: "Toronto", stage: "Evaluating a site", units: 6, timeline: "Spring 2027", experience: "First project with an experienced builder", project: "Convert the property into six rental homes", consent: true};
function app(save = vi.fn().mockResolvedValue(undefined)) {const a = express(); a.use(express.json()); a.use("/", createMultiplexApplicationRouter(save)); return {a,save};}
describe("multiplex applications", () => {
  it("persists a validated application before confirming receipt", async () => {const {a,save}=app(); const r=await request(a).post("/").send(valid); expect(r.status).toBe(201); expect(save).toHaveBeenCalledOnce(); expect(r.body.reference).toBe(valid.submissionId);});
  it.each([{consent:false},{email:"bad"},{units:1},{project:"short"},{website:"spam"},{attendedEvent:""}])("rejects invalid input %j",async change => {const {a,save}=app(); expect((await request(a).post("/").send({...valid,...change})).status).toBe(400); expect(save).not.toHaveBeenCalled();});
  it("never reports success after a persistence failure",async () => {const {a}=app(vi.fn().mockRejectedValue(new Error("offline"))); const r=await request(a).post("/").send(valid); expect(r.status).toBe(503); expect(r.body.success).toBeUndefined();});
  it("does not expose applications publicly", async () => {const {a}=app(); expect((await request(a).get("/")).status).toBe(404);});
});
