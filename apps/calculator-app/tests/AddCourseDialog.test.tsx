import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { GpaCalculator } from "../frontend";

async function openDialog() {
  const user = userEvent.setup();
  render(<GpaCalculator />);
  await user.click(screen.getByRole("button", { name: "Add" }));
  return user;
}

describe("course search and selection", () => {
  it("finds courses by code and adds the selected one", async () => {
    const user = await openDialog();
    await user.type(screen.getByLabelText("Search"), "CS 22A{Enter}");

    expect(screen.getAllByText(/CS 22A/).length).toBeGreaterThan(0);
    await user.click(screen.getAllByRole("button", { name: "Add course" })[0]);
    expect(screen.getAllByRole("listitem").length).toBe(3);
  });

  it("shows course details when available", async () => {
    const user = await openDialog();
    await user.type(screen.getByLabelText("Search"), "CS 22A{Enter}");
    await user.click(screen.getAllByRole("button", { name: "View details" })[0]);

    expect(screen.getByRole("article")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View in SJSU catalog" })).toBeInTheDocument();
  });

  it("offers manual entry when nothing matches", async () => {
    const user = await openDialog();
    await user.type(screen.getByLabelText("Search"), "zzzz-no-match{Enter}");

    expect(screen.getByText("No courses found")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Enter course manually" }));
    expect(screen.getByLabelText("Course")).toHaveValue("zzzz-no-match");
  });

  it("rejects an empty manual course name", async () => {
    const user = await openDialog();
    await user.click(screen.getByRole("button", { name: "Enter manually" }));
    await user.click(screen.getByRole("button", { name: "Add course" }));

    expect(screen.getByText("Enter a course name.")).toBeInTheDocument();
  });
});
