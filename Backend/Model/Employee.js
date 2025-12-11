import mongoose from "mongoose";
import bcrypt from "bcrypt";

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
        validator: function(v) {
          // Allow empty/undefined passwords (will keep existing or auto-generate)
          if (!v) return true;
          // If provided, must be at least 6 characters
          return v.length >= 6;
        },
        message: "Password must be at least 6 characters"
      }
    },
    isTeamLead: {
      type: Boolean,
      default: false,
    },
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
        validator: function(v) {
          if (!v) return true; // Allow empty/null values
          return /^\d{5}-\d{7}-\d{1}$/.test(v);
        },
        message: props => `${props.value} is not a valid CNIC format! Use format: XXXXX-XXXXXXX-X`
      }
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: [true, "Department is required"],
    },
    position: {
      type: String,
      required: [true, "Position is required"],
    },
    salary: {
      monthlySalary: {
        type: Number,
        min: 0,
      },
      currency: {
        type: String,
        default: "PKR",
      },
      leaveThreshold: {
        type: Number,
        default: 0,
        min: 0,
        description: "Number of leaves allowed before marking as absent for salary calculation"
      },
    },
    workSchedule: {
      checkInTime: {
        type: String,
        required: [true, "Check-in time is required"],
        default: "09:00",
      },
      checkOutTime: {
        type: String,
        required: [true, "Check-out time is required"],
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
        enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      },
    },
    joiningDate: {
      type: Date,
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
      ref: "User",
      required: true,
    },
    modifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
employeeSchema.index({ department: 1, isActive: 1 }); // For department-based queries
employeeSchema.index({ isActive: 1 }); // For filtering active employees
// Note: biometricId already has unique index from schema definition

// Hash password before saving
employeeSchema.pre("save", async function () {
  // Only hash if password is modified or new
  if (!this.isModified("password")) return;
  
  // If no password provided, generate default: Emp@{last4digits}
  if (!this.password) {
    const last4 = this.employeeId.slice(-4);
    this.password = `Emp@${last4}`;
  }
  
  // Hash the password
  this.password = await bcrypt.hash(this.password, 10);
});

// Method to compare passwords
employeeSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const Employee = mongoose.model("Employee", employeeSchema);

export default Employee;
