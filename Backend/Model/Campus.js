import mongoose from "mongoose";

const campusSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
    },
    country: {
      type: String,
      default: "Pakistan",
    },
    address: {
      type: String,
      default: "",
    },
    totalArea: {
      type: Number,
      default: 0,
    },
    description: {
      type: String,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

const Campus = mongoose.model("Campus", campusSchema);

export default Campus;
