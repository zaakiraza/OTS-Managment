import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      enum: [
        "manualAttendanceEnabled",
        "importAttendanceEnabled",
        "autoMarkAbsentEnabled",
        "emailService",
        "emailUser",
        "emailPassword",
        "emailFromName",
        "lastProcessedAttendanceSN",
      ],
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
    },
  },
  {
    timestamps: true,
  }
);

// Static method to get a setting value
settingsSchema.statics.getValue = async function (key, defaultValue = null) {
  const setting = await this.findOne({ key });
  return setting ? setting.value : defaultValue;
};

// Static method to set a setting value
settingsSchema.statics.setValue = async function (key, value, userId = null) {
  return await this.findOneAndUpdate(
    { key },
    { value, updatedBy: userId },
    { upsert: true, new: true }
  );
};

// Static method to get all settings as an object
settingsSchema.statics.getAllSettings = async function () {
  const settings = await this.find({}).populate("updatedBy", "name employeeId");
  const result = {};
  settings.forEach((setting) => {
    result[setting.key] = {
      value: setting.value,
      description: setting.description,
      updatedAt: setting.updatedAt,
      updatedBy: setting.updatedBy,
    };
  });
  return result;
};

const Settings = mongoose.model("Settings", settingsSchema);

export default Settings;

