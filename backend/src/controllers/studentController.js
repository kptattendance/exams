import Student from "../models/Student.js";
import { clerkClient } from "@clerk/express";
import cloudinary from "../config/cloudinary.js";

import XLSX from "xlsx";
import axios from "axios";

// =====================================================
// GOOGLE DRIVE FILE ID
// =====================================================

const getGoogleDriveFileId = (url) => {
  if (!url) return null;

  const value = String(url).trim();

  // https://drive.google.com/file/d/FILE_ID/view
  const fileMatch = value.match(
    /\/file\/d\/([a-zA-Z0-9_-]+)/
  );

  if (fileMatch) {
    return fileMatch[1];
  }

  // https://drive.google.com/open?id=FILE_ID
  // https://drive.google.com/uc?id=FILE_ID
  const idMatch = value.match(
    /[?&]id=([a-zA-Z0-9_-]+)/
  );

  if (idMatch) {
    return idMatch[1];
  }

  return null;
};


// =====================================================
// DOWNLOAD GOOGLE DRIVE IMAGE
// AND UPLOAD TO CLOUDINARY
// =====================================================

const uploadGoogleDrivePhoto = async (driveUrl) => {
  if (!driveUrl) {
    return {
      secure_url: "",
      public_id: "",
    };
  }

  const fileId = getGoogleDriveFileId(driveUrl);

  if (!fileId) {
    throw new Error(
      "Invalid Google Drive photo link."
    );
  }

  const downloadUrl =
    `https://drive.google.com/uc?export=download&id=${fileId}`;

  const response = await axios.get(
    downloadUrl,
    {
      responseType: "arraybuffer",
      timeout: 30000,
      maxContentLength: 10 * 1024 * 1024,
      maxBodyLength: 10 * 1024 * 1024,
    }
  );

  const contentType =
    response.headers["content-type"] || "";

  if (!contentType.startsWith("image/")) {
    throw new Error(
      "Google Drive file is not a valid image or is not publicly accessible."
    );
  }

  const base64 =
    Buffer.from(response.data).toString("base64");

  const dataUri =
    `data:${contentType};base64,${base64}`;

  const result =
    await cloudinary.uploader.upload(
      dataUri,
      {
        folder: "kpt-examination/students",
        resource_type: "image",
      }
    );

  return {
    secure_url: result.secure_url,
    public_id: result.public_id,
  };
};

// =====================================================
// BULK UPLOAD STUDENTS
// =====================================================
// Excel columns:
//
// RegisterNumber
// Name
// FatherName
// MotherName
// DOB
// Gender
// Email
// Phone
// ParentPhone
// Caste
// Category
// AadhaarNumber
// SATSNumber
// Department
// AdmissionYear
// Batch
// BatchNumber
// Semester
// Status
// Photo
//
// Photo = Google Drive sharing link
// =====================================================

export const bulkUploadStudents = async (
  req,
  res
) => {
  try {
    // =================================================
    // PERMISSION
    // =================================================

    const requesterRole = (
      req.user?.role || ""
    ).toLowerCase();

    const allowedRoles = [
      "admin",
      "principal",
      "coe",
      "exam_officer",
      "hod",
    ];

    if (!allowedRoles.includes(requesterRole)) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to bulk upload students.",
      });
    }

    // =================================================
    // FILE CHECK
    // =================================================

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message:
          "Please upload an Excel or CSV file.",
      });
    }

    // =================================================
    // READ EXCEL
    // =================================================

    const workbook = XLSX.read(
      req.file.buffer,
      {
        type: "buffer",
        cellDates: true,
      }
    );

    const sheetName =
      workbook.SheetNames[0];

    if (!sheetName) {
      return res.status(400).json({
        success: false,
        message:
          "The uploaded file contains no worksheet.",
      });
    }

    const worksheet =
      workbook.Sheets[sheetName];

    const rows =
      XLSX.utils.sheet_to_json(
        worksheet,
        {
          defval: "",
        }
      );

    if (!rows.length) {
      return res.status(400).json({
        success: false,
        message:
          "The uploaded file contains no student data.",
      });
    }

    // =================================================
    // LIMIT
    // =================================================

    if (rows.length > 5000) {
      return res.status(400).json({
        success: false,
        message:
          "Maximum 5000 students can be uploaded at once.",
      });
    }

    // =================================================
    // VALID DEPARTMENTS
    // =================================================

    const validDepartments = [
      "at",
      "ch",
      "ce",
      "cs",
      "ec",
      "ee",
      "me",
      "ps",
      "sc",
      "ot",
    ];

    // =================================================
    // VALID STATUS
    // =================================================

    const validStatuses = [
      "active",
      "inactive",
      "passed",
      "detained",
      "discontinued",
      "transferred",
    ];

    // =================================================
    // RESULT
    // =================================================

    const results = {
      total: rows.length,
      created: 0,
      failed: 0,
      errors: [],
      createdStudents: [],
    };

    // =================================================
    // DUPLICATES INSIDE EXCEL
    // =================================================

    const excelRegisterNumbers =
      new Set();

    const excelEmails =
      new Set();

    // =================================================
    // PROCESS EACH ROW
    // =================================================

    for (
      let i = 0;
      i < rows.length;
      i++
    ) {
      const row = rows[i];

      // Excel header starts at row 1
      // Therefore first data row = row 2
      const excelRow = i + 2;

      // =================================================
      // READ VALUES
      // =================================================

      const registerNumber =
        String(
          row.RegisterNumber ||
            row.registerNumber ||
            ""
        )
          .trim()
          .toUpperCase();

      const name =
        String(
          row.Name ||
            row.name ||
            ""
        ).trim();

      const fatherName =
        String(
          row.FatherName ||
            row.fatherName ||
            ""
        ).trim();

      const motherName =
        String(
          row.MotherName ||
            row.motherName ||
            ""
        ).trim();

      const email =
        String(
          row.Email ||
            row.email ||
            ""
        )
          .trim()
          .toLowerCase();

      const phone =
        String(
          row.Phone ||
            row.phone ||
            ""
        ).trim();

      const parentPhone =
        String(
          row.ParentPhone ||
            row.parentPhone ||
            ""
        ).trim();

      const caste =
        String(
          row.Caste ||
            row.caste ||
            ""
        ).trim();

      const category =
        String(
          row.Category ||
            row.category ||
            ""
        ).trim();

      const aadhaarNumber =
        String(
          row.AadhaarNumber ||
            row.aadhaarNumber ||
            ""
        ).trim();

      const satsNumber =
        String(
          row.SATSNumber ||
            row.satsNumber ||
            ""
        ).trim();

      const department =
        String(
          row.Department ||
            row.department ||
            ""
        )
          .trim()
          .toLowerCase();

      const batch =
        String(
          row.Batch ||
            row.batch ||
            ""
        ).trim();

      const gender =
        String(
          row.Gender ||
            row.gender ||
            ""
        )
          .trim()
          .toLowerCase();

      const status =
        String(
          row.Status ||
            row.status ||
            "active"
        )
          .trim()
          .toLowerCase();

      const photo =
        String(
          row.Photo ||
            row.photo ||
            ""
        ).trim();

      // =================================================
      // NUMERIC VALUES
      // =================================================

      const admissionYear =
        Number(
          row.AdmissionYear ??
            row.admissionYear
        );

      const batchNumber =
        Number(
          row.BatchNumber ??
            row.batchNumber
        );

      const semester =
        Number(
          row.Semester ??
            row.semester
        );

      // =================================================
      // DATE
      // =================================================

      let dobValue =
        row.DOB ??
        row.dob;

      let dobDate;

      if (dobValue instanceof Date) {
        dobDate = dobValue;
      } else {
        dobDate =
          new Date(
            String(
              dobValue || ""
            ).trim()
          );
      }

      // =================================================
      // VALIDATION
      // =================================================

      if (!registerNumber) {
        results.failed++;

        results.errors.push({
          row: excelRow,
          name,
          message:
            "Register number is required.",
        });

        continue;
      }

      if (!name) {
        results.failed++;

        results.errors.push({
          row: excelRow,
          registerNumber,
          message:
            "Name is required.",
        });

        continue;
      }

      if (!fatherName) {
        results.failed++;

        results.errors.push({
          row: excelRow,
          registerNumber,
          name,
          message:
            "Father name is required.",
        });

        continue;
      }

      if (!motherName) {
        results.failed++;

        results.errors.push({
          row: excelRow,
          registerNumber,
          name,
          message:
            "Mother name is required.",
        });

        continue;
      }

      if (!dobValue || Number.isNaN(dobDate.getTime())) {
        results.failed++;

        results.errors.push({
          row: excelRow,
          registerNumber,
          name,
          message:
            "Valid date of birth is required.",
        });

        continue;
      }

      if (
        !["male", "female", "other"].includes(
          gender
        )
      ) {
        results.failed++;

        results.errors.push({
          row: excelRow,
          registerNumber,
          name,
          message:
            "Gender must be male, female or other.",
        });

        continue;
      }

      if (!email) {
        results.failed++;

        results.errors.push({
          row: excelRow,
          registerNumber,
          name,
          message:
            "Email is required.",
        });

        continue;
      }

      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          email
        )
      ) {
        results.failed++;

        results.errors.push({
          row: excelRow,
          registerNumber,
          name,
          email,
          message:
            "Invalid email address.",
        });

        continue;
      }

      if (!/^\d{10}$/.test(phone)) {
        results.failed++;

        results.errors.push({
          row: excelRow,
          registerNumber,
          name,
          message:
            "Student phone number must contain exactly 10 digits.",
        });

        continue;
      }

      if (
        parentPhone &&
        !/^\d{10}$/.test(parentPhone)
      ) {
        results.failed++;

        results.errors.push({
          row: excelRow,
          registerNumber,
          name,
          message:
            "Parent phone number must contain exactly 10 digits.",
        });

        continue;
      }

      if (
        aadhaarNumber &&
        !/^\d{12}$/.test(
          aadhaarNumber
        )
      ) {
        results.failed++;

        results.errors.push({
          row: excelRow,
          registerNumber,
          name,
          message:
            "Aadhaar number must contain exactly 12 digits.",
        });

        continue;
      }

      if (
        !validDepartments.includes(
          department
        )
      ) {
        results.failed++;

        results.errors.push({
          row: excelRow,
          registerNumber,
          name,
          message:
            `Invalid department: ${department}`,
        });

        continue;
      }

      if (
        !Number.isInteger(
          admissionYear
        )
      ) {
        results.failed++;

        results.errors.push({
          row: excelRow,
          registerNumber,
          name,
          message:
            "Admission year is required.",
        });

        continue;
      }

      if (!batch) {
        results.failed++;

        results.errors.push({
          row: excelRow,
          registerNumber,
          name,
          message:
            "Batch is required.",
        });

        continue;
      }

      if (
        ![1, 2].includes(
          batchNumber
        )
      ) {
        results.failed++;

        results.errors.push({
          row: excelRow,
          registerNumber,
          name,
          message:
            "Batch number must be 1 or 2.",
        });

        continue;
      }

      if (
        !Number.isInteger(
          semester
        ) ||
        semester < 1 ||
        semester > 6
      ) {
        results.failed++;

        results.errors.push({
          row: excelRow,
          registerNumber,
          name,
          message:
            "Semester must be between 1 and 6.",
        });

        continue;
      }

      if (
        !validStatuses.includes(
          status
        )
      ) {
        results.failed++;

        results.errors.push({
          row: excelRow,
          registerNumber,
          name,
          message:
            `Invalid status: ${status}`,
        });

        continue;
      }

      // =================================================
      // DUPLICATE INSIDE EXCEL
      // =================================================

      if (
        excelRegisterNumbers.has(
          registerNumber
        )
      ) {
        results.failed++;

        results.errors.push({
          row: excelRow,
          registerNumber,
          name,
          message:
            "Duplicate register number found inside Excel file.",
        });

        continue;
      }

      if (
        excelEmails.has(email)
      ) {
        results.failed++;

        results.errors.push({
          row: excelRow,
          registerNumber,
          name,
          email,
          message:
            "Duplicate email found inside Excel file.",
        });

        continue;
      }

      excelRegisterNumbers.add(
        registerNumber
      );

      excelEmails.add(email);

      // =================================================
      // CHECK EXISTING MONGODB RECORDS
      // =================================================

      const existingRegister =
        await Student.findOne({
          registerNumber,
        });

      if (existingRegister) {
        results.failed++;

        results.errors.push({
          row: excelRow,
          registerNumber,
          name,
          message:
            "A student with this register number already exists.",
        });

        continue;
      }

      const existingEmail =
        await Student.findOne({
          email,
        });

      if (existingEmail) {
        results.failed++;

        results.errors.push({
          row: excelRow,
          registerNumber,
          name,
          email,
          message:
            "A student with this email already exists.",
        });

        continue;
      }

      // =================================================
      // CREATE RESOURCES
      // =================================================

      let clerkUser = null;
      let cloudinaryResult = null;

      try {
        // =============================================
        // PHOTO
        // =============================================

        if (photo) {
          cloudinaryResult =
            await uploadGoogleDrivePhoto(
              photo
            );
        }

        // =============================================
        // CLERK
        // =============================================

        clerkUser =
          await clerkClient.users.createUser(
            {
              emailAddress: [email],

              firstName: name,

              publicMetadata: {
                role: "student",
                department,
                registerNumber,
              },
            }
          );

        // =============================================
        // MONGODB
        // =============================================

        const student =
          new Student({
            clerkId:
              clerkUser.id,

            registerNumber,

            name,

            fatherName,

            motherName,

            dob: dobDate,

            gender,

            email,

            phone,

            parentPhone,

            caste,

            category,

            aadhaarNumber,

            satsNumber,

            department,

            admissionYear,

            batch,

            batchNumber,

            semester,

            status,

            role: "student",

            imageUrl:
              cloudinaryResult
                ?.secure_url || "",

            imagePublicId:
              cloudinaryResult
                ?.public_id || "",
          });

        await student.save();

        // =============================================
        // SUCCESS
        // =============================================

        results.created++;

        results.createdStudents.push({
          row: excelRow,
          registerNumber,
          name,
          email,
          department,
          clerkId:
            clerkUser.id,
        });

      } catch (error) {
        console.error(
          `Bulk student row ${excelRow} error:`,
          error
        );

        // =============================================
        // CLEANUP CLERK
        // =============================================

        if (clerkUser?.id) {
          try {
            await clerkClient.users.deleteUser(
              clerkUser.id
            );
          } catch (cleanupError) {
            console.error(
              "Clerk cleanup error:",
              cleanupError
            );
          }
        }

        // =============================================
        // CLEANUP CLOUDINARY
        // =============================================

        if (
          cloudinaryResult?.public_id
        ) {
          try {
            await cloudinary.uploader.destroy(
              cloudinaryResult.public_id
            );
          } catch (cleanupError) {
            console.error(
              "Cloudinary cleanup error:",
              cleanupError
            );
          }
        }

        results.failed++;

        results.errors.push({
          row: excelRow,
          registerNumber,
          name,
          email,
          message:
            error?.errors?.[0]?.message ||
            error?.message ||
            "Failed to create student.",
        });
      }
    }

    // =================================================
    // RESPONSE
    // =================================================

    return res.status(200).json({
      success: true,

      message:
        "Bulk student upload completed.",

      data: results,
    });

  } catch (error) {
    console.error(
      "Bulk Student Upload Error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        error?.message ||
        "Failed to process bulk student upload.",
    });
  }
};
// =====================================================
// CREATE STUDENT
// =====================================================

export const createStudent = async (req, res) => {
  let clerkUser = null;

  try {
    const requesterRole = (
      req.user?.role || ""
    ).toLowerCase();

    // -------------------------------------------------
    // ONLY AUTHORIZED USERS CAN CREATE STUDENTS
    // -------------------------------------------------

    const allowedRoles = [
      "admin",
      "principal",
      "coe",
      "exam_officer",
      "hod",
    ];

    if (!allowedRoles.includes(requesterRole)) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to create students.",
      });
    }

    // -------------------------------------------------
    // GET FORM DATA
    // -------------------------------------------------

    const {
      registerNumber,
      name,
      fatherName,
      motherName,
      dob,
      gender,

      email,
      phone,
      parentPhone,

      caste,
      category,

      aadhaarNumber,
      satsNumber,

      department,
      admissionYear,
      batch,
      batchNumber,
      semester,

      status,
    } = req.body;

    // -------------------------------------------------
    // REQUIRED FIELD VALIDATION
    // -------------------------------------------------

    const requiredFields = [
      ["registerNumber", registerNumber],
      ["name", name],
      ["fatherName", fatherName],
      ["motherName", motherName],
      ["dob", dob],
      ["gender", gender],
      ["email", email],
      ["phone", phone],
      ["department", department],
      ["admissionYear", admissionYear],
      ["batch", batch],
      ["batchNumber", batchNumber],
      ["semester", semester],
    ];

    for (const [field, value] of requiredFields) {
      if (
        value === undefined ||
        value === null ||
        String(value).trim() === ""
      ) {
        return res.status(400).json({
          success: false,
          message: `${field} is required.`,
        });
      }
    }

    // -------------------------------------------------
    // NORMALIZE VALUES
    // -------------------------------------------------

    const normalizedRegisterNumber =
      String(registerNumber)
        .trim()
        .toUpperCase();

    const normalizedEmail =
      String(email)
        .trim()
        .toLowerCase();

    const normalizedDepartment =
      String(department)
        .trim()
        .toLowerCase();

    const normalizedGender =
      String(gender)
        .trim()
        .toLowerCase();

    const normalizedStatus =
      String(status || "active")
        .trim()
        .toLowerCase();

    const normalizedSemester =
      Number(semester);

    const normalizedBatchNumber =
      Number(batchNumber);

    const normalizedAdmissionYear =
      Number(admissionYear);

    // -------------------------------------------------
    // GENDER VALIDATION
    // -------------------------------------------------

    if (
      !["male", "female", "other"].includes(
        normalizedGender
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid gender.",
      });
    }

    // -------------------------------------------------
    // SEMESTER VALIDATION
    // -------------------------------------------------

    if (
      !Number.isInteger(normalizedSemester) ||
      normalizedSemester < 1 ||
      normalizedSemester > 6
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Semester must be between 1 and 6.",
      });
    }

    // -------------------------------------------------
    // BATCH NUMBER VALIDATION
    // -------------------------------------------------

    if (![1, 2].includes(normalizedBatchNumber)) {
      return res.status(400).json({
        success: false,
        message:
          "Batch number must be either 1 or 2.",
      });
    }

    // -------------------------------------------------
    // STATUS VALIDATION
    // -------------------------------------------------

    const validStatuses = [
      "active",
      "inactive",
      "passed",
      "detained",
      "discontinued",
      "transferred",
    ];

    if (!validStatuses.includes(normalizedStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student status.",
      });
    }

    // -------------------------------------------------
    // DATE VALIDATION
    // -------------------------------------------------

    const dobDate = new Date(dob);

    if (Number.isNaN(dobDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date of birth.",
      });
    }

    // -------------------------------------------------
    // DUPLICATE REGISTER NUMBER
    // -------------------------------------------------

    const existingRegisterNumber =
      await Student.findOne({
        registerNumber:
          normalizedRegisterNumber,
      });

    if (existingRegisterNumber) {
      return res.status(409).json({
        success: false,
        message:
          "A student with this register number already exists.",
      });
    }

    // -------------------------------------------------
    // DUPLICATE EMAIL
    // -------------------------------------------------

    const existingEmail =
      await Student.findOne({
        email: normalizedEmail,
      });

    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message:
          "A student with this email already exists.",
      });
    }

    // -------------------------------------------------
    // DUPLICATE AADHAAR
    // -------------------------------------------------
    // Only check if supplied.
    // Aadhaar is NOT unique in the schema.

    if (
      aadhaarNumber &&
      String(aadhaarNumber).trim()
    ) {
      const normalizedAadhaar =
        String(aadhaarNumber).trim();

      if (!/^\d{12}$/.test(normalizedAadhaar)) {
        return res.status(400).json({
          success: false,
          message:
            "Aadhaar number must contain exactly 12 digits.",
        });
      }
    }

    // -------------------------------------------------
    // PHONE VALIDATION
    // -------------------------------------------------

    const normalizedPhone =
      String(phone).trim();

    if (!/^\d{10}$/.test(normalizedPhone)) {
      return res.status(400).json({
        success: false,
        message:
          "Student phone number must contain exactly 10 digits.",
      });
    }

    // -------------------------------------------------
    // PARENT PHONE VALIDATION
    // -------------------------------------------------

    const normalizedParentPhone =
      String(parentPhone || "").trim();

    if (
      normalizedParentPhone &&
      !/^\d{10}$/.test(
        normalizedParentPhone
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Parent phone number must contain exactly 10 digits.",
      });
    }

    // =================================================
    // CREATE CLERK ACCOUNT
    // =================================================

    clerkUser =
      await clerkClient.users.createUser({
        emailAddress: [
          normalizedEmail,
        ],

        firstName:
          String(name).trim(),

        publicMetadata: {
          role: "student",
          department:
            normalizedDepartment,
          registerNumber:
            normalizedRegisterNumber,
        },
      });

    // =================================================
    // CREATE MONGODB STUDENT
    // =================================================

    const student = new Student({
      clerkId: clerkUser.id,

      registerNumber:
        normalizedRegisterNumber,

      name:
        String(name).trim(),

      fatherName:
        String(fatherName).trim(),

      motherName:
        String(motherName).trim(),

      dob: dobDate,

      gender:
        normalizedGender,

      email:
        normalizedEmail,

      phone:
        normalizedPhone,

      parentPhone:
        normalizedParentPhone,

      caste:
        String(caste || "").trim(),

      category:
        String(category || "").trim(),

      aadhaarNumber:
        String(aadhaarNumber || "").trim(),

      satsNumber:
        String(satsNumber || "").trim(),

      department:
        normalizedDepartment,

      admissionYear:
        normalizedAdmissionYear,

      batch:
        String(batch).trim(),

      batchNumber:
        normalizedBatchNumber,

      semester:
        normalizedSemester,

      status:
        normalizedStatus,

      role: "student",

      imageUrl:
        req.cloudinaryResult
          ?.secure_url || "",

      imagePublicId:
        req.cloudinaryResult
          ?.public_id || "",
    });

    await student.save();

    // =================================================
    // SUCCESS
    // =================================================

    return res.status(201).json({
      success: true,

      message:
        "Student created successfully.",

      data: student,
    });

  } catch (error) {
    console.error(
      "Create Student Error:",
      error
    );

    // =================================================
    // CLEANUP CLERK IF MONGODB FAILED
    // =================================================

    if (clerkUser?.id) {
      try {
        await clerkClient.users.deleteUser(
          clerkUser.id
        );
      } catch (cleanupError) {
        console.error(
          "Clerk cleanup error:",
          cleanupError
        );
      }
    }

    // =================================================
    // DUPLICATE KEY
    // =================================================

    if (error?.code === 11000) {
      const duplicateField =
        Object.keys(
          error.keyPattern || {}
        )[0];

      return res.status(409).json({
        success: false,
        message:
          `A student with this ${duplicateField} already exists.`,
      });
    }

    // =================================================
    // RESPONSE
    // =================================================

    return res.status(500).json({
      success: false,
      message:
        error?.message ||
        "Failed to create student.",
    });
  }
};


// =====================================================
// GET ALL STUDENTS
// GET /api/students
// =====================================================
export const getStudents = async (req, res) => {
  try {
    const {
      search,
      department,
      semester,
      batch,
      admissionYear,
      status,
    } = req.query;

    const filter = {};

    // -----------------------------------------
    // Search
    // -----------------------------------------
    if (search?.trim()) {
      const regex = new RegExp(
        search.trim(),
        "i"
      );

      filter.$or = [
        { name: regex },
        { registerNumber: regex },
        { email: regex },
        { phone: regex },
        { satsNumber: regex },
      ];
    }

    // -----------------------------------------
    // Filters
    // -----------------------------------------
    if (department) {
      filter.department =
        department.toLowerCase();
    }

    if (semester) {
      filter.semester = Number(semester);
    }

    if (batch) {
      filter.batch = batch;
    }

    if (admissionYear) {
      filter.admissionYear =
        Number(admissionYear);
    }

    if (status) {
      filter.status = status;
    }

    const students = await Student.find(filter)
      .sort({
        department: 1,
        semester: 1,
        registerNumber: 1,
      })
      .lean();

    return res.status(200).json({
      success: true,
      count: students.length,
      data: students,
    });
  } catch (error) {
    console.error("Get students error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching students.",
      error: error.message,
    });
  }
};


// =====================================================
// GET ONE STUDENT
// GET /api/students/:id
// =====================================================
export const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;

    const student =
      await Student.findById(id).lean();

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: student,
    });
  } catch (error) {
    console.error(
      "Get student by ID error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error while fetching student.",
      error: error.message,
    });
  }
};


// =====================================================
// UPDATE STUDENT
// PUT /api/students/:id
//
// registerNumber and email CANNOT be changed.
// =====================================================
export const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;

    const student =
      await Student.findById(id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    // -----------------------------------------
    // ONLY THESE FIELDS CAN BE EDITED
    // -----------------------------------------
    const allowedFields = [
      "name",
      "fatherName",
      "motherName",
      "dob",
      "gender",
      "phone",
      "parentPhone",
      "caste",
      "category",
      "aadhaarNumber",
      "satsNumber",
      "department",
      "admissionYear",
      "batch",
      "batchNumber",
      "semester",
      "status",
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        student[field] = req.body[field];
      }
    }

    // -----------------------------------------
    // Ensure correct types
    // -----------------------------------------
    if (req.body.admissionYear !== undefined) {
      student.admissionYear =
        Number(req.body.admissionYear);
    }

    if (req.body.batchNumber !== undefined) {
      student.batchNumber =
        Number(req.body.batchNumber);
    }

    if (req.body.semester !== undefined) {
      student.semester =
        Number(req.body.semester);
    }

    if (req.body.department !== undefined) {
      student.department =
        req.body.department
          .trim()
          .toLowerCase();
    }

    if (req.body.gender !== undefined) {
      student.gender =
        req.body.gender
          .trim()
          .toLowerCase();
    }

    // -----------------------------------------
    // PHOTO
    // -----------------------------------------
    if (req.cloudinaryResult) {
      student.imageUrl =
        req.cloudinaryResult.secure_url;

      student.imagePublicId =
        req.cloudinaryResult.public_id;
    }

    // -----------------------------------------
    // Save MongoDB
    // -----------------------------------------
    await student.save();

    // -----------------------------------------
    // Update Clerk
    //
    // EMAIL IS NEVER UPDATED
    // -----------------------------------------
    try {
      await clerkClient.users.updateUser(
        student.clerkId,
        {
          firstName: student.name,

          publicMetadata: {
            role: "student",
            department: student.department,
            registerNumber:
              student.registerNumber,
          },
        }
      );
    } catch (clerkError) {
      console.error(
        "Clerk update warning:",
        clerkError
      );
    }

    return res.status(200).json({
      success: true,
      message: "Student updated successfully.",
      data: student,
    });
  } catch (error) {
    console.error(
      "Update student error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error while updating student.",
      error: error.message,
    });
  }
};


// =====================================================
// DELETE STUDENT
// DELETE /api/students/:id
// =====================================================
export const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;

    const student =
      await Student.findById(id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    // -----------------------------------------
    // Delete Clerk account
    // -----------------------------------------
    try {
      await clerkClient.users.deleteUser(
        student.clerkId
      );
    } catch (error) {
      console.error(
        "Clerk delete warning:",
        error
      );
    }

    // -----------------------------------------
    // Delete Cloudinary image
    // -----------------------------------------
    if (
      student.imagePublicId &&
      req.cloudinary?.uploader
    ) {
      try {
        await req.cloudinary.uploader.destroy(
          student.imagePublicId
        );
      } catch (error) {
        console.error(
          "Cloudinary delete warning:",
          error
        );
      }
    }

    // -----------------------------------------
    // Delete MongoDB record
    // -----------------------------------------
    await Student.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Student deleted successfully.",
    });
  } catch (error) {
    console.error(
      "Delete student error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error while deleting student.",
      error: error.message,
    });
  }
};


// =====================================================
// UPDATE STATUS
// PATCH /api/students/:id/status
// =====================================================
export const updateStudentStatus = async (
  req,
  res
) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = [
      "active",
      "inactive",
      "passed",
      "detained",
      "discontinued",
      "transferred",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student status.",
      });
    }

    const student =
      await Student.findByIdAndUpdate(
        id,
        { status },
        {
          new: true,
          runValidators: true,
        }
      );

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Student status updated successfully.",
      data: student,
    });
  } catch (error) {
    console.error(
      "Update status error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error while updating status.",
      error: error.message,
    });
  }
};


// =====================================================
// DELETE MULTIPLE STUDENTS
// DELETE /api/students/bulk-delete
// =====================================================
export const deleteMultipleStudents = async (
  req,
  res
) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No students selected.",
      });
    }

    const students =
      await Student.find({
        _id: { $in: ids },
      });

    for (const student of students) {
      try {
        await clerkClient.users.deleteUser(
          student.clerkId
        );
      } catch (error) {
        console.error(
          `Failed to delete Clerk user ${student.clerkId}`,
          error
        );
      }
    }

    await Student.deleteMany({
      _id: { $in: ids },
    });

    return res.status(200).json({
      success: true,
      message: `${students.length} student(s) deleted successfully.`,
      deletedCount: students.length,
    });
  } catch (error) {
    console.error(
      "Bulk delete students error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to delete selected students.",
      error: error.message,
    });
  }
};