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
      required: function () {
        return !this.room;
      },
    },
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [1, "Quantity must be at least 1"],
      default: 1,
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
      ref: "Employee",
      required: true,
    },
    returnedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
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
    room: {
      type: String,
      trim: true,
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
