import Subject from "../models/Subject.js";
import { parse } from "csv-parse/sync";

// =====================================================
// VALID DEPARTMENTS
// =====================================================

const VALID_DEPARTMENTS = [
  "AT",
  "CE",
  "CH",
  "CS",
  "EC",
  "EE",
  "ME",
  "PS",
  "SC",
];

// =====================================================
// HELPER FUNCTIONS
// =====================================================

const normalize = (value) => {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
};

const normalizeUpper = (value) => {
  return normalize(value).toUpperCase();
};

const toNumber = (value, defaultValue = 0) => {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const number = Number(value);

  return Number.isNaN(number) ? NaN : number;
};

// =====================================================
// VALIDATE SEQUENCE
//
// Expected:
//
// 1AT01
// 1AT02
// 3AT01
// 3CS05
// =====================================================

const isValidSequenceFormat = (sequence) => {
  return /^[1-8][A-Z]{2}\d{2}$/.test(sequence);
};

// =====================================================
// VALIDATE SEQUENCE AGAINST SEMESTER + DEPARTMENT
//
// Example:
//
// sequence = 3AT05
// semester = 3
// department = AT
//
// VALID
//
// sequence = 2AT05
// semester = 3
//
// INVALID
// =====================================================

const validateSequenceCombination = (
  sequence,
  semester,
  department
) => {
  if (!isValidSequenceFormat(sequence)) {
    return {
      valid: false,
      message:
        "Invalid sequence format. Expected format like 1AT01, 3AT01, 4CS05.",
    };
  }

  const sequenceSemester = Number(sequence.substring(0, 1));
  const sequenceDepartment = sequence.substring(1, 3);

  if (sequenceSemester !== Number(semester)) {
    return {
      valid: false,
      message: `Sequence ${sequence} does not belong to semester ${semester}.`,
    };
  }

  if (sequenceDepartment !== department) {
    return {
      valid: false,
      message: `Sequence ${sequence} does not belong to department ${department}.`,
    };
  }

  return {
    valid: true,
  };
};

// =====================================================
// VALIDATE SUBJECT CATEGORY
// =====================================================

const validateSubjectCategory = (
  subjectCategory,
  electiveGroup
) => {
  if (
    !["REGULAR", "ELECTIVE", "BRIDGE"].includes(
      subjectCategory
    )
  ) {
    return {
      valid: false,
      message:
        "subjectCategory must be REGULAR, ELECTIVE or BRIDGE.",
    };
  }

  // Elective MUST have an elective group
  if (
    subjectCategory === "ELECTIVE" &&
    !electiveGroup
  ) {
    return {
      valid: false,
      message:
        "Elective subject must have an electiveGroup.",
    };
  }

  // Regular and bridge subjects should not have
  // an elective group.
  if (
    subjectCategory !== "ELECTIVE" &&
    electiveGroup
  ) {
    return {
      valid: false,
      message:
        "electiveGroup should only be used for ELECTIVE subjects.",
    };
  }

  return {
    valid: true,
  };
};

// =====================================================
// CREATE SUBJECT
// =====================================================

export const createSubject = async (req, res) => {
  try {
    const {
      code,
      subjectId,
      name,
      sequence,
      semester,
      department,
      subjectCategory,
      electiveGroup,
      subjectType,
      board,
      iaMax,
      iaMin,
      theoryExamMax,
      theoryExamMin,
      practicalExamMax,
      practicalExamMin,
      totalMax,
      totalMin,
      credit,
      schemeYear,
    } = req.body;

    // -----------------------------------------------
    // NORMALIZE
    // -----------------------------------------------

    const normalizedCode = normalizeUpper(code);
    const normalizedSubjectId =
      normalizeUpper(subjectId);

    const normalizedName = normalize(name);

    const normalizedSequence =
      normalizeUpper(sequence);

    const normalizedDepartment =
      normalizeUpper(department);

    const normalizedSubjectCategory =
      normalizeUpper(subjectCategory || "REGULAR");

    const normalizedElectiveGroup =
      normalizeUpper(electiveGroup);

    const normalizedSubjectType =
      normalizeUpper(subjectType);

    const normalizedBoard =
      normalizeUpper(board);

    const normalizedSemester = Number(semester);

    // -----------------------------------------------
    // REQUIRED FIELDS
    // -----------------------------------------------

    if (!normalizedCode) {
      return res.status(400).json({
        message: "Subject code is required.",
      });
    }

    if (!normalizedSubjectId) {
      return res.status(400).json({
        message: "Subject ID is required.",
      });
    }

    if (!normalizedName) {
      return res.status(400).json({
        message: "Subject name is required.",
      });
    }

    if (!normalizedDepartment) {
      return res.status(400).json({
        message: "Department is required.",
      });
    }

    // -----------------------------------------------
    // DEPARTMENT
    // -----------------------------------------------

    if (
      !VALID_DEPARTMENTS.includes(
        normalizedDepartment
      )
    ) {
      return res.status(400).json({
        message: `Invalid department. Allowed departments: ${VALID_DEPARTMENTS.join(
          ", "
        )}`,
      });
    }

    // -----------------------------------------------
    // SEMESTER
    // -----------------------------------------------

    if (
      !Number.isInteger(normalizedSemester) ||
      normalizedSemester < 1 ||
      normalizedSemester > 8
    ) {
      return res.status(400).json({
        message: "Semester must be between 1 and 8.",
      });
    }

    // -----------------------------------------------
    // SEQUENCE
    // -----------------------------------------------

    const sequenceValidation =
      validateSequenceCombination(
        normalizedSequence,
        normalizedSemester,
        normalizedDepartment
      );

    if (!sequenceValidation.valid) {
      return res.status(400).json({
        message: sequenceValidation.message,
      });
    }

    // -----------------------------------------------
    // SUBJECT CATEGORY
    // -----------------------------------------------

    const categoryValidation =
      validateSubjectCategory(
        normalizedSubjectCategory,
        normalizedElectiveGroup
      );

    if (!categoryValidation.valid) {
      return res.status(400).json({
        message: categoryValidation.message,
      });
    }

    // -----------------------------------------------
    // NUMERIC VALUES
    // -----------------------------------------------

    const numericData = {
      iaMax: toNumber(iaMax),
      iaMin: toNumber(iaMin),
      theoryExamMax: toNumber(theoryExamMax),
      theoryExamMin: toNumber(theoryExamMin),
      practicalExamMax: toNumber(practicalExamMax),
      practicalExamMin: toNumber(practicalExamMin),
      totalMax: toNumber(totalMax),
      totalMin: toNumber(totalMin),
      credit: toNumber(credit),
      schemeYear: toNumber(schemeYear, 2025),
    };

    for (const [key, value] of Object.entries(
      numericData
    )) {
      if (Number.isNaN(value)) {
        return res.status(400).json({
          message: `${key} must be a valid number.`,
        });
      }
    }

    // -----------------------------------------------
    // CREATE
    // -----------------------------------------------

    const subject = await Subject.create({
      code: normalizedCode,
      subjectId: normalizedSubjectId,
      name: normalizedName,

      sequence: normalizedSequence,

      semester: normalizedSemester,
      department: normalizedDepartment,

      subjectCategory:
        normalizedSubjectCategory,

      electiveGroup:
        normalizedSubjectCategory === "ELECTIVE"
          ? normalizedElectiveGroup
          : null,

      subjectType: normalizedSubjectType,
      board: normalizedBoard,

      ...numericData,
    });

    return res.status(201).json({
      message: "Subject created successfully.",
      subject,
    });
  } catch (error) {
    console.error(
      "Create Subject Error:",
      error
    );

  if (error.code === 11000) {
  return res.status(400).json({
    message:
      "Duplicate subject. The same code, department, subject ID, semester and subject category already exists, or the sequence is already used.",
  });
}

    return res.status(500).json({
      message: "Failed to create subject.",
      error: error.message,
    });
  }
};

// =====================================================
// GET ALL SUBJECTS
// =====================================================

export const getSubjects = async (req, res) => {
  try {
    const {
      department,
      semester,
      subjectCategory,
      electiveGroup,
      schemeYear,
      search,
    } = req.query;

    const filter = {};

    if (department) {
      filter.department =
        normalizeUpper(department);
    }

    if (semester) {
      filter.semester = Number(semester);
    }

    if (subjectCategory) {
      filter.subjectCategory =
        normalizeUpper(subjectCategory);
    }

    if (electiveGroup) {
      filter.electiveGroup =
        normalizeUpper(electiveGroup);
    }

    if (schemeYear) {
      filter.schemeYear = Number(schemeYear);
    }

    if (search) {
      const searchValue = normalize(search);

      filter.$or = [
        {
          code: {
            $regex: searchValue,
            $options: "i",
          },
        },
        {
          subjectId: {
            $regex: searchValue,
            $options: "i",
          },
        },
        {
          name: {
            $regex: searchValue,
            $options: "i",
          },
        },
        {
          sequence: {
            $regex: searchValue,
            $options: "i",
          },
        },
      ];
    }

    const subjects = await Subject.find(filter)
      .sort({
        sequence: 1,
      })
      .lean();

    return res.status(200).json({
      count: subjects.length,
      subjects,
    });
  } catch (error) {
    console.error(
      "Get Subjects Error:",
      error
    );

    return res.status(500).json({
      message: "Failed to fetch subjects.",
      error: error.message,
    });
  }
};

// =====================================================
// GET SUBJECT BY ID
// =====================================================

export const getSubjectById = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    const subject = await Subject.findById(id);

    if (!subject) {
      return res.status(404).json({
        message: "Subject not found.",
      });
    }

    return res.status(200).json({
      subject,
    });
  } catch (error) {
    console.error(
      "Get Subject Error:",
      error
    );

    return res.status(500).json({
      message: "Failed to fetch subject.",
      error: error.message,
    });
  }
};

// =====================================================
// UPDATE SUBJECT
// =====================================================

export const updateSubject = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    const existingSubject =
      await Subject.findById(id);

    if (!existingSubject) {
      return res.status(404).json({
        message: "Subject not found.",
      });
    }

    const {
      code,
      subjectId,
      name,
      sequence,
      semester,
      department,
      subjectCategory,
      electiveGroup,
      subjectType,
      board,
      iaMax,
      iaMin,
      theoryExamMax,
      theoryExamMin,
      practicalExamMax,
      practicalExamMin,
      totalMax,
      totalMin,
      credit,
      schemeYear,
    } = req.body;

    const normalizedCode =
      code !== undefined
        ? normalizeUpper(code)
        : existingSubject.code;

    const normalizedSubjectId =
      subjectId !== undefined
        ? normalizeUpper(subjectId)
        : existingSubject.subjectId;

    const normalizedName =
      name !== undefined
        ? normalize(name)
        : existingSubject.name;

    const normalizedDepartment =
      department !== undefined
        ? normalizeUpper(department)
        : existingSubject.department;

    const normalizedSemester =
      semester !== undefined
        ? Number(semester)
        : existingSubject.semester;

    const normalizedSequence =
      sequence !== undefined
        ? normalizeUpper(sequence)
        : existingSubject.sequence;

    const normalizedCategory =
      subjectCategory !== undefined
        ? normalizeUpper(subjectCategory)
        : existingSubject.subjectCategory;

    const normalizedElectiveGroup =
      electiveGroup !== undefined
        ? normalizeUpper(electiveGroup)
        : existingSubject.electiveGroup;

    const normalizedSubjectType =
      subjectType !== undefined
        ? normalizeUpper(subjectType)
        : existingSubject.subjectType;

    const normalizedBoard =
      board !== undefined
        ? normalizeUpper(board)
        : existingSubject.board;

    // -----------------------------------------------
    // DEPARTMENT
    // -----------------------------------------------

    if (
      !VALID_DEPARTMENTS.includes(
        normalizedDepartment
      )
    ) {
      return res.status(400).json({
        message: `Invalid department. Allowed departments: ${VALID_DEPARTMENTS.join(
          ", "
        )}`,
      });
    }

    // -----------------------------------------------
    // SEMESTER
    // -----------------------------------------------

    if (
      !Number.isInteger(normalizedSemester) ||
      normalizedSemester < 1 ||
      normalizedSemester > 8
    ) {
      return res.status(400).json({
        message: "Semester must be between 1 and 8.",
      });
    }

    // -----------------------------------------------
    // SEQUENCE
    // -----------------------------------------------

    const sequenceValidation =
      validateSequenceCombination(
        normalizedSequence,
        normalizedSemester,
        normalizedDepartment
      );

    if (!sequenceValidation.valid) {
      return res.status(400).json({
        message: sequenceValidation.message,
      });
    }

    // -----------------------------------------------
    // CATEGORY
    // -----------------------------------------------

    const categoryValidation =
      validateSubjectCategory(
        normalizedCategory,
        normalizedElectiveGroup
      );

    if (!categoryValidation.valid) {
      return res.status(400).json({
        message: categoryValidation.message,
      });
    }

    // -----------------------------------------------
    // UPDATE
    // -----------------------------------------------

    const updateData = {
      code: normalizedCode,
      subjectId: normalizedSubjectId,
      name: normalizedName,

      sequence: normalizedSequence,

      semester: normalizedSemester,
      department: normalizedDepartment,

      subjectCategory: normalizedCategory,

      electiveGroup:
        normalizedCategory === "ELECTIVE"
          ? normalizedElectiveGroup
          : null,

      subjectType: normalizedSubjectType,
      board: normalizedBoard,
    };

    const numericFields = [
      "iaMax",
      "iaMin",
      "theoryExamMax",
      "theoryExamMin",
      "practicalExamMax",
      "practicalExamMin",
      "totalMax",
      "totalMin",
      "credit",
      "schemeYear",
    ];

    for (const field of numericFields) {
      if (req.body[field] !== undefined) {
        const value = toNumber(
          req.body[field]
        );

        if (Number.isNaN(value)) {
          return res.status(400).json({
            message: `${field} must be a valid number.`,
          });
        }

        updateData[field] = value;
      }
    }

    const subject =
      await Subject.findByIdAndUpdate(
        id,
        updateData,
        {
          new: true,
          runValidators: true,
        }
      );

    return res.status(200).json({
      message: "Subject updated successfully.",
      subject,
    });
  } catch (error) {
    console.error(
      "Update Subject Error:",
      error
    );
if (error.code === 11000) {
  return res.status(400).json({
    message:
      "Duplicate subject. The same code, department, subject ID, semester and subject category already exists, or the sequence is already used.",
  });
}

    return res.status(500).json({
      message: "Failed to update subject.",
      error: error.message,
    });
  }
};

// =====================================================
// DELETE SUBJECT
// =====================================================

export const deleteSubject = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    const subject =
      await Subject.findByIdAndDelete(id);

    if (!subject) {
      return res.status(404).json({
        message: "Subject not found.",
      });
    }

    return res.status(200).json({
      message: "Subject deleted successfully.",
    });
  } catch (error) {
    console.error(
      "Delete Subject Error:",
      error
    );

    return res.status(500).json({
      message: "Failed to delete subject.",
      error: error.message,
    });
  }
};

// =====================================================
// BULK UPLOAD SUBJECTS
// =====================================================

export const bulkUploadSubjects = async (
  req,
  res
) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "Please upload a CSV file.",
      });
    }

    const csvData =
      req.file.buffer.toString("utf-8");

    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });

    if (!records.length) {
      return res.status(400).json({
        message: "CSV file is empty.",
      });
    }

    const subjects = [];
    const errors = [];

    // Used for duplicate detection
    const uniqueSubjectKeys = new Set();
    const uniqueSequences = new Set();

    // -----------------------------------------------
    // PROCESS EACH ROW
    // -----------------------------------------------

    records.forEach((row, index) => {
      const rowNumber = index + 2;

      try {
        const code =
          normalizeUpper(row.code);

        const subjectId =
          normalizeUpper(row.subjectId);

        const name =
          normalize(row.name);

        const sequence =
          normalizeUpper(row.sequence);

        const department =
          normalizeUpper(row.department);

        const semester =
          Number(row.semester);

        const subjectCategory =
          normalizeUpper(
            row.subjectCategory || "REGULAR"
          );

        const electiveGroup =
          normalizeUpper(
            row.electiveGroup
          );

        const subjectType =
          normalizeUpper(row.subjectType);

        const board =
          normalizeUpper(row.board);

        // -------------------------------------------
        // REQUIRED
        // -------------------------------------------

        if (!code) {
          throw new Error(
            "Code is required."
          );
        }

        if (!subjectId) {
          throw new Error(
            "Subject ID is required."
          );
        }

        if (!name) {
          throw new Error(
            "Subject name is required."
          );
        }

        if (!department) {
          throw new Error(
            "Department is required."
          );
        }

        // -------------------------------------------
        // DEPARTMENT
        // -------------------------------------------

        if (
          !VALID_DEPARTMENTS.includes(
            department
          )
        ) {
          throw new Error(
            `Invalid department ${department}.`
          );
        }

        // -------------------------------------------
        // SEMESTER
        // -------------------------------------------

        if (
          !Number.isInteger(semester) ||
          semester < 1 ||
          semester > 8
        ) {
          throw new Error(
            "Semester must be between 1 and 8."
          );
        }

        // -------------------------------------------
        // SEQUENCE
        // -------------------------------------------

        const sequenceValidation =
          validateSequenceCombination(
            sequence,
            semester,
            department
          );

        if (!sequenceValidation.valid) {
          throw new Error(
            sequenceValidation.message
          );
        }

        // -------------------------------------------
        // CATEGORY
        // -------------------------------------------

        const categoryValidation =
          validateSubjectCategory(
            subjectCategory,
            electiveGroup
          );

        if (!categoryValidation.valid) {
          throw new Error(
            categoryValidation.message
          );
        }

        // -------------------------------------------
        // UNIQUE KEY
        // -------------------------------------------

   const subjectKey =
  `${department}|${code}|${subjectId}|${semester}|${subjectCategory}`;
if (uniqueSubjectKeys.has(subjectKey)) {
  throw new Error(
    `Duplicate subject in file: ${department} / ${code} / ${subjectId} / Semester ${semester} / ${subjectCategory}.`
  );
}

uniqueSubjectKeys.add(subjectKey);

        // -------------------------------------------
        // UNIQUE SEQUENCE
        // -------------------------------------------

        if (
          uniqueSequences.has(sequence)
        ) {
          throw new Error(
            `Duplicate sequence in file: ${sequence}.`
          );
        }

        uniqueSequences.add(sequence);

        // -------------------------------------------
        // NUMBERS
        // -------------------------------------------

        const numericData = {
          iaMax: toNumber(
            row.iaMax
          ),
          iaMin: toNumber(
            row.iaMin
          ),
          theoryExamMax: toNumber(
            row.theoryExamMax
          ),
          theoryExamMin: toNumber(
            row.theoryExamMin
          ),
          practicalExamMax: toNumber(
            row.practicalExamMax
          ),
          practicalExamMin: toNumber(
            row.practicalExamMin
          ),
          totalMax: toNumber(
            row.totalMax
          ),
          totalMin: toNumber(
            row.totalMin
          ),
          credit: toNumber(
            row.credit
          ),
          schemeYear: toNumber(
            row.schemeYear,
            2025
          ),
        };

        for (const [key, value] of Object.entries(
          numericData
        )) {
          if (Number.isNaN(value)) {
            throw new Error(
              `${key} must be a valid number.`
            );
          }
        }

        // -------------------------------------------
        // PUSH
        // -------------------------------------------

        subjects.push({
          code,
          subjectId,
          name,

          sequence,

          semester,
          department,

          subjectCategory,

          electiveGroup:
            subjectCategory === "ELECTIVE"
              ? electiveGroup
              : null,

          subjectType,
          board,

          ...numericData,
        });
      } catch (error) {
        errors.push({
          row: rowNumber,
          message: error.message,
        });
      }
    });

    // -----------------------------------------------
    // VALIDATION ERRORS
    // -----------------------------------------------

    if (errors.length > 0) {
      return res.status(400).json({
        message:
          "Bulk upload failed because some rows are invalid.",
        errors,
      });
    }

   const existingSubjects =
  await Subject.find({
    $or: subjects.map(
      (subject) => ({
        code: subject.code,
        department: subject.department,
        subjectId: subject.subjectId,
        semester: subject.semester,
        subjectCategory:
          subject.subjectCategory,
      })
    ),
  }).lean();

  if (existingSubjects.length > 0) {
  return res.status(400).json({
    message:
      "Some subjects already exist in the database.",
    duplicates:
      existingSubjects.map(
        (subject) => ({
          code: subject.code,
          subjectId:
            subject.subjectId,
          department:
            subject.department,
          semester:
            subject.semester,
          subjectCategory:
            subject.subjectCategory,
        })
      ),
  });
}

    // -----------------------------------------------
    // CHECK EXISTING SEQUENCES
    // -----------------------------------------------

    const existingSequences =
      await Subject.find({
        sequence: {
          $in: subjects.map(
            (subject) =>
              subject.sequence
          ),
        },
      }).lean();

    if (existingSequences.length > 0) {
      return res.status(400).json({
        message:
          "Some sequence numbers already exist in the database.",
        duplicates:
          existingSequences.map(
            (subject) => ({
              sequence:
                subject.sequence,
              subjectId:
                subject.subjectId,
              name: subject.name,
            })
          ),
      });
    }

    // -----------------------------------------------
    // INSERT
    // -----------------------------------------------

    const insertedSubjects =
      await Subject.insertMany(
        subjects
      );

    return res.status(201).json({
      message: `${insertedSubjects.length} subjects uploaded successfully.`,
      count: insertedSubjects.length,
      subjects: insertedSubjects,
    });
  }   catch (error) {
    console.error(
      "Bulk Upload Subjects Error:",
      error
    );

    if (error.code === 11000) {
      return res.status(400).json({
        message:
          "Duplicate subject or sequence detected.",
        error: error.message,
      });
    }

    return res.status(500).json({
      message:
        "Failed to upload subjects.",
      error: error.message,
    });
  }
};
