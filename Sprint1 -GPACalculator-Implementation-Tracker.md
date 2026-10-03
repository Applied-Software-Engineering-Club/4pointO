# GPA Calculator — One-Week Sprint Tracker

## Sprint Goal

Build a GPA calculator that allows students to:

- Select SJSU classes and view available class details.
- Enter, edit, remove, and save grades.
- Calculate semester GPA and cumulative GPA.
- Use SJSU’s full grade scale and a 0.0–4.0 display.
- Compare hypothetical grades without changing saved grades.

Transcript parsing and Canvas integration are stretch goals after the core calculator works.

## Sprint Information

- **Sprint Start:** 10/12/2026
- **Due Date:** 10/19/2026
- **Last Updated:** 10/03/2026
- **Duration:** One week
- **Owners:** N/A — assign at kickoff

## User Stories

| ID | User Story | Priority | Story Points | Owner | Due Date |
| --- | --- | --- | ---: | --- | --- |
| US-01 | As a student, I want to select SJSU classes and view their details so I can add the correct courses. | Core | 3 | N/A | 10/19/2026 |
| US-02 | As a student, I want to enter and save grades so I can maintain my semester history. | Core | 3 | N/A | 10/19/2026 |
| US-03 | As a student, I want accurate semester GPA and CGPA so I can understand my academic performance. | Core | 5 | N/A | 10/19/2026 |
| US-04 | As a student, I want to try hypothetical grades so I can compare possible outcomes. | Core | 3 | N/A | 10/19/2026 |
| US-05 | As a student, I want to import a supported transcript so I can reduce manual entry. | Stretch | 5 | N/A | 10/19/2026 |
| US-06 | As a student, I want to import available Canvas grades so I can update my GPA estimate. | Stretch | 8 | N/A | 10/19/2026 |

**Estimated core scope:** 14 story points. Confirm estimates and assignments at kickoff.

## Task List

| Status | Task | Owner | Due Date | Functionality / Completion Criteria |
| --- | --- | --- | --- | --- |
| Not Started | Confirm assignments and shared data structure | N/A | 10/19/2026 | Agree on course, semester, units, grade, and source fields. |
| Not Started | Build SJSU course selection and details | N/A | 10/19/2026 | Search/filter a course snapshot. Show title, units, description, and available section/professor information. Allow manual entry. |
| Not Started | Build grade entry and saving | N/A | 10/19/2026 | Add, edit, and delete courses. Validate inputs and retain records after refresh using browser storage. |
| Not Started | Implement grade mapping and GPA calculations | N/A | 10/19/2026 | Support SJSU grades. Calculate GPA using units as weights and CGPA using pooled points and units. |
| Not Started | Build GPA results and visual scale | N/A | 10/19/2026 | Display semester GPA, CGPA, included units, and a labeled 0.0–4.0 scale. Show N/A when no GPA units exist. |
| Not Started | Build what-if calculator | N/A | 10/19/2026 | Change hypothetical grades, show projected results, and reset without overwriting saved grades. |
| Not Started | Test and prepare the demo | N/A | 10/19/2026 | Verify calculations, saving, validation, scenarios, and mobile layout. Fix blocking defects. |
| Not Started | Stretch: Add transcript parsing | N/A | 10/19/2026 | Support one text-based SJSU PDF layout. Preview and correct extracted rows before saving. Prevent duplicate imports. |
| Not Started | Stretch: Add Canvas integration | N/A | 10/19/2026 | Connect with authorized OAuth access, fetch available grades, and review before importing. Preserve existing records on failure. |

## Calculation Requirements

- Use one calculation engine for saved grades, imports, and scenarios.
- Semester GPA = total quality points ÷ included GPA units.
- Quality points = grade-point value × GPA units.
- CGPA uses pooled quality points and units across included semesters.
- A+ and A both equal 4.0. Support plus and minus grades.
- F, WU, and IC contribute zero points while retaining GPA units.
- Exclude AU, I, CR, RD, RP, NC, and W from GPA calculations.
- Flag unknown grades for correction.
- Keep full precision internally and display estimates to two decimals.

Reference: [SJSU Grade Scale](https://www.sjsu.edu/registrar/academic-records/grade-changes.php)

## Work Order

1. Agree on assignments, data fields, and the interface.
2. Build course selection and saved grade entry.
3. Complete and test semester GPA and CGPA.
4. Add the GPA scale and what-if calculator.
5. Test the connected app and prepare the demo.
6. Begin stretch goals only after the core features pass their checks.

Check Canvas access at kickoff if attempting that stretch goal. Live integration requires institutional OAuth credentials. Mark it Blocked if access is unavailable.

## Coordination and Updates

- Assign one primary owner to each task.
- Agree on shared fields before building connected components.
- Submit small PRs and have another member review them.
- Update task status and add the PR link when completed.
- Report blockers immediately.

Statuses: `Not Started`, `In Progress`, `Blocked`, `Completed`.

## Acceptance Checks

- [ ] Selected courses show the correct available details.
- [ ] Saved grades survive refresh.
- [ ] Adding, editing, or deleting a course updates results.
- [ ] A: 3 units, B+: 4 units, C: 3 units produces GPA **3.12**.
- [ ] A: 3 units in one term and B: 1 unit in another produces CGPA **3.75**.
- [ ] All A grades produce **4.00**; all F grades produce **0.00**.
- [ ] No included GPA units produces **N/A**.
- [ ] Changing the four-unit B+ to A in the 3.12 example projects **3.40**.
- [ ] What-if changes leave saved grades unchanged.
- [ ] Core screens work on mobile and desktop.

## Definition of Done

- [ ] All core tasks and acceptance checks are complete.
- [ ] Code is reviewed and merged.
- [ ] The app builds and the demo works.
- [ ] No blocking defect causes incorrect GPA or lost grades.
- [ ] Stretch goals are clearly marked Completed, unfinished, or Blocked.
