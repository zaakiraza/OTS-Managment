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
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: [
        "Laptop",
        "Desktop",
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
    },
    purchasePrice: {
      type: Number,
      min: 0,
    },
    status: {
      type: String,
      enum: ["Available", "Assigned", "Under Repair", "Damaged", "Retired"],
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

// Auto-generate asset ID
assetSchema.pre("save", async function () {
  if (this.isNew && !this.assetId) {
    const count = await mongoose.model("Asset").countDocuments();
    this.assetId = `AST${String(count + 1).padStart(5, "0")}`;
  }
});

const Asset = mongoose.model("Asset", assetSchema);

export default Asset;
