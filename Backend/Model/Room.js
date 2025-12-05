import mongoose from "mongoose";

const roomSchema = new mongoose.Schema(
  {
    floor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Floor",
      required: true,
    },
    roomNumber: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    roomType: {
      type: String,
      enum: ["Office", "Conference Room", "Meeting Room", "Server Room", "Washroom", "Sitting Area","Other"],
      default: "Office",
    },
    capacity: {
      type: Number,
      default: 0,
    },
    area: {
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

// Compound index to ensure unique room number per floor
roomSchema.index({ floor: 1, roomNumber: 1 }, { unique: true });

const Room = mongoose.model("Room", roomSchema);

export default Room;
