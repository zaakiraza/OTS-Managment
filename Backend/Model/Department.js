import mongoose from "mongoose";

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Department name is required"],
      unique: true,
      trim: true,
    },
    code: {
      type: String,
      required: [true, "Department code is required"],
      unique: true,
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    // Parent department for hierarchy (null = root/top-level department)
    parentDepartment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      default: null,
    },
    // Hierarchy level (0 = root, 1 = sub-department, 2 = sub-sub-department, etc.)
    level: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Full path from root to this department (for easy hierarchy queries)
    path: {
      type: String,
      default: "",
    },
    head: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    hrManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
      description: "HR manager responsible for this department",
    },
    attendanceManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
      description: "Attendance manager responsible for this department",
    },
    teamLead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    leverageTime: {
      checkInMinutes: {
        type: Number,
        default: 15,
        min: 0,
      },
      checkOutMinutes: {
        type: Number,
        default: 10,
        min: 0,
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Index for hierarchy queries
departmentSchema.index({ parentDepartment: 1 });
departmentSchema.index({ path: 1 });
departmentSchema.index({ level: 1 });

// Virtual to get sub-departments
departmentSchema.virtual('subDepartments', {
  ref: 'Department',
  localField: '_id',
  foreignField: 'parentDepartment',
});

const Department = mongoose.model("Department", departmentSchema);

export default Department;
