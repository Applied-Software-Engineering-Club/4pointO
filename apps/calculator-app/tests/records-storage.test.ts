import { afterEach, describe, expect, it, vi } from "vitest";
import {
  STORAGE_KEY,
  loadRecords,
  saveRecords,
  type CourseGrade,
} from "../backend/records-storage";

const record: CourseGrade = {
  id: "cs-146",
  courseName: "CS 146",
  season: "Spring",
  year: "2027",
  letterGrade: "A-",
  percentGrade: "91",
};

afterEach(() => vi.restoreAllMocks());

describe("records storage", () => {
  it("returns null when nothing has been saved", () => {
    expect(loadRecords()).toEqual({ ok: true, records: null });
  });

  it("restores exactly what was saved", () => {
    expect(saveRecords([record])).toEqual({ ok: true });
    expect(loadRecords()).toEqual({ ok: true, records: [record] });
  });

  it("saves an empty list as an empty list, not as nothing", () => {
    saveRecords([]);
    expect(loadRecords()).toEqual({ ok: true, records: [] });
  });

  it("reports unreadable data and keeps a backup copy", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    const result = loadRecords();
    expect(result.ok).toBe(false);
    expect(localStorage.getItem(`${STORAGE_KEY}.corrupt`)).toBe("{not json");
  });

  it("rejects records with the wrong shape", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, records: [{ id: 1 }] }),
    );
    expect(loadRecords().ok).toBe(false);
  });

  it("explains when storage is full", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    expect(saveRecords([record])).toEqual({
      ok: false,
      error: "Browser storage is full.",
    });
  });

  it("reports a failed read instead of throwing", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(loadRecords().ok).toBe(false);
  });
});
