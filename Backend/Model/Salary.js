import mongoose from "mongoose";
import { encryptNumber, decryptNumber } from "../Utils/encryption.js";

const salarySchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    employeeId: {
      type: String,
      required: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: [true, "Department is required for per-department salary"],
    },
    departmentAssignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DepartmentAssignment",
      required: [true, "Department assignment is required"],
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: true,
    },
    baseSalary: {
      type: mongoose.Schema.Types.Mixed, // Stores encrypted string
      required: true,
    },
    calculations: {
      totalWorkingDays: {
        type: Number,
        required: true,
      },
      presentDays: {
        type: Number,
        default: 0,
      },
      absentDays: {
        type: Number,
        default: 0,
      },
      halfDays: {
        type: Number,
        default: 0,
      },
      lateDays: {
        type: Number,
        default: 0,
      },
      leaveDays: {
        type: Number,
        default: 0,
      },
      totalWorkedDays: {
        type: Number,
        default: 0,
      },
      perDaySalary: {
        type: mongoose.Schema.Types.Mixed, // Stores encrypted string
        required: true,
      },
    },
    deductions: {
      absentDeduction: {
        type: mongoose.Schema.Types.Mixed, // Stores encrypted string
        default: 0,
      },
      lateDeduction: {
        type: mongoose.Schema.Types.Mixed, // Stores encrypted string
        default: 0,
      },
      otherDeductions: {
        type: mongoose.Schema.Types.Mixed, // Stores encrypted string
        default: 0,
      },
      totalDeductions: {
        type: mongoose.Schema.Types.Mixed, // Stores encrypted string
        default: 0,
      },
    },
    additions: {
      overtime: {
        type: mongoose.Schema.Types.Mixed, // Stores encrypted string
        default: 0,
      },
      bonus: {
        type: mongoose.Schema.Types.Mixed, // Stores encrypted string
        default: 0,
      },
      allowances: {
        type: mongoose.Schema.Types.Mixed, // Stores encrypted string
        default: 0,
      },
      totalAdditions: {
        type: mongoose.Schema.Types.Mixed, // Stores encrypted string
        default: 0,
      },
    },
    netSalary: {
      type: mongoose.Schema.Types.Mixed, // Stores encrypted string
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "calculated", "approved", "paid"],
      default: "pending",
    },
    remarks: {
      type: String,
      default: "",
    },
    calculatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    paidOn: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for unique salary per employee per department per month
salarySchema.index({ employee: 1, department: 1, month: 1, year: 1 }, { unique: true });
salarySchema.index({ employeeId: 1, department: 1, month: 1, year: 1 });
salarySchema.index({ department: 1, month: 1, year: 1 });

// Helper function to encrypt sensitive salary fields
const encryptSalaryFields = (doc) => {
  if (doc.baseSalary !== undefined && typeof doc.baseSalary === "number") {
    doc.baseSalary = encryptNumber(doc.baseSalary);
  }
  if (doc.netSalary !== undefined && typeof doc.netSalary === "number") {
    doc.netSalary = encryptNumber(doc.netSalary);
  }
  if (doc.calculations?.perDaySalary !== undefined && typeof doc.calculations.perDaySalary === "number") {
    doc.calculations.perDaySalary = encryptNumber(doc.calculations.perDaySalary);
  }
  if (doc.deductions) {
    if (doc.deductions.absentDeduction !== undefined && typeof doc.deductions.absentDeduction === "number") {
      doc.deductions.absentDeduction = encryptNumber(doc.deductions.absentDeduction);
    }
    if (doc.deductions.lateDeduction !== undefined && typeof doc.deductions.lateDeduction === "number") {
      doc.deductions.lateDeduction = encryptNumber(doc.deductions.lateDeduction);
    }
    if (doc.deductions.otherDeductions !== undefined && typeof doc.deductions.otherDeductions === "number") {
      doc.deductions.otherDeductions = encryptNumber(doc.deductions.otherDeductions);
    }
    if (doc.deductions.totalDeductions !== undefined && typeof doc.deductions.totalDeductions === "number") {
      doc.deductions.totalDeductions = encryptNumber(doc.deductions.totalDeductions);
    }
  }
  if (doc.additions) {
    if (doc.additions.overtime !== undefined && typeof doc.additions.overtime === "number") {
      doc.additions.overtime = encryptNumber(doc.additions.overtime);
    }
    if (doc.additions.bonus !== undefined && typeof doc.additions.bonus === "number") {
      doc.additions.bonus = encryptNumber(doc.additions.bonus);
    }
    if (doc.additions.allowances !== undefined && typeof doc.additions.allowances === "number") {
      doc.additions.allowances = encryptNumber(doc.additions.allowances);
    }
    if (doc.additions.totalAdditions !== undefined && typeof doc.additions.totalAdditions === "number") {
      doc.additions.totalAdditions = encryptNumber(doc.additions.totalAdditions);
    }
  }
};

// Helper function to decrypt sensitive salary fields
const decryptSalaryFields = (doc) => {
  if (!doc) return doc;
  
  if (doc.baseSalary !== undefined && typeof doc.baseSalary === "string") {
    doc.baseSalary = decryptNumber(doc.baseSalary);
  }
  if (doc.netSalary !== undefined && typeof doc.netSalary === "string") {
    doc.netSalary = decryptNumber(doc.netSalary);
  }
  if (doc.calculations?.perDaySalary !== undefined && typeof doc.calculations.perDaySalary === "string") {
    doc.calculations.perDaySalary = decryptNumber(doc.calculations.perDaySalary);
  }
  if (doc.deductions) {
    if (doc.deductions.absentDeduction !== undefined && typeof doc.deductions.absentDeduction === "string") {
      doc.deductions.absentDeduction = decryptNumber(doc.deductions.absentDeduction);
    }
    if (doc.deductions.lateDeduction !== undefined && typeof doc.deductions.lateDeduction === "string") {
      doc.deductions.lateDeduction = decryptNumber(doc.deductions.lateDeduction);
    }
    if (doc.deductions.otherDeductions !== undefined && typeof doc.deductions.otherDeductions === "string") {
      doc.deductions.otherDeductions = decryptNumber(doc.deductions.otherDeductions);
    }
    if (doc.deductions.totalDeductions !== undefined && typeof doc.deductions.totalDeductions === "string") {
      doc.deductions.totalDeductions = decryptNumber(doc.deductions.totalDeductions);
    }
  }
  if (doc.additions) {
    if (doc.additions.overtime !== undefined && typeof doc.additions.overtime === "string") {
      doc.additions.overtime = decryptNumber(doc.additions.overtime);
    }
    if (doc.additions.bonus !== undefined && typeof doc.additions.bonus === "string") {
      doc.additions.bonus = decryptNumber(doc.additions.bonus);
    }
    if (doc.additions.allowances !== undefined && typeof doc.additions.allowances === "string") {
      doc.additions.allowances = decryptNumber(doc.additions.allowances);
    }
    if (doc.additions.totalAdditions !== undefined && typeof doc.additions.totalAdditions === "string") {
      doc.additions.totalAdditions = decryptNumber(doc.additions.totalAdditions);
    }
  }
  return doc;
};

// Pre-save hook: Encrypt salary fields before saving
salarySchema.pre("save", function (next) {
  encryptSalaryFields(this);
  next();
});

// Pre-findOneAndUpdate hook: Encrypt salary fields before update
salarySchema.pre("findOneAndUpdate", function () {
  const update = this.getUpdate();
  if (update.$set) {
    encryptSalaryFields(update.$set);
  } else {
    encryptSalaryFields(update);
  }
});

// Also handle updateOne and updateMany
salarySchema.pre(["updateOne", "updateMany"], function () {
  const update = this.getUpdate();
  if (update.$set) {
    encryptSalaryFields(update.$set);
  } else {
    encryptSalaryFields(update);
  }
});

// Post hooks: Decrypt salary fields after retrieval
salarySchema.post("find", function (docs) {
  if (Array.isArray(docs)) {
    docs.forEach(doc => decryptSalaryFields(doc));
  }
});

salarySchema.post("findOne", function (doc) {
  decryptSalaryFields(doc);
});

salarySchema.post("findOneAndUpdate", function (doc) {
  decryptSalaryFields(doc);
});

// Transform for JSON output: Ensure decrypted values in API responses
salarySchema.set("toJSON", {
  transform: function (doc, ret) {
    decryptSalaryFields(ret);
    return ret;
  },
});

salarySchema.set("toObject", {
  transform: function (doc, ret) {
    decryptSalaryFields(ret);
    return ret;
  },
});

const Salary = mongoose.model("Salary", salarySchema);

export default Salary;
