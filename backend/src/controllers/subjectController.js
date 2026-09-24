import Subject from "../models/Subject.js";

// =====================================================
// CREATE SUBJECT
// =====================================================

export const createSubject = async (req, res) => {
  try {
    const { code, name, semester, department } = req.body;

    if (!code || !name || !semester || !department) {
      return res.status(400).json({
        success: false,
        message: "Code, name, semester and department are required.",
      });
    }

    const normalizedCode = code.trim().toUpperCase();
    const normalizedDepartment = department.trim().toLowerCase();

    const existing = await Subject.findOne({
      code: normalizedCode,
      department: normalizedDepartment,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Subject code "${normalizedCode}" already exists for department "${normalizedDepartment}".`,
      });
    }

    const subject = await Subject.create({
      code: normalizedCode,
      name: name.trim(),
      semester: Number(semester),
      department: normalizedDepartment,
    });

    res.status(201).json({
      success: true,
      data: subject,
      message: "Subject created successfully.",
    });
  } catch (err) {
    console.error("Create Subject Error:", err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// =====================================================
// GET ALL SUBJECTS
// =====================================================

export const getSubjects = async (req, res) => {
  try {
    let filter = {};

    // Current authenticateUser middleware puts
    // role and department directly inside req.user.
    const role = req.user?.role;
    const hodDept = req.user?.department;

    // HOD can see only their department.
    // Science & English is allowed to see all departments
    // according to the existing project rule.
    if (
      role === "hod" &&
      hodDept &&
      hodDept.toLowerCase() !== "sc"
    ) {
      filter.department = hodDept.toLowerCase();
    }

    // Optional department filter
    if (req.query.department) {
      filter.department = req.query.department
        .trim()
        .toLowerCase();
    }

    // Optional semester filter
    if (req.query.semester) {
      filter.semester = Number(req.query.semester);
    }

    const subjects = await Subject.find(filter).sort({
      semester: 1,
      code: 1,
    });

    res.json({
      success: true,
      data: subjects,
    });
  } catch (err) {
    console.error("Get Subjects Error:", err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// =====================================================
// GET SINGLE SUBJECT
// =====================================================

export const getSubjectById = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: "Subject not found.",
      });
    }

    res.json({
      success: true,
      data: subject,
    });
  } catch (err) {
    console.error("Get Subject Error:", err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// =====================================================
// UPDATE SUBJECT
// =====================================================

export const updateSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, semester, department } = req.body;

    if (!code || !name || !semester || !department) {
      return res.status(400).json({
        success: false,
        message: "Code, name, semester and department are required.",
      });
    }

    const normalizedCode = code.trim().toUpperCase();
    const normalizedDepartment = department.trim().toLowerCase();

    // Check duplicate excluding current subject
    const existing = await Subject.findOne({
      code: normalizedCode,
      department: normalizedDepartment,
      _id: { $ne: id },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Subject code "${normalizedCode}" already exists for department "${normalizedDepartment}".`,
      });
    }

    const subject = await Subject.findByIdAndUpdate(
      id,
      {
        code: normalizedCode,
        name: name.trim(),
        semester: Number(semester),
        department: normalizedDepartment,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: "Subject not found.",
      });
    }

    res.json({
      success: true,
      data: subject,
      message: "Subject updated successfully.",
    });
  } catch (err) {
    console.error("Update Subject Error:", err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// =====================================================
// DELETE SUBJECT
// =====================================================

export const deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;

    const subject = await Subject.findByIdAndDelete(id);

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: "Subject not found.",
      });
    }

    res.json({
      success: true,
      message: "Subject deleted successfully.",
    });
  } catch (err) {
    console.error("Delete Subject Error:", err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// =====================================================
// BULK UPLOAD SUBJECTS
// =====================================================

export const bulkUploadSubjects = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a CSV file.",
      });
    }

    const { parse } = await import("csv-parse/sync");

    const csvText = req.file.buffer.toString("utf-8");

    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });

    if (!records.length) {
      return res.status(400).json({
        success: false,
        message: "The uploaded CSV file is empty.",
      });
    }

    const validSubjects = [];
    const errors = [];

    // Track duplicates inside the uploaded file itself.
    const uploadedKeys = new Set();

    // Valid department codes based on your project.
    const validDepartments = new Set([
      "at",
      "ch",
      "ce",
      "cs",
      "ec",
      "ee",
      "me",
      "ps",
      "sc",
    ]);

    for (let index = 0; index < records.length; index++) {
      const row = records[index];

      const rowNumber = index + 2;

      const code = String(row.code || "")
        .trim()
        .toUpperCase();

      const name = String(row.name || "").trim();

      const semester = Number(row.semester);

      const department = String(row.department || "")
        .trim()
        .toLowerCase();

      // ---------------------------------------
      // Validate required fields
      // ---------------------------------------

      if (!code || !name || !row.semester || !department) {
        errors.push({
          row: rowNumber,
          message:
            "Code, name, semester and department are required.",
        });

        continue;
      }

      // ---------------------------------------
      // Validate semester
      // ---------------------------------------

      if (
        !Number.isInteger(semester) ||
        semester < 1 ||
        semester > 8
      ) {
        errors.push({
          row: rowNumber,
          code,
          message: "Semester must be between 1 and 8.",
        });

        continue;
      }

      // ---------------------------------------
      // Validate department
      // ---------------------------------------

      if (!validDepartments.has(department)) {
        errors.push({
          row: rowNumber,
          code,
          department,
          message: `Invalid department "${department}".`,
        });

        continue;
      }

      // ---------------------------------------
      // Check duplicate inside CSV
      // ---------------------------------------

      const key = `${code}|${department}`;

      if (uploadedKeys.has(key)) {
        errors.push({
          row: rowNumber,
          code,
          department,
          message:
            "Duplicate subject code and department in uploaded file.",
        });

        continue;
      }

      uploadedKeys.add(key);

      validSubjects.push({
        code,
        name,
        semester,
        department,
      });
    }

    // ---------------------------------------
    // Check existing database records
    // ---------------------------------------

    const existingSubjects = await Subject.find({
      $or: validSubjects.map((subject) => ({
        code: subject.code,
        department: subject.department,
      })),
    }).lean();

    const existingKeys = new Set(
      existingSubjects.map(
        (subject) =>
          `${subject.code}|${subject.department}`
      )
    );

    const subjectsToInsert = [];

    for (const subject of validSubjects) {
      const key = `${subject.code}|${subject.department}`;

      if (existingKeys.has(key)) {
        errors.push({
          code: subject.code,
          department: subject.department,
          message:
            "Subject already exists in database.",
        });

        continue;
      }

      subjectsToInsert.push(subject);
    }

    // ---------------------------------------
    // Insert valid subjects
    // ---------------------------------------

    let insertedSubjects = [];

    if (subjectsToInsert.length > 0) {
      insertedSubjects = await Subject.insertMany(
        subjectsToInsert,
        {
          ordered: false,
        }
      );
    }

    // ---------------------------------------
    // Response
    // ---------------------------------------

    return res.status(201).json({
      success: true,

      message: `Bulk upload completed. ${insertedSubjects.length} subject(s) added.`,

      summary: {
        totalRows: records.length,
        inserted: insertedSubjects.length,
        failed: errors.length,
      },

      inserted: insertedSubjects,

      errors,
    });
  } catch (err) {
    console.error("Bulk Subject Upload Error:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};