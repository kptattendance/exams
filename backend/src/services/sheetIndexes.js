// src/services/sheetIndexes.js
//
// The IA / attendance sheets used to be unique per year + department +
// semester + batch. With the evening college an evening sheet sits next to
// the day sheet of the same class, so the unique index includes the shift.
// Runs once per server start: drops the old index if it is still there and
// creates the new one. No data is changed.

import FinalIA from "../models/FinalIA.js";
import FinalAttendance from "../models/FinalAttendance.js";

const OLD = "academicYear_1_department_1_semester_1_batch_1";
let done = false;

export async function updateSheetIndexes() {
  if (done) return;
  done = true;
  for (const Model of [FinalIA, FinalAttendance]) {
    try {
      const existing = await Model.collection.indexes();
      if (existing.some((i) => i.name === OLD)) await Model.collection.dropIndex(OLD);
      await Model.createIndexes();
    } catch (e) {
      done = false; // try again at the next start
      console.error(`Sheet index update (${Model.modelName}) failed:`, e.message);
    }
  }
}
