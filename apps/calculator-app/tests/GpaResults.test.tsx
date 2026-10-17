import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GpaResults } from "../frontend/GpaResults";

describe("GPA results display", () => {
  it("shows two decimal places and units", () => {
    render(
      <GpaResults semesterLabel="Fall 2026" semesterGpa={3.125} semesterUnits={10} cgpa={3.75} totalUnits={4} />,
    );
    expect(screen.getByText("3.13")).toBeInTheDocument();
    expect(screen.getByText("3.75")).toBeInTheDocument();
    expect(screen.getByText("10 units included")).toBeInTheDocument();
  });

  it("shows N/A when there are no included units", () => {
    render(
      <GpaResults semesterLabel="Fall 2026" semesterGpa={null} semesterUnits={0} cgpa={null} totalUnits={0} />,
    );
    expect(screen.getAllByText("N/A")).toHaveLength(2);
  });
});

// Sprint acceptance checks that need the GPA engine and grade mapping
// (still in code review, not on main). Fill these in once they merge.
describe("GPA engine acceptance checks", () => {
  it.todo("3 units A + 4 units B+ + 3 units C = 3.12 GPA");
  it.todo("3-unit A semester + 1-unit B semester = 3.75 CGPA");
  it.todo("all A grades = 4.00; all F grades = 0.00");
  it.todo("excluded grades (CR, NC, W, WU, I) don't count toward GPA units");
  it.todo("results update when a record is added, edited, or deleted");
  it.todo("what-if grades change projected results but not saved results");
});
