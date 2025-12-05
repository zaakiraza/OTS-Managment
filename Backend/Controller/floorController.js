import Floor from "../Model/Floor.js";
import Building from "../Model/Building.js";
import Department from "../Model/Department.js";

// Create floor
export const createFloor = async (req, res) => {
  try {
    const { building, floorNumber, name, code, totalArea, capacity, description } =
      req.body;

    // Verify building exists
    const buildingExists = await Building.findById(building);
    if (!buildingExists) {
      return res.status(400).json({
        success: false,
        message: "Invalid building",
      });
    }

    // Check if floor number already exists in this building
    const existingFloor = await Floor.findOne({ building, floorNumber });
    if (existingFloor) {
      return res.status(400).json({
        success: false,
        message: "Floor number already exists in this building",
      });
    }

    // Check if code already exists
    const existingCode = await Floor.findOne({ code });
    if (existingCode) {
      return res.status(400).json({
        success: false,
        message: "Floor code already exists",
      });
    }

    const floor = await Floor.create({
      building,
      floorNumber,
      name,
      code,
      totalArea,
      capacity,
      description,
      createdBy: req.user._id,
    });

    const populatedFloor = await Floor.findById(floor._id)
      .populate("building", "name code")
      .populate("createdBy", "name");

    res.status(201).json({
      success: true,
      message: "Floor created successfully",
      data: populatedFloor,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all floors
export const getAllFloors = async (req, res) => {
  try {
    const { building, isActive } = req.query;
    const filter = {};

    if (building) filter.building = building;
    if (isActive !== undefined) filter.isActive = isActive === "true";

    const floors = await Floor.find(filter)
      .populate("building", "name code")
      .populate("createdBy", "name")
      .sort({ building: 1, floorNumber: 1 });

    res.status(200).json({
      success: true,
      count: floors.length,
      data: floors,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get floor by ID
export const getFloorById = async (req, res) => {
  try {
    const floor = await Floor.findById(req.params.id)
      .populate("building", "name code address")
      .populate("createdBy", "name");

    if (!floor) {
      return res.status(404).json({
        success: false,
        message: "Floor not found",
      });
    }

    // Get departments count
    const departmentsCount = await Department.countDocuments({
      floor: req.params.id,
    });

    res.status(200).json({
      success: true,
      data: { ...floor.toObject(), departmentsCount },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update floor
export const updateFloor = async (req, res) => {
  try {
    const { building, floorNumber, name, code, totalArea, capacity, description, isActive } =
      req.body;

    // If building is being updated, verify it exists
    if (building) {
      const buildingExists = await Building.findById(building);
      if (!buildingExists) {
        return res.status(400).json({
          success: false,
          message: "Invalid building",
        });
      }
    }

    // Check if floor number already exists for another floor in the same building
    if (building && floorNumber) {
      const existingFloor = await Floor.findOne({
        building,
        floorNumber,
        _id: { $ne: req.params.id },
      });

      if (existingFloor) {
        return res.status(400).json({
          success: false,
          message: "Floor number already exists in this building",
        });
      }
    }

    const floor = await Floor.findByIdAndUpdate(
      req.params.id,
      { building, floorNumber, name, code, totalArea, capacity, description, isActive },
      { new: true, runValidators: true }
    ).populate("building", "name code");

    if (!floor) {
      return res.status(404).json({
        success: false,
        message: "Floor not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Floor updated successfully",
      data: floor,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete floor
export const deleteFloor = async (req, res) => {
  try {
    // Check if floor has departments
    const departmentsCount = await Department.countDocuments({
      floor: req.params.id,
    });

    if (departmentsCount > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete floor with existing departments. Delete departments first.",
      });
    }

    const floor = await Floor.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!floor) {
      return res.status(404).json({
        success: false,
        message: "Floor not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Floor deactivated successfully",
      data: floor,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
