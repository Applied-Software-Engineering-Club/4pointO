# GPA Calculator — Sprint Task Tracker

## Sprint Goal

Build a GPA calculator that lets students:
- Search and select SJSU classes.
- View available course details.
- Add, edit, delete, and save grades.
- Calculate semester GPA and cumulative GPA (CGPA).
- Compare what-if grades without changing saved grades.

## Sprint Information

- **Start Date:** 10/05/2026
- **Due Date for All Tasks:** 10/12/2026
- **Owners:** N/A — assign as team members join
- **Estimated Core Scope:** 30 story points

## User Stories

| ID | User Story | Points | Due Date |
| --- | --- | --- | --- |
| US-01 | As a student, I want a clear, responsive interface so I can use the calculator on my phone or computer. | 3 | 10/12/2026 |
| US-02 | As a student, I want to search SJSU courses and view details so I can select my classes. | 5 | 10/12/2026 |
| US-03 | As a student, I want to manage and save grades by semester so I can track my academic history. | 8 | 10/12/2026 |
| US-04 | As a student, I want accurate semester GPA and CGPA so I can understand my academic progress. | 8 | 10/12/2026 |
| US-05 | As a student, I want to try hypothetical grades so I can plan for future results. | 6 | 10/12/2026 |

Points cover each complete story, including implementation and testing. Confirm estimates when assigning work.

## Planning and Wireframes

| Status | Task | Owner | Due Date | Completion Criteria |
| --- | --- | --- | --- | --- |
| Not Started | Assign tasks and confirm scope | N/A | 10/12/2026 | Assign an owner to each task and confirm core features. |
| Not Started | Create desktop and mobile wireframes | N/A | 10/12/2026 | Show course search, semester selection, grade entry, GPA results, and what-if controls. |
| Not Started | Review wireframes and divide components | N/A | 10/12/2026 | Approve the layout and agree on component responsibilities. |
| Not Started | Define shared data and service contracts | N/A | 10/12/2026 | Agree on course IDs, semester IDs, units, grades, record IDs, and error formats. |
| Not Started | Prepare shared sample data | N/A | 10/12/2026 | Provide sample courses and grade records so connected features can develop in parallel. |

## Frontend Tasks

| Status | Task | Owner | Due Date | Functionality / Completion Criteria |
| --- | --- | --- | --- | --- |
| Not Started | Build the responsive calculator layout | N/A | 10/12/2026 | Implement wireframes with consistent buttons, forms, spacing, and mobile layout. |
| Not Started | Build course search and selection | N/A | 10/12/2026 | Search/filter courses and select a class; show loading, empty, and error states. |
| Not Started | Display course details | N/A | 10/12/2026 | Show title, units, description, and section/professor when available. |
| Not Started | Build semester controls | N/A | 10/12/2026 | Create and select semesters; clearly show the active semester. |
| Not Started | Build class and grade entry | N/A | 10/12/2026 | Add, edit, and remove records with units and supported letter grades. |
| Not Started | Add manual course entry and validation | N/A | 10/12/2026 | Support courses missing from the dataset and explain invalid inputs. |
| Not Started | Connect saving and loading | N/A | 10/12/2026 | Load saved records and show save success or failure. |
| Not Started | Build GPA results display | N/A | 10/12/2026 | Show semester GPA, CGPA, included units, and a labeled 0–4.0 scale. |
| Not Started | Build what-if controls | N/A | 10/12/2026 | Compare saved and projected results using temporary grades; include reset. |
| Not Started | Integrate frontend components | N/A | 10/12/2026 | Connect course selection, grade records, storage, and GPA results. |

## Backend and Data Tasks

| Status | Task | Owner | Due Date | Functionality / Completion Criteria |
| --- | --- | --- | --- | --- |
| Not Started | Prepare the SJSU course dataset | N/A | 10/12/2026 | Load an agreed course snapshot with IDs, titles, units, and available descriptions; document coverage. |
| Not Started | Implement course search/filter service | N/A | 10/12/2026 | Return matches by course code, title, or department. |
| Not Started | Implement course details service | N/A | 10/12/2026 | Return available details and handle missing information. Professor information should belong to a section. |
| Not Started | Define semester and grade record models | N/A | 10/12/2026 | Support multiple semesters, stable record IDs, units, grades, and manual courses. |
| Not Started | Implement record create/update/delete | N/A | 10/12/2026 | Modify records without changing unrelated courses or semesters. |
| Not Started | Implement persistence and loading | N/A | 10/12/2026 | Save records in browser storage through a shared service and restore them after refreshing. |
| Not Started | Validate records and storage errors | N/A | 10/12/2026 | Reject invalid units/grades and return helpful errors without losing existing records. |
| Not Started | Implement the SJSU grade mapping | N/A | 10/12/2026 | Verify the full grade scale and excluded grades; flag unknown grades. |
| Not Started | Implement semester GPA and CGPA | N/A | 10/12/2026 | Calculate unit-weighted results and pool quality points and units across semesters. |
| Not Started | Implement what-if calculations | N/A | 10/12/2026 | Reuse the GPA engine with temporary overrides; preserve saved records. |

The core sprint uses browser storage. Accounts and cloud syncing are outside this sprint's core scope.

## Testing and Review

| Status | Task | Owner | Due Date | Completion Criteria |
| --- | --- | --- | --- | --- |
| Not Started | Test course search and selection | N/A | 10/12/2026 | Verify searches, details, missing information, and manual entry. |
| Not Started | Test grade management and saving | N/A | 10/12/2026 | Verify adding, editing, deleting, multiple semesters, and persistence after refreshing. |
| Not Started | Test GPA and what-if calculations | N/A | 10/12/2026 | Check mixed grades, excluded grades, empty records, CGPA, and scenario reset. |
| Not Started | Review mobile layout and accessibility | N/A | 10/12/2026 | Check readable results, labeled inputs, keyboard access, and phone-sized layouts. |
| Not Started | Review PRs and fix integration issues | N/A | 10/12/2026 | Have another contributor review changes and resolve blockers before merging. |
| Not Started | Prepare the final demo | N/A | 10/12/2026 | Demonstrate course selection, saving, semester GPA, CGPA, and what-if grades. |

## Calculation Requirements

- Quality points = grade-point value × course units.
- Semester GPA = semester quality points ÷ included GPA units.
- CGPA = total quality points ÷ total included GPA units.
- Use the verified SJSU grade scale, including plus/minus grades and exclusions.
- Keep full precision internally; display two decimal places.
- Show `N/A` when there are no included GPA units.
- Use the same calculation engine for saved grades and scenarios.

## Acceptance Checks

- [ ] Course search, available details, and manual entry work.
- [ ] Students can manage grades across multiple semesters.
- [ ] Saved records remain after refreshing.
- [ ] Adding, editing, or deleting records updates GPA results.
- [ ] 3 units of A, 4 units of B+, and 3 units of C produce **3.12 GPA**.
- [ ] A 3-unit A semester and a 1-unit B semester produce **3.75 CGPA**.
- [ ] All A grades produce **4.00**; all F grades produce **0.00**.
- [ ] Empty records display `N/A`.
- [ ] What-if changes do not modify saved grades.
- [ ] The app works on desktop and mobile.

## Optional Stretch Goals

Start only after the core acceptance checks pass.

| Status | Feature | Owner | Due Date | Scope |
| --- | --- | --- | --- | --- |
| Not Started | Transcript import | N/A | 10/12/2026 | Parse one agreed text-based transcript format; preview and correct records before saving. |
| Not Started | Canvas grade import | N/A | 10/12/2026 | With authorized API access, fetch visible grades and review course and grade mappings before importing. |

## Coordination and Team Updates

- Assign tasks individually as contributors become available.
- Coordinate before changing shared components or data formats.
- Use shared sample data while dependent services are being built.
- Keep PRs focused and include a short explanation of the change.
- Update task ownership when someone joins, leaves, or hands off work.
- Add a PR link when available and report blockers immediately.

**Statuses:** `Not Started`, `In Progress`, `Blocked`, `Completed`

## Definition of Done

- [ ] Core user stories and acceptance checks are complete.
- [ ] Code is reviewed and merged.
- [ ] The application builds and the demo works.
- [ ] No known blockers cause incorrect GPA results or lost saved grades.
- [ ] Unfinished stretch goals are clearly marked.
