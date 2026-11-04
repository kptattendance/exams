// Navigation for every role.
//
//  pinned: true  -> also shown in the phone's bottom tab bar (max 4)
//  soon:   true  -> page not built yet; NOT shown in the sidebar
//                   (remove `soon` when you create the page)

// Where each role lands after signing in (see backend config/roles.js)
export const HOME_BY_ROLE = {
  admin: "/admin",
  principal: "/coe", // view only; the server refuses changes
  coe: "/coe",
  acoe: "/coe",
  office: "/office",
  exam_officer: "/office", // old name of office
  exam_clerk: "/clerk",
  qp_scrutinizer: "/scrutiny",
  chief_examiner: "/chief-examiner",
  hod: "/hod",
  evening_principal: "/evening",
  student: "/student", // only his own details
  staff: "/faculty",
};

export const MENUS = {
  // Evening Principal: HOD work for all evening students (register numbers 186…)
  evening: {
    role: "Evening Principal",
    home: "/evening",
    sections: [
      { title: "Overview", items: [{ label: "Start", href: "/evening", icon: "dashboard", pinned: true }] },
      { title: "Students", items: [{ label: "Students", href: "/evening/students", icon: "students", pinned: true }] },
      {
        title: "Academic records",
        items: [
          { label: "Final IA", href: "/evening/final-ia", icon: "marks", pinned: true },
          { label: "Final attendance", href: "/evening/attendance", icon: "attendance", pinned: true },
          { label: "Electives", href: "/evening/electives", icon: "layers" },
          { label: "Exam fee list", href: "/evening/exam-fees", icon: "money" },
        ],
      },
      {
        title: "Practical exams",
        items: [
          { label: "Practical batches & time table", href: "/evening/practical", icon: "calendar" },
          { label: "Track practical marks", href: "/evening/practical-marks", icon: "marks" },
        ],
      },
    ],
  },
  admin: {
    role: "Administrator",
    home: "/admin",
    sections: [
      {
        title: "Overview",
        items: [{ label: "Dashboard", href: "/admin", icon: "dashboard", pinned: true }],
      },
      {
        title: "People",
        items: [
          { label: "Faculty", href: "/admin/faculty", icon: "faculty", pinned: true },
          { label: "Students", href: "/admin/students", icon: "students", pinned: true },
          { label: "Import 1st-year students", href: "/admin/students/import", icon: "userPlus" },
          { label: "Import 2nd / 3rd-year students", href: "/admin/students/import-existing", icon: "userPlus" },
          { label: "Import old results", href: "/admin/results/import-old", icon: "results" },
          { label: "Users & roles", href: "/admin/users", icon: "users" },
          { label: "Login accounts", href: "/admin/clerk-users", icon: "key" },
        ],
      },
      {
        title: "Academics",
        items: [
          { label: "Subjects", href: "/admin/subjects", icon: "subjects", pinned: true },
          { label: "Bridge courses", href: "/admin/bridge-courses", icon: "bridge" },
          { label: "Practical marks corrections", href: "/admin/practical-marks", icon: "marks" },
          { label: "Final IA sheets", href: "/admin/final-ia", icon: "marks" },
          { label: "Final attendance sheets", href: "/admin/final-attendance", icon: "attendance" },
        ],
      },
      {
        title: "Administration",
        items: [{ label: "Settings", href: "/admin/settings", icon: "settings" }],
      },
    ],
  },

  coe: {
    role: "Controller of Examinations",
    home: "/coe",
    sections: [
      {
        title: "Overview",
        items: [{ label: "Dashboard", href: "/coe", icon: "dashboard", pinned: true }],
      },
      {
        title: "Master data",
        items: [
          { label: "Students", href: "/coe/students", icon: "students", pinned: true },
          { label: "Import 1st-year students", href: "/coe/students/import", icon: "userPlus" },
          { label: "Staff / Faculty", href: "/coe/faculty", icon: "faculty" },
          { label: "Subjects", href: "/coe/subjects", icon: "subjects" },
        ],
      },
      {
        title: "Examination",
        items: [
          { label: "Examinations", href: "/coe/exams", icon: "paper", pinned: true },
          { label: "Time table", href: "/coe/timetable", icon: "calendar" },
          { label: "Hall tickets", href: "/coe/hall-tickets", icon: "ticket" },
        ],
      },
      {
        title: "Theory exam",
        items: [
          { label: "Paper setting", href: "/coe/paper-setting", icon: "lock", pinned: true },
          { label: "Exam sessions (rooms & absentees)", href: "/coe/exam-sessions", icon: "list" },
          { label: "Valuation", href: "/coe/valuation", icon: "valuation" },
          { label: "Marks entry", href: "/coe/marks-entry", icon: "marks" },
        ],
      },
      {
        title: "Practical exam",
        items: [{ label: "Practical Examiners", href: "/coe/practical-exam-marks", icon: "paper" }],
      },
      {
        title: "Results",
        items: [
          { label: "IA marks", href: "/coe/ia-marks", icon: "marks", soon: true },
          { label: "Results", href: "/coe/results", icon: "results" },
        ],
      },
      {
        title: "Reports",
        items: [
          { label: "Examination reports", href: "/coe/reports/examinations", icon: "report", soon: true },
          { label: "Student reports", href: "/coe/reports/students", icon: "report", soon: true },
          { label: "Result reports", href: "/coe/reports/results", icon: "chart", soon: true },
        ],
      },
      {
        title: "Administration",
        items: [{ label: "COE settings", href: "/coe/settings", icon: "settings", soon: true }],
      },
    ],
  },

  hod: {
    role: "Head of Department",
    home: "/hod",
    sections: [
      {
        title: "Overview",
        items: [{ label: "Dashboard", href: "/hod", icon: "dashboard", pinned: true }],
      },
      {
        title: "Department",
        items: [{ label: "Students", href: "/hod/students", icon: "students", pinned: true }],
      },
      {
        title: "Academic records",
        items: [
          { label: "Final IA", href: "/hod/final-ia", icon: "marks", pinned: true },
          { label: "Final attendance", href: "/hod/attendance", icon: "attendance", pinned: true },
          { label: "Electives", href: "/hod/electives", icon: "layers" },
          { label: "Exam fee list", href: "/hod/exam-fees", icon: "money" },
        ],
      },
      {
        title: "Practical exams",
        items: [
          { label: "Practical batches & time table", href: "/hod/practical", icon: "calendar" },
          { label: "Track practical marks", href: "/hod/practical-marks", icon: "marks" },
        ],
      },
      {
        title: "Reports",
        items: [
          { label: "Faculty report", href: "/hod/reports/faculty", icon: "report", soon: true },
          { label: "Subject report", href: "/hod/reports/subjects", icon: "report", soon: true },
          { label: "Student report", href: "/hod/reports/students", icon: "report", soon: true },
          { label: "IA marks Excel", href: "/hod/reports/ia-marks", icon: "chart", soon: true },
          { label: "Attendance Excel", href: "/hod/reports/attendance", icon: "chart", soon: true },
        ],
      },
    ],
  },

  // Exam section (office): fees, IA / attendance freezing, hall tickets,
  // subject changes for hall tickets, absentees, paper-setter orders
  office: {
    role: "Exam section (office)",
    home: "/office",
    sections: [
      {
        title: "Overview",
        items: [{ label: "Dashboard", href: "/office", icon: "dashboard", pinned: true }],
      },
      {
        title: "Before the exam",
        items: [
          { label: "Fee verification", href: "/office/fees", icon: "money", pinned: true },
          { label: "Fee transactions", href: "/office/fees/transactions", icon: "report" },
          { label: "Final IA", href: "/office/final-ia", icon: "marks" },
          { label: "Final attendance", href: "/office/final-attendance", icon: "attendance" },
          { label: "Examinations", href: "/office/examinations", icon: "paper" },
          { label: "Time table", href: "/office/timetable", icon: "calendar" },
          { label: "Hall tickets", href: "/office/hall-tickets", icon: "ticket", pinned: true },
          { label: "Paper setter orders", href: "/office/paper-orders", icon: "report" },
        ],
      },
      {
        title: "Practical exam",
        items: [
          { label: "Room diary", href: "/office/practical/room-diary", icon: "list" },
          { label: "ML entry sheets", href: "/office/practical/mark-sheets", icon: "paper" },
          { label: "Marks status report", href: "/office/practical/report", icon: "chart" },
          { label: "Examiner orders", href: "/office/practical/orders", icon: "report" },
        ],
      },
      {
        title: "After the exam",
        items: [{ label: "Absentees & packets", href: "/office/valuation", icon: "valuation" }],
      },
      {
        title: "Reports",
        items: [
          { label: "Fee defaulter report", href: "/office/reports/fees", icon: "money", soon: true },
          { label: "Candidate reports", href: "/office/reports/candidates", icon: "report", soon: true },
        ],
      },
    ],
  },

  scrutiny: {
    role: "QP scrutiniser",
    home: "/scrutiny",
    sections: [
      {
        title: "Question papers",
        items: [{ label: "Papers to scrutinise", href: "/scrutiny", icon: "lock", pinned: true }],
      },
    ],
  },

  chiefExaminer: {
    role: "Chief Examiner",
    home: "/chief-examiner",
    sections: [
      {
        title: "Exam day",
        items: [
          { label: "Question papers today", href: "/chief-examiner", icon: "lock", pinned: true },
          { label: "Rooms & absentees", href: "/chief-examiner/sessions", icon: "list", pinned: true },
        ],
      },
    ],
  },

  clerk: {
    role: "Exam clerk",
    home: "/clerk",
    sections: [
      {
        title: "Valuation",
        items: [{ label: "Marks entry", href: "/clerk", icon: "marks", pinned: true }],
      },
    ],
  },

  faculty: {
    role: "Faculty",
    home: "/faculty",
    sections: [
      {
        title: "My work",
        items: [
          { label: "Paper setting", href: "/faculty", icon: "lock", pinned: true },
          { label: "Practical marks entry", href: "/faculty/practical", icon: "marks", pinned: true },
        ],
      },
    ],
  },
};
