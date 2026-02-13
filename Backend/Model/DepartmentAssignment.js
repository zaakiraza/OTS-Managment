import mongoose from "mongoose";
import { encryptNumber, decryptNumber } from "../Utils/encryption.js";

/**
 * DepartmentAssignment Model
 * Links an Employee to a Department with department-specific settings.
 * Each row = one employee working in one department.
 * Single-dept employees have 1 row; multi-dept employees have multiple rows.
 */
const departmentAssignmentSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: [true, "Employee is required"],
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: [true, "Department is required"],
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
    position: {
      type: String,
      default: "",
      trim: true,
    },
    roleInDepartment: {
      type: String,
      enum: ["employee", "teamLead", "hrManager", "attendanceManager", "departmentHead"],
      default: "employee",
    },
    monthlySalary: {
      type: mongoose.Schema.Types.Mixed, // Stores encrypted string
      min: 0,
      default: 0,
    },
    currency: {
      type: String,
      default: "PKR",
    },
    leaveQuota: {
      annual: { type: Number, default: 0, min: 0 },
      casual: { type: Number, default: 0, min: 0 },
      sick: { type: Number, default: 0, min: 0 },
      unpaid: { type: Number, default: 0, min: 0 },
    },
    leaveThreshold: {
      type: Number,
      min: 0,
      default: 0,
      description: "Number of leaves allowed before marking as absent for salary calculation",
    },
    joiningDate: {
      type: Date,
    },
    workSchedule: {
      checkInTime: {
        type: String,
        default: "09:00",
      },
      checkOutTime: {
        type: String,
        default: "17:00",
      },
      workingDaysPerWeek: {
        type: Number,
        default: 5,
        min: 1,
        max: 7,
      },
      workingHoursPerWeek: {
        type: Number,
        default: 40,
        min: 0,
      },
      weeklyOffs: {
        type: [String],
        default: ["Saturday", "Sunday"],
        enum: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ],
      },
      daySchedules: {
        type: Map,
        of: {
          checkInTime: String,
          checkOutTime: String,
          isHalfDay: { type: Boolean, default: false },
          isOff: { type: Boolean, default: false },
        },
        default: new Map(),
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
    },
    modifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Indexes ──────────────────────────────────────────────────────────
// One employee can only have one active assignment per department
departmentAssignmentSchema.index(
  { employee: 1, department: 1 },
  { unique: true }
);
departmentAssignmentSchema.index({ department: 1, isActive: 1 });
departmentAssignmentSchema.index({ employee: 1, isActive: 1 });
departmentAssignmentSchema.index({ employee: 1, isPrimary: 1 });

// ── Helper: Encrypt salary fields ────────────────────────────────────
const encryptSalaryFields = (doc) => {
  if (doc.monthlySalary !== undefined && typeof doc.monthlySalary === "number") {
    doc.monthlySalary = encryptNumber(doc.monthlySalary);
  }
};

// ── Helper: Decrypt salary fields ────────────────────────────────────
const decryptSalaryFields = (doc) => {
  if (!doc) return doc;
  if (doc.monthlySalary !== undefined && typeof doc.monthlySalary === "string") {
    doc.monthlySalary = decryptNumber(doc.monthlySalary);
  }
  return doc;
};

// ── Pre-save: encrypt salary and enforce exactly one isPrimary ───────
departmentAssignmentSchema.pre("save", async function () {
  // Encrypt salary
  encryptSalaryFields(this);
  
  // Enforce primary assignment
  if (this.isPrimary && this.isModified("isPrimary")) {
    // Un-mark any other primary assignment for this employee
    await mongoose.model("DepartmentAssignment").updateMany(
      { employee: this.employee, _id: { $ne: this._id } },
      { isPrimary: false }
    );
  }
});

// ── Pre-findOneAndUpdate: encrypt salary ─────────────────────────────
departmentAssignmentSchema.pre("findOneAndUpdate", function () {
  const update = this.getUpdate();
  if (update.$set) {
    encryptSalaryFields(update.$set);
  } else {
    encryptSalaryFields(update);
  }
});

// Also handle updateOne and updateMany
departmentAssignmentSchema.pre(["updateOne", "updateMany"], function () {
  const update = this.getUpdate();
  if (update.$set) {
    encryptSalaryFields(update.$set);
  } else {
    encryptSalaryFields(update);
  }
});

// ── Post-find hooks: decrypt salary ──────────────────────────────────
departmentAssignmentSchema.post("find", function (docs) {
  if (Array.isArray(docs)) {
    docs.forEach(doc => decryptSalaryFields(doc));
  }
});

departmentAssignmentSchema.post("findOne", function (doc) {
  decryptSalaryFields(doc);
});

departmentAssignmentSchema.post("findOneAndUpdate", function (doc) {
  decryptSalaryFields(doc);
});

// ── Transform for JSON output: Ensure decrypted values ───────────────
const originalToJSON = departmentAssignmentSchema.get("toJSON");
departmentAssignmentSchema.set("toJSON", {
  ...originalToJSON,
  transform: function (doc, ret) {
    decryptSalaryFields(ret);
    if (originalToJSON?.transform) {
      return originalToJSON.transform(doc, ret);
    }
    return ret;
  },
});

const originalToObject = departmentAssignmentSchema.get("toObject");
departmentAssignmentSchema.set("toObject", {
  ...originalToObject,
  transform: function (doc, ret) {
    decryptSalaryFields(ret);
    if (originalToObject?.transform) {
      return originalToObject.transform(doc, ret);
    }
    return ret;
  },
});

const DepartmentAssignment = mongoose.model(
  "DepartmentAssignment",
  departmentAssignmentSchema
);

export default DepartmentAssignment;
