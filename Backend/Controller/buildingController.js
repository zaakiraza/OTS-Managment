import Building from "../Model/Building.js";
import Campus from "../Model/Campus.js";
import Floor from "../Model/Floor.js";

// Create building
export const createBuilding = async (req, res) => {
  try {
    const { campus, name, code, address, totalFloors, description } = req.body;

    // Verify campus exists
    const campusExists = await Campus.findById(campus);
    if (!campusExists) {
      return res.status(400).json({
        success: false,
        message: "Invalid campus",
      });
    }

    // Check if building with same code exists
    const existing = await Building.findOne({ code });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Building with this code already exists",
      });
    }

    const building = await Building.create({
      campus,
      name,
      code,
      address,
      totalFloors,
      description,
      createdBy: req.user._id,
    });

    const populatedBuilding = await Building.findById(building._id)
      .populate("campus", "name code city")
      .populate("createdBy", "name");

    res.status(201).json({
      success: true,
      message: "Building created successfully",
      data: populatedBuilding,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all buildings
export const getAllBuildings = async (req, res) => {
  try {
    const { campus, isActive } = req.query;
    const filter = {};

    if (campus) filter.campus = campus;
    if (isActive !== undefined) filter.isActive = isActive === "true";

    const buildings = await Building.find(filter)
      .populate("campus", "name code city")
      .populate("createdBy", "name")
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: buildings.length,
      data: buildings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get building by ID
export const getBuildingById = async (req, res) => {
  try {
    const building = await Building.findById(req.params.id)
      .populate("campus", "name code city")
      .populate("createdBy", "name");

    if (!building) {
      return res.status(404).json({
        success: false,
        message: "Building not found",
      });
    }

    // Get floors count
    const floorsCount = await Floor.countDocuments({ building: req.params.id });

    res.status(200).json({
      success: true,
      data: { ...building.toObject(), floorsCount },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update building
export const updateBuilding = async (req, res) => {
  try {
    const { campus, name, code, address, totalFloors, description, isActive } = req.body;

    // If campus is being updated, verify it exists
    if (campus) {
      const campusExists = await Campus.findById(campus);
      if (!campusExists) {
        return res.status(400).json({
          success: false,
          message: "Invalid campus",
        });
      }
    }

    // Check if another building has the same code
    const existing = await Building.findOne({
      code,
      _id: { $ne: req.params.id },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Building with this code already exists",
      });
    }

    const building = await Building.findByIdAndUpdate(
      req.params.id,
      { campus, name, code, address, totalFloors, description, isActive },
      { new: true, runValidators: true }
    ).populate("campus", "name code city");

    if (!building) {
      return res.status(404).json({
        success: false,
        message: "Building not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Building updated successfully",
      data: building,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete building
export const deleteBuilding = async (req, res) => {
  try {
    // Check if building has floors
    const floorsCount = await Floor.countDocuments({ building: req.params.id });

    if (floorsCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete building with existing floors. Delete floors first.",
      });
    }

    const building = await Building.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!building) {
      return res.status(404).json({
        success: false,
        message: "Building not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Building deactivated successfully",
      data: building,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
