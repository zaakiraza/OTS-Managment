import mongoose from "mongoose";

const resourceSchema = new mongoose.Schema(
  {
    resourceId: {
      type: String,
      unique: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: [true, "Resource name is required"],
      trim: true,
    },
    type: {
      type: String,
      required: [true, "Type is required"],
      enum: [
        "Software Subscription",
        "API Key",
        "Cloud Service",
        "Domain",
        "License",
        "Tool Access",
        "Other",
      ],
    },
    provider: {
      type: String,
      trim: true,
    },
    cost: {
      type: Number,
      min: 0,
    },
    currency: {
      type: String,
      default: "PKR",
      enum: ["PKR", "USD", "EUR", "GBP"],
    },
    billingCycle: {
      type: String,
      enum: ["Monthly", "Quarterly", "Yearly", "One-time", "Custom"],
    },
    purchaseDate: {
      type: Date,
    },
    expiryDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["Active", "Expired", "Cancelled", "Pending"],
      default: "Active",
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
    },
    credentials: {
      username: String,
      email: String,
      notes: String,
    },
    description: {
      type: String,
      trim: true,
    },
    accessUrl: {
      type: String,
      trim: true,
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
    },
  },
  {
    timestamps: true,
  }
);

// Auto-generate resource ID
resourceSchema.pre("save", async function () {
  if (this.isNew && !this.resourceId) {
    const count = await mongoose.model("Resource").countDocuments();
    this.resourceId = `RSC${String(count + 1).padStart(5, "0")}`;
  }
});

const Resource = mongoose.model("Resource", resourceSchema);

export default Resource;
