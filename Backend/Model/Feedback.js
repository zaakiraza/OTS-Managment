import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema(
  {
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    submittedByName: {
      type: String,
      required: true,
    },
    submittedByEmail: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ["bug", "feature", "improvement", "other"],
      default: "other",
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["new", "in-review", "resolved", "closed"],
      default: "new",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    adminNotes: {
      type: String,
      default: "",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
feedbackSchema.index({ submittedBy: 1, createdAt: -1 });
feedbackSchema.index({ status: 1, createdAt: -1 });
feedbackSchema.index({ category: 1 });

const Feedback = mongoose.model("Feedback", feedbackSchema);

export default Feedback;

