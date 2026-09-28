import FinalAttendance from "../models/FinalAttendance.js";
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
  return String(
    req.user?.clerkId || ""
  ).trim();
};

// =====================================================
// PREPARE ATTENDANCE
// =====================================================

export const prepareAttendance = async (
  req,
  res
) => {
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
        message:
          "Only HOD can enter attendance.",
      });
    }

    // -------------------------------------------------
    // VALIDATE
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

    if (
      !Number.isInteger(
        semesterNumber
      ) ||
      semesterNumber < 1 ||
      semesterNumber > 6
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid semester.",
      });
    }

    const normalizedAcademicYear =
      String(academicYear).trim();

    const normalizedBatch =
      String(batch).trim();

    // =================================================
    // STUDENTS
    // =================================================

    const students =
      await Student.find({
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
          "_id registerNumber name fatherName phone imageUrl department semester batch"
        )
        .sort({
          name: 1,
          fatherName: 1,
        })
        .lean();

    // =================================================
    // SUBJECTS
    //
    // IMPORTANT:
    // HOD DEPARTMENT + SEMESTER
    // =================================================

    const subjects =
      await Subject.find({
        department:
          hodDepartment,

        semester:
          semesterNumber,
      })
        .select(
          "_id code name department semester"
        )
        .sort({
          code: 1,
        })
        .lean();

    // =================================================
    // EXISTING RECORD
    // =================================================

    const existing =
      await FinalAttendance.findOne({
        academicYear:
          normalizedAcademicYear,

        department:
          hodDepartment,

        semester:
          semesterNumber,

        batch:
          normalizedBatch,
      }).lean();

    // =================================================
    // SUBJECT RESPONSE
    // =================================================

    const responseSubjects =
      subjects.map(
        (subject) => {
          const existingSubject =
            existing?.subjects?.find(
              (item) =>
                String(
                  item.subjectId
                ) ===
                String(
                  subject._id
                )
            );

          return {
            subjectId:
              subject._id,

            code:
              subject.code,

            name:
              subject.name,

            department:
              subject.department,

            maxClasses:
              existingSubject
                ?.maxClasses ??
              null,
          };
        }
      );

    // =================================================
    // STUDENT RESPONSE
    // =================================================

    const responseStudents =
      students.map(
        (student) => {
          const existingStudent =
            existing?.students?.find(
              (item) =>
                String(
                  item.studentId
                ) ===
                String(
                  student._id
                )
            );

          const attendance =
            responseSubjects.map(
              (subject) => {
                const existingAttendance =
                  existingStudent?.attendance?.find(
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

                  classesAttended:
                    existingAttendance
                      ?.classesAttended ??
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
              student.imageUrl ||
              "",

            attendance,
          };
        }
      );

    // =================================================
    // RESPONSE
    // =================================================

    return res.status(200).json({
      success: true,

      data: {
        academicYear:
          normalizedAcademicYear,

        department:
          hodDepartment,

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
      "Prepare Attendance Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to prepare attendance.",
      error: error.message,
    });
  }
};

// =====================================================
// SAVE ATTENDANCE
// =====================================================

export const saveAttendance = async (
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
          "Only HOD can save attendance.",
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

    const normalizedAcademicYear =
      String(
        academicYear
      ).trim();

    const normalizedBatch =
      String(batch).trim();

    // =================================================
    // EXISTING RECORD
    // =================================================

    let record =
      await FinalAttendance.findOne({
        academicYear:
          normalizedAcademicYear,

        department:
          hodDepartment,

        semester:
          semesterNumber,

        batch:
          normalizedBatch,
      });

    // =================================================
    // LOCK CHECK
    // =================================================

    if (
      record &&
      record.status ===
        "submitted"
    ) {
      return res.status(423).json({
        success: false,
        message:
          "Attendance has already been submitted and cannot be edited.",
      });
    }

    if (
      record &&
      record.status ===
        "confirmed"
    ) {
      return res.status(423).json({
        success: false,
        message:
          "Attendance has already been confirmed and cannot be edited.",
      });
    }

    // =================================================
    // VERIFY SUBJECTS
    //
    // Department + Semester
    // =================================================

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

        department:
          hodDepartment,

        semester:
          semesterNumber,
      })
        .select(
          "_id code name department semester"
        )
        .lean();

    if (
      dbSubjects.length !==
      subjects.length
    ) {
      return res.status(400).json({
        success: false,
        message:
          "One or more subjects are invalid for this HOD department or semester.",
      });
    }

    // =================================================
    // PROCESS SUBJECTS
    // =================================================

    const processedSubjects =
      [];

    for (
      const inputSubject of subjects
    ) {
      const dbSubject =
        dbSubjects.find(
          (subject) =>
            String(
              subject._id
            ) ===
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

      const maxClasses =
        inputSubject.maxClasses ===
          "" ||
        inputSubject.maxClasses ===
          null ||
        inputSubject.maxClasses ===
          undefined
          ? null
          : Number(
              inputSubject.maxClasses
            );

      // ------------------------------------------------
      // Maximum classes required
      // ------------------------------------------------

      if (
        maxClasses === null ||
        !Number.isFinite(
          maxClasses
        ) ||
        maxClasses <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Enter maximum classes for ${dbSubject.code}.`,
        });
      }

      processedSubjects.push({
        subjectId:
          dbSubject._id,

        code:
          dbSubject.code,

        name:
          dbSubject.name,

        maxClasses,
      });
    }

    // =================================================
    // VERIFY STUDENTS
    // =================================================

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

    // =================================================
    // PROCESS STUDENTS
    // =================================================

    const processedStudents =
      [];

    for (
      const inputStudent of students
    ) {
      const dbStudent =
        dbStudents.find(
          (student) =>
            String(
              student._id
            ) ===
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

      const processedAttendance =
        [];

      for (
        const subject of
          processedSubjects
      ) {
        const inputAttendance =
          inputStudent.attendance?.find(
            (item) =>
              String(
                item.subjectId
              ) ===
              String(
                subject.subjectId
              )
          );

        let classesAttended =
          null;

        if (
          inputAttendance &&
          inputAttendance.classesAttended !==
            "" &&
          inputAttendance.classesAttended !==
            null &&
          inputAttendance.classesAttended !==
            undefined
        ) {
          classesAttended =
            Number(
              inputAttendance.classesAttended
            );

          // --------------------------------------------
          // VALID NUMBER
          // --------------------------------------------

          if (
            !Number.isFinite(
              classesAttended
            )
          ) {
            return res.status(400).json({
              success: false,
              message:
                `Invalid attendance for ${dbStudent.registerNumber} in ${subject.code}.`,
            });
          }

          // --------------------------------------------
          // CANNOT BE NEGATIVE
          // --------------------------------------------

          if (
            classesAttended < 0
          ) {
            return res.status(400).json({
              success: false,
              message:
                `Classes attended cannot be negative for ${dbStudent.registerNumber} in ${subject.code}.`,
            });
          }

          // --------------------------------------------
          // CANNOT EXCEED MAXIMUM CLASSES
          // --------------------------------------------

          if (
            classesAttended >
            subject.maxClasses
          ) {
            return res.status(400).json({
              success: false,
              message:
                `Classes attended (${classesAttended}) cannot exceed maximum classes (${subject.maxClasses}) for ${dbStudent.registerNumber} in ${subject.code}.`,
            });
          }
        }

        processedAttendance.push({
          subjectId:
            subject.subjectId,

          classesAttended,
        });
      }

      processedStudents.push({
        studentId:
          dbStudent._id,

        registerNumber:
          dbStudent.registerNumber,

        studentName:
          dbStudent.name,

        attendance:
          processedAttendance,
      });
    }

    // =================================================
    // CREATE OR UPDATE
    // =================================================

    if (!record) {
      record =
        new FinalAttendance({
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
        "Attendance saved successfully.",

      data: record,
    });
  } catch (error) {
    console.error(
      "Save Attendance Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to save attendance.",
      error: error.message,
    });
  }
};

// =====================================================
// GET ATTENDANCE
// =====================================================

export const getAttendance = async (
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
        String(
          academicYear
        ).trim(),

      semester:
        Number(semester),

      batch:
        String(batch).trim(),
    };

    // =================================================
    // HOD
    // =================================================

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

    // =================================================
    // OTHER AUTHORIZED ROLES
    // =================================================

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
          "You do not have permission to view attendance.",
      });
    }

    // =================================================
    // FETCH
    // =================================================

    const record =
      await FinalAttendance.findOne(
        filter
      ).lean();

    if (!record) {
      return res.status(200).json({
        success: true,
        exists: false,
        data: null,
      });
    }

    // =================================================
    // CALCULATE PERCENTAGE
    //
    // Percentage is NOT stored in DB.
    // =================================================

    const responseStudents =
      record.students.map(
        (student) => {
          const attendance =
            student.attendance.map(
              (item) => {
                const subject =
                  record.subjects.find(
                    (subject) =>
                      String(
                        subject.subjectId
                      ) ===
                      String(
                        item.subjectId
                      )
                  );

                const maxClasses =
                  Number(
                    subject?.maxClasses
                  ) || 0;

                const attended =
                  item.classesAttended;

                let percentage = null;

                if (
                  maxClasses > 0 &&
                  attended !== null &&
                  attended !==
                    undefined
                ) {
                  percentage =
                    Number(
                      (
                        (Number(
                          attended
                        ) /
                          maxClasses) *
                        100
                      ).toFixed(2)
                    );
                }

                return {
                  subjectId:
                    item.subjectId,

                  classesAttended:
                    attended,

                  percentage,
                };
              }
            );

          return {
            ...student,
            attendance,
          };
        }
      );

    return res.status(200).json({
      success: true,

      exists: true,

      data: {
        ...record,

        students:
          responseStudents,
      },
    });
  } catch (error) {
    console.error(
      "Get Attendance Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch attendance.",
      error: error.message,
    });
  }
};

// =====================================================
// SUBMIT ATTENDANCE
// =====================================================

export const submitAttendance = async (
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
          "Only HOD can submit attendance.",
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

    // =================================================
    // FIND RECORD
    // =================================================

    const record =
      await FinalAttendance.findOne({
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
          "Attendance record not found.",
      });
    }

    // =================================================
    // LOCK
    // =================================================

    if (
      record.status ===
      "confirmed"
    ) {
      return res.status(423).json({
        success: false,
        message:
          "Attendance is already confirmed.",
      });
    }

    if (
      record.status ===
      "submitted"
    ) {
      return res.status(423).json({
        success: false,
        message:
          "Attendance is already submitted.",
      });
    }

    // =================================================
    // CHECK MAX CLASSES
    // =================================================

    for (
      const subject of
        record.subjects
    ) {
      if (
        subject.maxClasses ===
          null ||
        subject.maxClasses ===
          undefined ||
        subject.maxClasses <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Maximum classes missing for ${subject.code}.`,
        });
      }
    }

    // =================================================
    // CHECK ALL ATTENDANCE
    // =================================================

    for (
      const student of
        record.students
    ) {
      for (
        const subject of
          record.subjects
      ) {
        const attendance =
          student.attendance.find(
            (item) =>
              String(
                item.subjectId
              ) ===
              String(
                subject.subjectId
              )
          );

        if (
          !attendance ||
          attendance.classesAttended ===
            null ||
          attendance.classesAttended ===
            undefined
        ) {
          return res.status(400).json({
            success: false,
            message:
              `Attendance is missing for ${student.registerNumber} in ${subject.code}.`,
          });
        }

        if (
          attendance.classesAttended <
          0
        ) {
          return res.status(400).json({
            success: false,
            message:
              `Invalid attendance for ${student.registerNumber} in ${subject.code}.`,
          });
        }

        if (
          attendance.classesAttended >
          subject.maxClasses
        ) {
          return res.status(400).json({
            success: false,
            message:
              `Attendance exceeds maximum classes for ${student.registerNumber} in ${subject.code}.`,
          });
        }
      }
    }

    // =================================================
    // SUBMIT
    // =================================================

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
        "Attendance submitted successfully.",

      data: record,
    });
  } catch (error) {
    console.error(
      "Submit Attendance Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to submit attendance.",
      error: error.message,
    });
  }
};

// =====================================================
// CONFIRM / FREEZE ATTENDANCE
// EXAM OFFICER ONLY
// =====================================================

export const confirmAttendance = async (
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
          "Only Exam Officer can freeze attendance.",
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
      await FinalAttendance.findOne({
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
          "Attendance record not found.",
      });
    }

    // -------------------------------------------------
    // MUST BE SUBMITTED
    // -------------------------------------------------

    if (
      record.status ===
      "draft"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Attendance must be submitted by the HOD before it can be frozen.",
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
          "Attendance is already frozen.",
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
        "Attendance has been frozen successfully.",

      data: {
        status:
          record.status,

        confirmedAt:
          record.confirmedAt,
      },
    });
  } catch (error) {
    console.error(
      "Confirm Attendance Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to freeze attendance.",
      error: error.message,
    });
  }
};