import Settings from "../Model/Settings.js";
import logger from "../Utils/logger.js";

// Get all settings
export const getAllSettings = async (req, res) => {
  try {
    const settings = await Settings.getAllSettings();
    
    // Add default values for settings that don't exist yet
    const defaultSettings = {
      manualAttendanceEnabled: {
        value: true,
        description: "Allow attendance department to mark attendance manually",
      },
      importAttendanceEnabled: {
        value: true,
        description: "Allow attendance department to import attendance data",
      },
      autoMarkAbsentEnabled: {
        value: true,
        description: "Automatically mark absent employees at end of day",
      },
    };

    // Merge defaults with existing settings
    const mergedSettings = { ...defaultSettings };
    Object.keys(settings).forEach((key) => {
      mergedSettings[key] = {
        ...mergedSettings[key],
        ...settings[key],
      };
    });

    res.status(200).json({
      success: true,
      data: mergedSettings,
    });
  } catch (error) {
    logger.error(`Error getting settings: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get a specific setting
export const getSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const value = await Settings.getValue(key, null);

    if (value === null) {
      // Return default values for known settings
      const defaults = {
        manualAttendanceEnabled: true,
        importAttendanceEnabled: true,
        autoMarkAbsentEnabled: true,
      };

      return res.status(200).json({
        success: true,
        data: {
          key,
          value: defaults[key] !== undefined ? defaults[key] : null,
          isDefault: true,
        },
      });
    }

    res.status(200).json({
      success: true,
      data: { key, value },
    });
  } catch (error) {
    logger.error(`Error getting setting ${req.params.key}: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update a setting (superAdmin only)
export const updateSetting = async (req, res) => {
  try {
    const { key, value, description } = req.body;

    if (!key) {
      return res.status(400).json({
        success: false,
        message: "Setting key is required",
      });
    }

    const validKeys = [
      "manualAttendanceEnabled",
      "importAttendanceEnabled",
      "autoMarkAbsentEnabled",
    ];

    if (!validKeys.includes(key)) {
      return res.status(400).json({
        success: false,
        message: `Invalid setting key. Valid keys are: ${validKeys.join(", ")}`,
      });
    }

    const setting = await Settings.findOneAndUpdate(
      { key },
      {
        value,
        description: description || getDefaultDescription(key),
        updatedBy: req.user._id,
      },
      { upsert: true, new: true }
    ).populate("updatedBy", "name employeeId");

    logger.info(`Setting ${key} updated to ${value} by ${req.user.name || req.user.employeeId}`);

    res.status(200).json({
      success: true,
      message: "Setting updated successfully",
      data: setting,
    });
  } catch (error) {
    logger.error(`Error updating setting: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update multiple settings at once (superAdmin only)
export const updateMultipleSettings = async (req, res) => {
  try {
    const { settings } = req.body;

    if (!settings || !Array.isArray(settings)) {
      return res.status(400).json({
        success: false,
        message: "Settings array is required",
      });
    }

    const validKeys = [
      "manualAttendanceEnabled",
      "importAttendanceEnabled",
      "autoMarkAbsentEnabled",
      "emailService",
      "emailUser",
      "emailPassword",
      "emailFromName",
    ];

    const results = [];
    const errors = [];

    for (const { key, value } of settings) {
      if (!validKeys.includes(key)) {
        errors.push({ key, message: "Invalid setting key" });
        continue;
      }

      try {
        const setting = await Settings.findOneAndUpdate(
          { key },
          {
            value,
            description: getDefaultDescription(key),
            updatedBy: req.user._id,
          },
          { upsert: true, new: true }
        );
        results.push(setting);
      } catch (err) {
        errors.push({ key, message: err.message });
      }
    }

    logger.info(`Multiple settings updated by ${req.user.name || req.user.employeeId}`);

    res.status(200).json({
      success: true,
      message: "Settings updated",
      data: {
        updated: results,
        errors,
      },
    });
  } catch (error) {
    logger.error(`Error updating multiple settings: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Check if a feature is enabled (public endpoint for checking)
export const checkFeatureEnabled = async (req, res) => {
  try {
    const { feature } = req.params;
    
    const featureMap = {
      "manual-attendance": "manualAttendanceEnabled",
      "import-attendance": "importAttendanceEnabled",
      "auto-mark-absent": "autoMarkAbsentEnabled",
    };

    const settingKey = featureMap[feature];
    if (!settingKey) {
      return res.status(400).json({
        success: false,
        message: "Invalid feature",
      });
    }

    const value = await Settings.getValue(settingKey, true); // Default to true

    res.status(200).json({
      success: true,
      enabled: value,
    });
  } catch (error) {
    logger.error(`Error checking feature: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Helper function for default descriptions
function getDefaultDescription(key) {
  const descriptions = {
    manualAttendanceEnabled: "Allow attendance department to mark attendance manually",
    importAttendanceEnabled: "Allow attendance department to import attendance data",
    autoMarkAbsentEnabled: "Automatically mark absent employees at end of day",
    emailService: "Email service provider for system notifications",
    emailUser: "Email address for sending notifications",
    emailPassword: "Email password or app password",
    emailFromName: "Sender name displayed in emails",
  };
  return descriptions[key] || "";
}

