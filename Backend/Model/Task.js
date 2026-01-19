import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    taskId: {
      type: String,
      unique: true,
      uppercase: true,
    },
    title: {
      type: String,
      required: [true, "Task title is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    assignedTo: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
    }],
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: [true, "Department is required"],
    },
    status: {
      type: String,
      enum: ["todo", "in-progress", "completed"],
      default: "todo",
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical"],
      default: "Medium",
    },
    dueDate: {
      type: Date,
      required: [true, "Due date is required"],
    },
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    comments: [
      {
        employee: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Employee",
        },
        comment: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    attachments: [
      {
        url: String,
        originalName: String,
        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Employee",
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-generate task ID
taskSchema.pre("save", async function () {
  if (this.isNew && !this.taskId) {
    const count = await mongoose.model("Task").countDocuments();
    this.taskId = `TSK${String(count + 1).padStart(5, "0")}`;
  }
  
  // Set startedAt when status changes to in-progress
  if (this.isModified("status")) {
    if (this.status === "in-progress" && !this.startedAt) {
      this.startedAt = new Date();
    }
    if (this.status === "completed" && !this.completedAt) {
      this.completedAt = new Date();
    }
  }
});

const Task = mongoose.model("Task", taskSchema);

export default Task;
