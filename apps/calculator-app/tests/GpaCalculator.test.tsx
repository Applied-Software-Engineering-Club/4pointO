import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEY, loadRecords } from "../backend/records-storage";
import { GpaCalculator } from "../frontend";

afterEach(() => vi.restoreAllMocks());

function savedRecords() {
  const result = loadRecords();
  if (!result.ok) throw new Error(result.error);
  return result.records;
}

function row(courseName: string) {
  return screen.getByText(courseName).closest("li") as HTMLElement;
}

// Unmount and mount again, like refreshing the page.
function refresh(view: ReturnType<typeof render>) {
  view.unmount();
  return render(<GpaCalculator />);
}

describe("GPA calculator saving and loading", () => {
  it("shows the starter courses on a first visit", () => {
    render(<GpaCalculator />);
    expect(screen.getByText("CS 151")).toBeInTheDocument();
    expect(screen.getByText("CS 160")).toBeInTheDocument();
  });

  it("saves an edited grade and restores it after a refresh", async () => {
    const user = userEvent.setup();
    const view = render(<GpaCalculator />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.selectOptions(
      screen.getByLabelText("Letter grade for CS 151"),
      "A",
    );
    expect(screen.getByRole("status")).toHaveTextContent("Saved");

    refresh(view);
    expect(within(row("CS 151")).getByText("A")).toBeInTheDocument();
    expect(within(row("CS 160")).getByText("B+")).toBeInTheDocument();
  });

  it("keeps a deleted course deleted after a refresh", async () => {
    const user = userEvent.setup();
    const view = render(<GpaCalculator />);

    await user.click(screen.getByRole("button", { name: "Remove CS 160" }));
    refresh(view);

    expect(screen.queryByText("CS 160")).not.toBeInTheDocument();
    expect(screen.getByText("CS 151")).toBeInTheDocument();
  });

  it("keeps an empty list empty after a refresh", async () => {
    const user = userEvent.setup();
    const view = render(<GpaCalculator />);

    await user.click(screen.getByRole("button", { name: "Remove CS 151" }));
    await user.click(screen.getByRole("button", { name: "Remove CS 160" }));
    refresh(view);

    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("saves a manually added course", async () => {
    const user = userEvent.setup();
    const view = render(<GpaCalculator />);

    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.click(screen.getByRole("button", { name: "Enter manually" }));
    await user.type(screen.getByLabelText("Course"), "ENGR 195A");
    await user.click(screen.getByRole("button", { name: "Add course" }));

    refresh(view);
    expect(screen.getByText("ENGR 195A")).toBeInTheDocument();
  });

  it("saves records across multiple semesters independently", async () => {
    const user = userEvent.setup();
    render(<GpaCalculator />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.selectOptions(screen.getByLabelText("Season for CS 160"), "Spring");
    const year = screen.getByLabelText("Year for CS 160");
    await user.clear(year);
    await user.type(year, "2027");

    const records = savedRecords();
    expect(records?.find((r) => r.courseName === "CS 160")).toMatchObject({
      season: "Spring",
      year: "2027",
    });
    expect(records?.find((r) => r.courseName === "CS 151")).toMatchObject({
      season: "Fall",
      year: "2026",
    });
  });

  it("never saves what-if grades", async () => {
    const user = userEvent.setup();
    const view = render(<GpaCalculator />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.selectOptions(screen.getByLabelText("Letter grade for CS 151"), "A");
    await user.click(screen.getByRole("button", { name: "Done" }));
    const before = localStorage.getItem(STORAGE_KEY);

    await user.click(screen.getByRole("button", { name: "What if" }));
    await user.selectOptions(screen.getByLabelText("Letter grade for CS 151"), "F");
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before);

    await user.click(screen.getByRole("button", { name: "What if" }));
    expect(within(row("CS 151")).getByText("A")).toBeInTheDocument();

    refresh(view);
    expect(within(row("CS 151")).getByText("A")).toBeInTheDocument();
  });

  it("tells the user when a save fails and keeps their change on screen", async () => {
    const user = userEvent.setup();
    render(<GpaCalculator />);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });

    await user.click(screen.getByRole("button", { name: "Remove CS 160" }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "Not saved: Browser storage is full.",
    );
    expect(screen.queryByText("CS 160")).not.toBeInTheDocument();
  });

  it("tells the user when saved grades can't be read, without deleting them", () => {
    localStorage.setItem(STORAGE_KEY, "{broken");
    render(<GpaCalculator />);

    expect(screen.getByRole("status")).toHaveTextContent("Not saved");
    expect(localStorage.getItem(`${STORAGE_KEY}.corrupt`)).toBe("{broken");
  });
});
