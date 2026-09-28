import FinalIA from "../models/FinalIA.js";
import Student from "../models/Student.js";
import Subject from "../models/Subject.js";

// =====================================================
// HELPERS
// =====================================================

const getUserRole = (req) => {
  return String(req.user?.role || "")
    .trim()
    .toLowerCase();
};

const getUserDepartment = (req) => {
  return String(req.user?.department || "")
    .trim()
    .toLowerCase();
};

const getUserClerkId = (req) => {
  return String(req.user?.clerkId || "").trim();
};

// =====================================================
// PREPARE FINAL IA
// =====================================================

export const prepareFinalIA = async (req, res) => {
  try {
    const {
      academicYear,
      semester,
      batch,
    } = req.query;

    const role = getUserRole(req);

    // -------------------------------------------------
    // ONLY HOD
    // -------------------------------------------------

    if (role !== "hod") {
      return res.status(403).json({
        success: false,
        message: "Only HOD can enter Final IA.",
      });
    }

    // -------------------------------------------------
    // VALIDATE INPUT
    // -------------------------------------------------

    if (!academicYear || !semester || !batch) {
      return res.status(400).json({
        success: false,
        message:
          "Academic year, semester and batch are required.",
      });
    }

    // -------------------------------------------------
    // HOD DEPARTMENT
    // -------------------------------------------------

    const normalizedDepartment =
      getUserDepartment(req);

    if (!normalizedDepartment) {
      return res.status(403).json({
        success: false,
        message:
          "HOD department is not assigned.",
      });
    }

    const semesterNumber = Number(semester);

    if (
      !Number.isInteger(semesterNumber) ||
      semesterNumber < 1 ||
      semesterNumber > 6
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid semester.",
      });
    }

    const normalizedBatch =
      String(batch).trim();

    const normalizedAcademicYear =
      String(academicYear).trim();

    // -------------------------------------------------
    // FETCH STUDENTS
    // -------------------------------------------------

    const students = await Student.find({
      department: normalizedDepartment,
      semester: semesterNumber,
      batch: normalizedBatch,
      status: "active",
    })
      .select(
        "_id registerNumber name fatherName phone imageUrl batch batchNumber semester department"
      )
      .sort({
        name: 1,
        fatherName: 1,
      })
      .lean();

    // -------------------------------------------------
    // FETCH SUBJECTS
    //
    // IMPORTANT:
    // Semester + HOD Department
    // -------------------------------------------------

    const subjects = await Subject.find({
      semester: semesterNumber,
      department: normalizedDepartment,
    })
      .select(
        "_id code name semester department"
      )
      .sort({
        code: 1,
      })
      .lean();

    // -------------------------------------------------
    // FIND EXISTING RECORD
    // -------------------------------------------------

    const existing =
      await FinalIA.findOne({
        academicYear:
          normalizedAcademicYear,

        department:
          normalizedDepartment,

        semester:
          semesterNumber,

        batch:
          normalizedBatch,
      }).lean();

    // -------------------------------------------------
    // SUBJECT RESPONSE
    // -------------------------------------------------

    const responseSubjects =
      subjects.map((subject) => {
        const existingSubject =
          existing?.subjects?.find(
            (item) =>
              String(item.subjectId) ===
              String(subject._id)
          );

        return {
          subjectId: subject._id,
          code: subject.code,
          name: subject.name,
          department: subject.department,

          maxMarks:
            existingSubject?.maxMarks ??
            null,
        };
      });

    // -------------------------------------------------
    // STUDENT RESPONSE
    // -------------------------------------------------

    const responseStudents =
      students.map((student) => {
        const existingStudent =
          existing?.students?.find(
            (item) =>
              String(item.studentId) ===
              String(student._id)
          );

        const marks =
          responseSubjects.map(
            (subject) => {
              const existingMark =
                existingStudent?.marks?.find(
                  (item) =>
                    String(
                      item.subjectId
                    ) ===
                    String(
                      subject.subjectId
                    )
                );

              return {
                subjectId:
                  subject.subjectId,

                marks:
                  existingMark?.marks ??
                  null,
              };
            }
          );

        return {
          studentId:
            student._id,

          registerNumber:
            student.registerNumber,

          studentName:
            student.name,

          fatherName:
            student.fatherName,

          phone:
            student.phone || "",

          imageUrl:
            student.imageUrl || "",

          marks,
        };
      });

    // -------------------------------------------------
    // RESPONSE
    // -------------------------------------------------

    return res.status(200).json({
      success: true,

      data: {
        academicYear:
          normalizedAcademicYear,

        department:
          normalizedDepartment,

        semester:
          semesterNumber,

        batch:
          normalizedBatch,

        subjects:
          responseSubjects,

        students:
          responseStudents,

        status:
          existing?.status ||
          "draft",

        submittedAt:
          existing?.submittedAt ||
          null,

        confirmedAt:
          existing?.confirmedAt ||
          null,
      },
    });

  } catch (error) {
    console.error(
      "Prepare Final IA Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to prepare Final IA.",
      error: error.message,
    });
  }
};

// =====================================================
// SAVE FINAL IA
// =====================================================

export const saveFinalIA = async (
  req,
  res
) => {
  try {
    const role = getUserRole(req);

    // -------------------------------------------------
    // ONLY HOD
    // -------------------------------------------------

    if (role !== "hod") {
      return res.status(403).json({
        success: false,
        message:
          "Only HOD can save Final IA.",
      });
    }

    const {
      academicYear,
      semester,
      batch,
      subjects,
      students,
    } = req.body;

    // -------------------------------------------------
    // BASIC VALIDATION
    // -------------------------------------------------

    if (
      !academicYear ||
      !semester ||
      !batch
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Academic year, semester and batch are required.",
      });
    }

    if (!Array.isArray(subjects)) {
      return res.status(400).json({
        success: false,
        message:
          "Subjects must be an array.",
      });
    }

    if (!Array.isArray(students)) {
      return res.status(400).json({
        success: false,
        message:
          "Students must be an array.",
      });
    }

    // -------------------------------------------------
    // HOD DEPARTMENT
    // -------------------------------------------------

    const hodDepartment =
      getUserDepartment(req);

    if (!hodDepartment) {
      return res.status(403).json({
        success: false,
        message:
          "HOD department is not assigned.",
      });
    }

    const semesterNumber =
      Number(semester);

    const normalizedBatch =
      String(batch).trim();

    const normalizedAcademicYear =
      String(academicYear).trim();

    // -------------------------------------------------
    // CHECK EXISTING RECORD
    // -------------------------------------------------

    let record =
      await FinalIA.findOne({
        academicYear:
          normalizedAcademicYear,

        department:
          hodDepartment,

        semester:
          semesterNumber,

        batch:
          normalizedBatch,
      });

    // -------------------------------------------------
    // LOCK CHECK
    // -------------------------------------------------

    if (
      record &&
      record.status === "submitted"
    ) {
      return res.status(423).json({
        success: false,
        message:
          "Final IA has already been submitted and cannot be edited.",
      });
    }

    if (
      record &&
      record.status === "confirmed"
    ) {
      return res.status(423).json({
        success: false,
        message:
          "Final IA has already been confirmed and cannot be edited.",
      });
    }

    // -------------------------------------------------
    // VERIFY SUBJECTS
    //
    // IMPORTANT:
    // Both semester AND department are checked.
    // -------------------------------------------------

    const subjectIds =
      subjects.map(
        (subject) =>
          subject.subjectId
      );

    const dbSubjects =
      await Subject.find({
        _id: {
          $in: subjectIds,
        },

        semester:
          semesterNumber,

        department:
          hodDepartment,
      })
        .select(
          "_id code name semester department"
        )
        .lean();

    if (
      dbSubjects.length !==
      subjects.length
    ) {
      return res.status(400).json({
        success: false,
        message:
          "One or more subjects are invalid for this HOD department or selected semester.",
      });
    }

    // -------------------------------------------------
    // PROCESS SUBJECTS
    // -------------------------------------------------

    const processedSubjects = [];

    for (
      const inputSubject of subjects
    ) {
      const dbSubject =
        dbSubjects.find(
          (subject) =>
            String(subject._id) ===
            String(
              inputSubject.subjectId
            )
        );

      if (!dbSubject) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid subject found.",
        });
      }

      const maxMarks =
        inputSubject.maxMarks === "" ||
        inputSubject.maxMarks === null ||
        inputSubject.maxMarks ===
          undefined
          ? null
          : Number(
              inputSubject.maxMarks
            );

      // Maximum mark is required

      if (
        maxMarks === null ||
        !Number.isFinite(maxMarks) ||
        maxMarks <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Maximum IA marks are required for ${dbSubject.code}.`,
        });
      }

      processedSubjects.push({
        subjectId:
          dbSubject._id,

        code:
          dbSubject.code,

        name:
          dbSubject.name,

        maxMarks,
      });
    }

    // -------------------------------------------------
    // FETCH VALID STUDENTS
    //
    // HOD can only save students belonging to:
    // - HOD department
    // - Selected semester
    // - Selected batch
    // - Active status
    // -------------------------------------------------

    const studentIds =
      students.map(
        (student) =>
          student.studentId
      );

    const dbStudents =
      await Student.find({
        _id: {
          $in: studentIds,
        },

        department:
          hodDepartment,

        semester:
          semesterNumber,

        batch:
          normalizedBatch,

        status:
          "active",
      })
        .select(
          "_id registerNumber name fatherName"
        )
        .lean();

    if (
      dbStudents.length !==
      students.length
    ) {
      return res.status(400).json({
        success: false,
        message:
          "One or more students are invalid for this HOD, semester or batch.",
      });
    }

    // -------------------------------------------------
    // PROCESS STUDENTS
    // -------------------------------------------------

    const processedStudents = [];

    for (
      const inputStudent of students
    ) {
      const dbStudent =
        dbStudents.find(
          (student) =>
            String(student._id) ===
            String(
              inputStudent.studentId
            )
        );

      if (!dbStudent) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid student found.",
        });
      }

      const processedMarks = [];

      for (
        const subject of
          processedSubjects
      ) {
        const inputMark =
          inputStudent.marks?.find(
            (item) =>
              String(
                item.subjectId
              ) ===
              String(
                subject.subjectId
              )
          );

        let marks = null;

        if (
          inputMark &&
          inputMark.marks !== "" &&
          inputMark.marks !== null &&
          inputMark.marks !==
            undefined
        ) {
          marks =
            Number(
              inputMark.marks
            );

          if (
            !Number.isFinite(
              marks
            )
          ) {
            return res.status(400).json({
              success: false,
              message:
                `Invalid IA mark for ${dbStudent.registerNumber} in ${subject.code}.`,
            });
          }

          if (marks < 0) {
            return res.status(400).json({
              success: false,
              message:
                `IA mark cannot be negative for ${dbStudent.registerNumber} in ${subject.code}.`,
            });
          }

          if (
            marks >
            subject.maxMarks
          ) {
            return res.status(400).json({
              success: false,
              message:
                `IA mark ${marks} exceeds maximum ${subject.maxMarks} for ${dbStudent.registerNumber} in ${subject.code}.`,
            });
          }
        }

        processedMarks.push({
          subjectId:
            subject.subjectId,

          marks,
        });
      }

      processedStudents.push({
        studentId:
          dbStudent._id,

        registerNumber:
          dbStudent.registerNumber,

        studentName:
          dbStudent.name,

        marks:
          processedMarks,
      });
    }

    // -------------------------------------------------
    // CREATE OR UPDATE
    // -------------------------------------------------

    if (!record) {
      record =
        new FinalIA({
          academicYear:
            normalizedAcademicYear,

          department:
            hodDepartment,

          semester:
            semesterNumber,

          batch:
            normalizedBatch,

          subjects:
            processedSubjects,

          students:
            processedStudents,

          status:
            "draft",
        });
    } else {
      record.subjects =
        processedSubjects;

      record.students =
        processedStudents;

      record.status =
        "draft";

      // Clear old submission information

      record.submittedBy =
        null;

      record.submittedAt =
        null;

      record.confirmedBy =
        null;

      record.confirmedAt =
        null;
    }

    await record.save();

    return res.status(200).json({
      success: true,

      message:
        "Final IA saved successfully.",

      data: record,
    });

  } catch (error) {
    console.error(
      "Save Final IA Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to save Final IA.",
      error: error.message,
    });
  }
};

// =====================================================
// GET SAVED FINAL IA
// =====================================================

export const getFinalIA = async (
  req,
  res
) => {
  try {
    const role =
      getUserRole(req);

    const {
      academicYear,
      semester,
      batch,
    } = req.query;

    if (
      !academicYear ||
      !semester ||
      !batch
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Academic year, semester and batch are required.",
      });
    }

    const filter = {
      academicYear:
        String(academicYear).trim(),

      semester:
        Number(semester),

      batch:
        String(batch).trim(),
    };

    // -------------------------------------------------
    // HOD → OWN DEPARTMENT ONLY
    // -------------------------------------------------

    if (role === "hod") {
      const hodDepartment =
        getUserDepartment(req);

      if (!hodDepartment) {
        return res.status(403).json({
          success: false,
          message:
            "HOD department is not assigned.",
        });
      }

      filter.department =
        hodDepartment;
    }

    // -------------------------------------------------
    // OTHER AUTHORIZED ROLES
    // -------------------------------------------------

    else if (
      ![
        "admin",
        "principal",
        "coe",
        "exam_officer",
      ].includes(role)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to view Final IA.",
      });
    }

    const record =
      await FinalIA.findOne(
        filter
      ).lean();

    if (!record) {
      return res.status(200).json({
        success: true,
        exists: false,
        data: null,
      });
    }

    return res.status(200).json({
      success: true,
      exists: true,
      data: record,
    });

  } catch (error) {
    console.error(
      "Get Final IA Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch Final IA.",
      error: error.message,
    });
  }
};

// =====================================================
// SUBMIT FINAL IA
// =====================================================

export const submitFinalIA = async (
  req,
  res
) => {
  try {
    const role =
      getUserRole(req);

    // -------------------------------------------------
    // ONLY HOD
    // -------------------------------------------------

    if (role !== "hod") {
      return res.status(403).json({
        success: false,
        message:
          "Only HOD can submit Final IA.",
      });
    }

    const {
      academicYear,
      semester,
      batch,
    } = req.body;

    if (
      !academicYear ||
      !semester ||
      !batch
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Academic year, semester and batch are required.",
      });
    }

    const hodDepartment =
      getUserDepartment(req);

    if (!hodDepartment) {
      return res.status(403).json({
        success: false,
        message:
          "HOD department is not assigned.",
      });
    }

    const record =
      await FinalIA.findOne({
        academicYear:
          String(
            academicYear
          ).trim(),

        department:
          hodDepartment,

        semester:
          Number(semester),

        batch:
          String(batch).trim(),
      });

    if (!record) {
      return res.status(404).json({
        success: false,
        message:
          "Final IA record not found.",
      });
    }

    // -------------------------------------------------
    // LOCK CHECK
    // -------------------------------------------------

    if (
      record.status ===
      "confirmed"
    ) {
      return res.status(423).json({
        success: false,
        message:
          "Final IA is already confirmed.",
      });
    }

    if (
      record.status ===
      "submitted"
    ) {
      return res.status(423).json({
        success: false,
        message:
          "Final IA is already submitted.",
      });
    }

    // -------------------------------------------------
    // CHECK MAX MARKS
    // -------------------------------------------------

    for (
      const subject of
        record.subjects
    ) {
      if (
        subject.maxMarks ===
          null ||
        subject.maxMarks ===
          undefined ||
        subject.maxMarks <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Maximum IA marks missing for ${subject.code}.`,
        });
      }
    }

    // -------------------------------------------------
    // CHECK ALL MARKS
    // -------------------------------------------------

    for (
      const student of
        record.students
    ) {
      for (
        const subject of
          record.subjects
      ) {
        const mark =
          student.marks.find(
            (item) =>
              String(
                item.subjectId
              ) ===
              String(
                subject.subjectId
              )
          );

        if (
          !mark ||
          mark.marks ===
            null ||
          mark.marks ===
            undefined
        ) {
          return res.status(400).json({
            success: false,
            message:
              `IA mark is missing for ${student.registerNumber} in ${subject.code}.`,
          });
        }

        if (
          mark.marks >
          subject.maxMarks
        ) {
          return res.status(400).json({
            success: false,
            message:
              `IA mark exceeds maximum for ${student.registerNumber} in ${subject.code}.`,
          });
        }
      }
    }

    // -------------------------------------------------
    // SUBMIT
    // -------------------------------------------------

    record.status =
      "submitted";

    record.submittedBy =
      getUserClerkId(req) ||
      "hod";

    record.submittedAt =
      new Date();

    await record.save();

    return res.status(200).json({
      success: true,

      message:
        "Final IA submitted successfully.",

      data: record,
    });

  } catch (error) {
    console.error(
      "Submit Final IA Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to submit Final IA.",
      error: error.message,
    });
  }
};



// =====================================================
// CONFIRM / FREEZE FINAL IA
// EXAM OFFICER ONLY
// =====================================================

export const confirmFinalIA = async (
  req,
  res
) => {
  try {
    const role =
      getUserRole(req);

    // -------------------------------------------------
    // ONLY EXAM OFFICER
    // -------------------------------------------------

    if (role !== "exam_officer") {
      return res.status(403).json({
        success: false,
        message:
          "Only Exam Officer can freeze Final IA.",
      });
    }

    const {
      academicYear,
      department,
      semester,
      batch,
    } = req.body;

    // -------------------------------------------------
    // VALIDATION
    // -------------------------------------------------

    if (
      !academicYear ||
      !department ||
      !semester ||
      !batch
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Academic year, department, semester and batch are required.",
      });
    }

    const normalizedDepartment =
      String(department)
        .trim()
        .toLowerCase();

    const normalizedAcademicYear =
      String(academicYear).trim();

    const normalizedBatch =
      String(batch).trim();

    const semesterNumber =
      Number(semester);

    // -------------------------------------------------
    // FIND RECORD
    // -------------------------------------------------

    const record =
      await FinalIA.findOne({
        academicYear:
          normalizedAcademicYear,

        department:
          normalizedDepartment,

        semester:
          semesterNumber,

        batch:
          normalizedBatch,
      });

    if (!record) {
      return res.status(404).json({
        success: false,
        message:
          "Final IA record not found.",
      });
    }

    // -------------------------------------------------
    // MUST BE SUBMITTED FIRST
    // -------------------------------------------------

    if (
      record.status ===
      "draft"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Final IA must be submitted by the HOD before it can be frozen.",
      });
    }

    // -------------------------------------------------
    // ALREADY CONFIRMED
    // -------------------------------------------------

    if (
      record.status ===
      "confirmed"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Final IA is already frozen.",
      });
    }

    // -------------------------------------------------
    // CONFIRM
    // -------------------------------------------------

    record.status =
      "confirmed";

    record.confirmedBy =
      getUserClerkId(req) ||
      "exam_officer";

    record.confirmedAt =
      new Date();

    await record.save();

    return res.status(200).json({
      success: true,

      message:
        "Final IA has been frozen successfully.",

      data: {
        status:
          record.status,

        confirmedAt:
          record.confirmedAt,
      },
    });
  } catch (error) {
    console.error(
      "Confirm Final IA Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to freeze Final IA.",
      error: error.message,
    });
  }
};