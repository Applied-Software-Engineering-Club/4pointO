# GPA Calculator — One-Week Sprint Tracker

## Sprint Goal

Build a calculator that lets students select SJSU classes, save grades, calculate semester GPA and CGPA, and compare what-if grades.

## Sprint Information

- **Start Date:** 10/05/2026
- **Due Date:** 10/12/2026
- **Owners:** N/A — assign at kickoff
- **Core Estimate:** 14 story points

## User Stories

| ID | User Story | Points | Owner | Due Date |
| --- | --- | --- | --- | --- |
| US-01 | As a student, I want to search SJSU classes and view their details so I can select my courses. | 3 | N/A | 10/12/2026 |
| US-02 | As a student, I want to add, edit, delete, and save grades so I can track my progress. | 3 | N/A | 10/12/2026 |
| US-03 | As a student, I want semester GPA and CGPA calculated using course units and SJSU grades so my results are accurate. | 5 | N/A | 10/12/2026 |
| US-04 | As a student, I want to try hypothetical grades so I can see how they affect my GPA. | 3 | N/A | 10/12/2026 |

## Task List

| Status | Task | Owner | Due Date | Functionality / Completion Criteria |
| --- | --- | --- | --- | --- |
| Not Started | Set up calculator layout and shared data fields | N/A | 10/12/2026 | Agree on course, semester, units, and grade fields; build a mobile-friendly layout. |
| Not Started | Add SJSU course search and details | N/A | 10/12/2026 | Search a course dataset; show title, units, description, and professor when available. Allow manual course entry. |
| Not Started | Build grade entry and saving | N/A | 10/12/2026 | Add, edit, and delete courses; validate inputs; save grades in browser storage across refreshes. |
| Not Started | Implement GPA calculations and results | N/A | 10/12/2026 | Support SJSU letter grades, including +/−; calculate unit-weighted semester GPA and CGPA; display results on a 0–4.0 scale. |
| Not Started | Build what-if calculator | N/A | 10/12/2026 | Show projected GPA from temporary grades; reset scenarios without changing saved grades. |
| Not Started | Test, review, and prepare demo | N/A | 10/12/2026 | Verify calculations, storage, validation, and mobile layout; review and merge completed work. |

## Calculation Rules

- Quality points = grade-point value × course units.
- Semester GPA = semester quality points ÷ included GPA units.
- CGPA = total quality points ÷ total included GPA units.
- Use the verified SJSU grade mapping and rules for excluded grades.
- Keep full precision during calculations; display two decimal places.
- Show `N/A` when there are no included GPA units.

## Optional Stretch Goals

Only attempt these after all core tasks pass testing.

| Status | Feature | Owner | Due Date | Limited Scope |
| --- | --- | --- | --- | --- |
| Not Started | Transcript parser | N/A | 10/12/2026 | Support one agreed text-based transcript format; let users review and correct extracted courses before saving. |
| Not Started | Canvas integration | N/A | 10/12/2026 | If authorized API access is available, fetch visible grades for review before importing. Mark Blocked if access is unavailable. |

## Acceptance Checks

- [ ] Selected courses show available details.
- [ ] Saved courses and grades remain after refreshing.
- [ ] Adding, editing, or deleting a course updates results.
- [ ] 3 units of A, 4 units of B+, and 3 units of C produce a GPA of **3.12**.
- [ ] A 3-unit A semester and a 1-unit B semester produce a CGPA of **3.75**.
- [ ] Empty records display `N/A`.
- [ ] What-if changes leave saved grades unchanged.
- [ ] Core features work on mobile and desktop.

## Team Updates and Definition of Done

- Assign one owner to each task at kickoff.
- Use: `Not Started`, `In Progress`, `Blocked`, or `Completed`.
- Add a PR link when a task is completed and report blockers immediately.
- Finish core features before starting stretch goals.
- The sprint is done when core checks pass, code is reviewed and merged, and the app is ready to demo.
