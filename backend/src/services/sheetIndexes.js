// src/services/sheetIndexes.js
//
// Unique indexes that changed with the evening college (an evening record
// sits next to the day record of the same class / subject):
//   IA / attendance sheets  – unique per class AND shift
//   practical examiner sets – set numbers per department AND shift
//   practical batches       – batch numbers per subject, branch AND shift
// Runs once per server start: drops the old index if it is still there and
// creates the new one. No data is changed.

import FinalIA from "../models/FinalIA.js";
import FinalAttendance from "../models/FinalAttendance.js";
import PracticalPanel from "../models/PracticalPanel.js";
import PracticalBatch from "../models/PracticalBatch.js";

const OLD = [
  [FinalIA, "academicYear_1_department_1_semester_1_batch_1"],
  [FinalAttendance, "academicYear_1_department_1_semester_1_batch_1"],
  [PracticalPanel, "exam_1_department_1_number_1"],
  [PracticalBatch, "exam_1_code_1_number_1"],
];
let done = false;

export async function updateSheetIndexes() {
  if (done) return;
  done = true;
  for (const [Model, old] of OLD) {
    try {
      const existing = await Model.collection.indexes();
      if (existing.some((i) => i.name === old)) await Model.collection.dropIndex(old);
      await Model.createIndexes();
    } catch (e) {
      done = false; // try again at the next start
      console.error(`Index update (${Model.modelName}) failed:`, e.message);
    }
  }
}
