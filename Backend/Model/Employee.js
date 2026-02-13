import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { encryptNumber, decryptNumber } from "../Utils/encryption.js";

/**
 * Employee Model (V2 Restructured — with V1 legacy fields preserved)
 * 
 * V2 uses DepartmentAssignment collection for per-department data.
 * V1 legacy fields (department, shifts, salary, workSchedule, etc.)
 * are kept so the old /api/employees routes continue to work.
 */
const employeeSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: [true, "Employee ID is required"],
      unique: true,
      uppercase: true,
    },
    biometricId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      select: false,
      validate: {
        validator: function (v) {
          if (!v) return true;
          return v.length >= 6;
        },
        message: "Password must be at least 6 characters",
      },
    },
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: [true, "Role is required"],
      description: "Global/system-level role (superAdmin, employee, etc.)",
    },

    // ── V2 field: denormalized primary department ──
    primaryDepartment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      default: null,
      description: "Cached from the DepartmentAssignment where isPrimary=true",
    },

    // ── V1 legacy fields (kept for backward compat) ──
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
    },
    position: {
      type: String,
      trim: true,
    },
    isTeamLead: {
      type: Boolean,
      default: false,
    },
    leadingDepartments: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
    }],
    salary: {
      monthlySalary: { type: mongoose.Schema.Types.Mixed, default: null }, // Stores encrypted string
      currency: { type: String, default: "PKR" },
      leaveThreshold: { type: Number, default: 0 },
    },
    workSchedule: {
      checkInTime: { type: String, default: "09:00" },
      checkOutTime: { type: String, default: "17:00" },
      workingDaysPerWeek: { type: Number, default: 5 },
      workingHoursPerWeek: { type: Number, default: 40 },
      weeklyOffs: { type: [String], default: ["Saturday", "Sunday"] },
      daySchedules: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    joiningDate: {
      type: Date,
    },
    shifts: [{
      department: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },
      isPrimary: { type: Boolean, default: false },
      position: { type: String, trim: true },
      monthlySalary: { type: mongoose.Schema.Types.Mixed }, // Stores encrypted string
      currency: { type: String, default: "PKR" },
      leaveThreshold: { type: Number, default: 0 },
      joiningDate: { type: Date },
      isActive: { type: Boolean, default: true },
      daysOfWeek: [String],
      workSchedule: {
        checkInTime: String,
        checkOutTime: String,
        workingDaysPerWeek: Number,
        workingHoursPerWeek: Number,
        weeklyOffs: [String],
        daySchedules: { type: mongoose.Schema.Types.Mixed, default: {} },
      },
      daySchedules: { type: mongoose.Schema.Types.Mixed, default: {} },
    }],

    phone: {
      type: String,
      trim: true,
    },
    cnic: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      validate: {
        validator: function (v) {
          if (!v) return true;
          return /^\d{5}-\d{7}-\d{1}$/.test(v);
        },
        message: (props) =>
          `${props.value} is not a valid CNIC format! Use format: XXXXX-XXXXXXX-X`,
      },
    },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      zipCode: String,
    },
    emergencyContact: {
      name: String,
      relationship: String,
      phone: String,
    },
    documents: {
      idProof: String,
      photo: String,
      resume: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: false,
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
employeeSchema.index({ primaryDepartment: 1, isActive: 1 });
employeeSchema.index({ department: 1, isActive: 1 });
employeeSchema.index({ isActive: 1 });

// ── Helper: Encrypt salary fields ────────────────────────────────────
const encryptEmployeeSalaryFields = (doc) => {
  // Encrypt salary.monthlySalary
  if (doc.salary?.monthlySalary !== undefined && typeof doc.salary.monthlySalary === "number") {
    doc.salary.monthlySalary = encryptNumber(doc.salary.monthlySalary);
  }
  
  // Encrypt shifts[].monthlySalary
  if (doc.shifts && Array.isArray(doc.shifts)) {
    doc.shifts.forEach((shift) => {
      if (shift.monthlySalary !== undefined && typeof shift.monthlySalary === "number") {
        shift.monthlySalary = encryptNumber(shift.monthlySalary);
      }
    });
  }
};

// ── Helper: Decrypt salary fields ────────────────────────────────────
const decryptEmployeeSalaryFields = (doc) => {
  if (!doc) return doc;
  
  // Decrypt salary.monthlySalary
  if (doc.salary?.monthlySalary !== undefined && typeof doc.salary.monthlySalary === "string") {
    doc.salary.monthlySalary = decryptNumber(doc.salary.monthlySalary);
  }
  
  // Decrypt shifts[].monthlySalary
  if (doc.shifts && Array.isArray(doc.shifts)) {
    doc.shifts.forEach((shift) => {
      if (shift.monthlySalary !== undefined && typeof shift.monthlySalary === "string") {
        shift.monthlySalary = decryptNumber(shift.monthlySalary);
      }
    });
  }
  
  return doc;
};

// ── Pre-save: encrypt salary and hash password ───────────────────────
employeeSchema.pre("save", async function () {
  // Encrypt salary fields
  encryptEmployeeSalaryFields(this);
  
  // Hash password
  if (this.isNew || this.isModified("password")) {
    if (!this.password) {
      const last4 = this.employeeId.slice(-4);
      this.password = `Emp@${last4}`;
    }
    this.password = await bcrypt.hash(this.password, 10);
  }
});

// ── Pre-findOneAndUpdate: encrypt salary fields ──────────────────────
employeeSchema.pre(["findOneAndUpdate", "findByIdAndUpdate"], function () {
  const update = this.getUpdate();
  
  // Handle $set operations
  if (update.$set) {
    encryptEmployeeSalaryFields(update.$set);
  }
  
  // Also check direct update (when fields are at root level)
  if (update.salary || update.shifts) {
    encryptEmployeeSalaryFields(update);
  }
});

// Also handle updateOne and updateMany
employeeSchema.pre(["updateOne", "updateMany"], function () {
  const update = this.getUpdate();
  if (update.$set) {
    encryptEmployeeSalaryFields(update.$set);
  } else {
    encryptEmployeeSalaryFields(update);
  }
});

// ── Post-find hooks: decrypt salary fields ───────────────────────────
employeeSchema.post("find", function (docs) {
  if (Array.isArray(docs)) {
    docs.forEach(doc => decryptEmployeeSalaryFields(doc));
  }
});

employeeSchema.post("findOne", function (doc) {
  decryptEmployeeSalaryFields(doc);
});

employeeSchema.post("findOneAndUpdate", function (doc) {
  decryptEmployeeSalaryFields(doc);
});

// ── Methods ──────────────────────────────────────────────────────────
employeeSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// ── Transform for JSON output: Ensure decrypted salary values ────────
const originalToJSON = employeeSchema.get("toJSON");
employeeSchema.set("toJSON", {
  ...originalToJSON,
  transform: function (doc, ret) {
    decryptEmployeeSalaryFields(ret);
    if (originalToJSON?.transform) {
      return originalToJSON.transform(doc, ret);
    }
    return ret;
  },
});

const originalToObject = employeeSchema.get("toObject");
employeeSchema.set("toObject", {
  ...originalToObject,
  transform: function (doc, ret) {
    decryptEmployeeSalaryFields(ret);
    if (originalToObject?.transform) {
      return originalToObject.transform(doc, ret);
    }
    return ret;
  },
});

// ── Virtuals (populated from DepartmentAssignment) ───────────────────
// These require a populate or separate query at the controller level.
// They are kept here for backward-compat convenience when the
// departmentAssignments are attached to the employee object.
employeeSchema.virtual("departmentAssignments", {
  ref: "DepartmentAssignment",
  localField: "_id",
  foreignField: "employee",
  justOne: false,
});

const Employee = mongoose.model("Employee", employeeSchema);

export default Employee;
