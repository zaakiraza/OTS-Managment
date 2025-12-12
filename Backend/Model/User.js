import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { SECURITY } from "../Config/constants.js";

/**
 * @deprecated This model is DEPRECATED and kept for backward compatibility only.
 * 
 * IMPORTANT: Authentication now uses the Employee model exclusively.
 * - All new users should be created as Employees via /api/employees
 * - The /api/users endpoint now creates Employee records internally
 * - This User model is only used for legacy data migration
 * 
 * Migration Status: See Scripts/MIGRATION_GUIDE.md for details
 * 
 * The Employee model supports all user types including:
 * - superAdmin, attendanceDepartment, ITAssetManager, teamLead, employee
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    userId: {
      type: String,
      required: [true, "User ID is required"],
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: [true, "Role is required"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }
  this.password = await bcrypt.hash(this.password, SECURITY.BCRYPT_SALT_ROUNDS);
});

// Indexes for faster queries
userSchema.index({ role: 1, isActive: 1 }); // For role-based queries
userSchema.index({ isActive: 1 }); // For filtering active users

const User = mongoose.model("User", userSchema);

export default User;
