import mongoose from "mongoose";

const assetAssignmentSchema = new mongoose.Schema(
  {
    asset: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Asset",
      required: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    assignedDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    returnDate: {
      type: Date,
      default: null,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    returnedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    conditionAtAssignment: {
      type: String,
      enum: ["Excellent", "Good", "Fair", "Poor"],
      required: true,
    },
    conditionAtReturn: {
      type: String,
      enum: ["Excellent", "Good", "Fair", "Poor"],
      default: null,
    },
    notes: {
      type: String,
      trim: true,
    },
    returnNotes: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["Active", "Returned", "Damaged", "Lost"],
      default: "Active",
    },
  },
  {
    timestamps: true,
  }
);

const AssetAssignment = mongoose.model("AssetAssignment", assetAssignmentSchema);

export default AssetAssignment;
