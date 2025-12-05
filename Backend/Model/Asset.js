import mongoose from "mongoose";

const assetSchema = new mongoose.Schema(
  {
    assetId: {
      type: String,
      required: [true, "Asset ID is required"],
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
    brand: {
      type: String,
      trim: true,
    },
    model: {
      type: String,
      trim: true,
    },
    serialNumber: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    specifications: {
      type: String,
      trim: true,
    },
    purchaseDate: {
      type: Date,
    },
    purchasePrice: {
      type: Number,
      min: 0,
    },
    vendor: {
      type: String,
      trim: true,
    },
    warrantyExpiry: {
      type: Date,
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
    location: {
      type: String,
      trim: true,
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
assetSchema.pre("save", async function (next) {
  if (this.isNew && !this.assetId) {
    const count = await mongoose.model("Asset").countDocuments();
    this.assetId = `AST${String(count + 1).padStart(5, "0")}`;
  }
  next();
});

const Asset = mongoose.model("Asset", assetSchema);

export default Asset;
