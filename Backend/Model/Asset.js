import mongoose from "mongoose";

const assetSchema = new mongoose.Schema(
  {
    assetId: {
      type: String,
      unique: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: [true, "Asset name is required"],
      trim: true,
    },
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [1, "Quantity must be at least 1"],
      default: 1,
    },
    quantityAssigned: {
      type: Number,
      default: 0,
      min: [0, "Assigned quantity cannot be negative"],
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: [
        "Laptop",
        "Desktop",
        "System",
        "Monitor",
        "Keyboard",
        "Mouse",
        "Headphones",
        "Cable/Wire",
        "Router/Switch",
        "Printer",
        "Scanner",
        "Webcam",
        "Hard Drive",
        "RAM",
        "Other",
      ],
    },
    issueDate: {
      type: Date,
      required: [true, "Issue date is required"],
    },
    status: {
      type: String,
      enum: ["Available", "Assigned", "Under Repair", "Damaged", "Retired", "Refurb", "New"],
      default: "Available",
    },
    condition: {
      type: String,
      enum: ["Excellent", "Good", "Fair", "Poor"],
      default: "Good",
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    assignedDate: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
    },
    images: {
      type: [String],
      default: [],
    },
    location: {
      building: {
        type: String,
        trim: true,
      },
      floor: {
        type: String,
        trim: true,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    modifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-generate asset ID
assetSchema.pre("save", async function () {
  if (this.isNew && !this.assetId) {
    const count = await mongoose.model("Asset").countDocuments();
    this.assetId = `AST${String(count + 1).padStart(5, "0")}`;
  }
});

const Asset = mongoose.model("Asset", assetSchema);

export default Asset;
