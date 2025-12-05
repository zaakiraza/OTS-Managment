import Campus from "../Model/Campus.js";
import Building from "../Model/Building.js";

// Create campus
export const createCampus = async (req, res) => {
  try {
    const { name, code, city, country, address, totalArea, description } = req.body;

    const existing = await Campus.findOne({
      $or: [{ name }, { code }],
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Campus with this name or code already exists",
      });
    }

    const campus = await Campus.create({
      name,
      code,
      city,
      country,
      address,
      totalArea,
      description,
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: "Campus created successfully",
      data: campus,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all campuses
export const getAllCampuses = async (req, res) => {
  try {
    const { isActive } = req.query;
    const filter = {};

    if (isActive !== undefined) filter.isActive = isActive === "true";

    const campuses = await Campus.find(filter)
      .populate("createdBy", "name")
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: campuses.length,
      data: campuses,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get campus by ID
export const getCampusById = async (req, res) => {
  try {
    const campus = await Campus.findById(req.params.id).populate("createdBy", "name");

    if (!campus) {
      return res.status(404).json({
        success: false,
        message: "Campus not found",
      });
    }

    const buildingsCount = await Building.countDocuments({ campus: req.params.id });

    res.status(200).json({
      success: true,
      data: { ...campus.toObject(), buildingsCount },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update campus
export const updateCampus = async (req, res) => {
  try {
    const { name, code, city, country, address, totalArea, description, isActive } = req.body;

    const existing = await Campus.findOne({
      $or: [{ name }, { code }],
      _id: { $ne: req.params.id },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Campus with this name or code already exists",
      });
    }

    const campus = await Campus.findByIdAndUpdate(
      req.params.id,
      { name, code, city, country, address, totalArea, description, isActive },
      { new: true, runValidators: true }
    );

    if (!campus) {
      return res.status(404).json({
        success: false,
        message: "Campus not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Campus updated successfully",
      data: campus,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete campus
export const deleteCampus = async (req, res) => {
  try {
    const buildingsCount = await Building.countDocuments({ campus: req.params.id });

    if (buildingsCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete campus with existing buildings. Delete buildings first.",
      });
    }

    const campus = await Campus.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!campus) {
      return res.status(404).json({
        success: false,
        message: "Campus not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Campus deactivated successfully",
      data: campus,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
