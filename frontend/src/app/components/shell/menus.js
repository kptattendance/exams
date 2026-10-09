// Navigation for every role.
//
//  pinned: true  -> also shown in the phone's bottom tab bar (max 4)
//  soon:   true  -> page not built yet; shown with a "Soon" tag, not clickable
//                   (remove `soon` when you create the page)

export const MENUS = {
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
          { label: "Users & roles", href: "/admin/users", icon: "users" },
          { label: "Login accounts", href: "/admin/clerk-users", icon: "key" },
        ],
      },
      {
        title: "Academics",
        items: [{ label: "Subjects", href: "/admin/subjects", icon: "subjects", pinned: true }],
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
          { label: "Bridge courses", href: "/coe/bridge-courses", icon: "bridge" },
        ],
      },
      {
        title: "Examination",
        items: [
          { label: "Examinations", href: "/coe/exams", icon: "paper", pinned: true },
          { label: "Fee verification", href: "/coe/fees", icon: "money" },
          { label: "Register numbers", href: "/coe/register-numbers", icon: "register" },
          { label: "Paper setting", href: "/coe/paper-setting", icon: "lock", pinned: true },
          { label: "Time table", href: "/coe/timetable", icon: "calendar" },
          { label: "Hall tickets", href: "/coe/hall-tickets", icon: "ticket" },
        ],
      },
      {
        title: "Marks & results",
        items: [
          { label: "IA marks", href: "/coe/ia-marks", icon: "marks", soon: true },
          { label: "Practical exam marks", href: "/coe/pactical-exam-marks", icon: "paper", soon: true },
          { label: "Valuation", href: "/coe/valuation", icon: "valuation", soon: true },
          { label: "Results", href: "/coe/results", icon: "results", soon: true },
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
        items: [
          { label: "Faculty", href: "/hod/faculty", icon: "faculty" },
          { label: "Subjects", href: "/hod/subjects", icon: "subjects" },
          { label: "Students", href: "/hod/students", icon: "students", pinned: true },
          { label: "Electives", href: "/hod/electives", icon: "layers" },
        ],
      },
      {
        title: "Academic records",
        items: [
          { label: "Final IA", href: "/hod/final-ia", icon: "marks", pinned: true },
          { label: "Final attendance", href: "/hod/attendance", icon: "attendance", pinned: true },
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

  examOfficer: {
    role: "Exam Officer",
    home: "/exam-officer",
    sections: [
      {
        title: "Overview",
        items: [{ label: "Dashboard", href: "/exam-officer", icon: "dashboard", pinned: true }],
      },
      {
        title: "Internal assessment",
        items: [
          { label: "Final IA", href: "/exam-officer/final-ia", icon: "marks", pinned: true },
          { label: "Final attendance", href: "/exam-officer/final-attendance", icon: "attendance", pinned: true },
        ],
      },
      {
        title: "Student eligibility",
        items: [
          { label: "Attendance shortage", href: "/exam-officer/attendance-shortage", icon: "attendance", soon: true },
          { label: "Fee status", href: "/exam-officer/fees", icon: "money" },
          { label: "Candidate list", href: "/exam-officer/candidates", icon: "list", soon: true },
        ],
      },
      {
        title: "Examination",
        items: [
          { label: "Examinations", href: "/exam-officer/examinations", icon: "paper" },
          { label: "Time table", href: "/exam-officer/timetable", icon: "calendar" },
          { label: "Subject-wise candidates", href: "/exam-officer/subjects", icon: "subjects", soon: true },
          { label: "Back paper candidates", href: "/exam-officer/back-papers", icon: "layers", soon: true },
          { label: "Hall tickets", href: "/exam-officer/hall-tickets", icon: "ticket" },
        ],
      },
      {
        title: "Results",
        items: [
          { label: "IA results", href: "/exam-officer/results/ia", icon: "results", soon: true },
          { label: "Examination results", href: "/exam-officer/results/examination", icon: "results", soon: true },
          { label: "Result processing", href: "/exam-officer/results/processing", icon: "cog", soon: true },
          { label: "Result reports", href: "/exam-officer/results/reports", icon: "report", soon: true },
        ],
      },
      {
        title: "Reports",
        items: [
          { label: "Eligibility report", href: "/exam-officer/reports/eligibility", icon: "shield", soon: true },
          { label: "Attendance report", href: "/exam-officer/reports/attendance", icon: "report", soon: true },
          { label: "Fee defaulter report", href: "/exam-officer/reports/fees", icon: "money", soon: true },
          { label: "Candidate reports", href: "/exam-officer/reports/candidates", icon: "report", soon: true },
        ],
      },
    ],
  },

  office: {
    role: "Office",
    home: "/office",
    sections: [
      {
        title: "Examination",
        items: [{ label: "Fee verification", href: "/office", icon: "money", pinned: true }],
      },
    ],
  },

  faculty: {
    role: "Faculty",
    home: "/faculty",
    sections: [
      {
        title: "My work",
        items: [{ label: "Paper setting", href: "/faculty", icon: "lock", pinned: true }],
      },
    ],
  },
};
