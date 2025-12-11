import mongoose from "mongoose";

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
      type: Number,
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
        type: Number,
        required: true,
      },
    },
    deductions: {
      absentDeduction: {
        type: Number,
        default: 0,
      },
      lateDeduction: {
        type: Number,
        default: 0,
      },
      otherDeductions: {
        type: Number,
        default: 0,
      },
      totalDeductions: {
        type: Number,
        default: 0,
      },
    },
    additions: {
      overtime: {
        type: Number,
        default: 0,
      },
      bonus: {
        type: Number,
        default: 0,
      },
      allowances: {
        type: Number,
        default: 0,
      },
      totalAdditions: {
        type: Number,
        default: 0,
      },
    },
    netSalary: {
      type: Number,
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
      ref: "User",
      required: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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

// Compound index for unique salary per employee per month
salarySchema.index({ employee: 1, month: 1, year: 1 }, { unique: true });
salarySchema.index({ employeeId: 1, month: 1, year: 1 });

const Salary = mongoose.model("Salary", salarySchema);

export default Salary;
