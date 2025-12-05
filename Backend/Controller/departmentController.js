import Department from "../Model/Department.js";
import Room from "../Model/Room.js";
import Floor from "../Model/Floor.js";

// Create department
export const createDepartment = async (req, res) => {
  try {
    const { name, code, room, floor, description, head, leverageTime, teamLead } = req.body;

    // Verify room and floor exist
    if (room) {
      const roomExists = await Room.findById(room);
      if (!roomExists) {
        return res.status(400).json({
          success: false,
          message: "Invalid room",
        });
      }
    }

    if (floor) {
      const floorExists = await Floor.findById(floor);
      if (!floorExists) {
        return res.status(400).json({
          success: false,
          message: "Invalid floor",
        });
      }
    }

    const existingDept = await Department.findOne({
      $or: [{ name }, { code }],
    });

    if (existingDept) {
      return res.status(400).json({
        success: false,
        message: "Department with this name or code already exists",
      });
    }

    // Auto-generate code if not provided
    const deptCode = code ? code.toUpperCase() : name.substring(0, 3).toUpperCase() + Math.floor(Math.random() * 1000);

    const department = await Department.create({
      name,
      code: deptCode,
      room,
      floor,
      description,
      head,
      leverageTime,
      teamLead,
      createdBy: req.user._id,
    });

    const populatedDept = await Department.findById(department._id)
      .populate("room", "name roomNumber code")
      .populate("floor", "name floorNumber")
      .populate("head", "name email")
      .populate("teamLead", "name employeeId email position");

    res.status(201).json({
      success: true,
      message: "Department created successfully",
      data: populatedDept,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all departments
export const getAllDepartments = async (req, res) => {
  try {
    const departments = await Department.find({ isActive: true })
      .populate("room", "name roomNumber code")
      .populate("floor", "name floorNumber")
      .populate("head", "name email")
      .populate("teamLead", "name employeeId email position")
      .populate("createdBy", "name")
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: departments.length,
      data: departments,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get department by ID
export const getDepartmentById = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id)
      .populate("room", "name roomNumber code roomType")
      .populate("floor", "name floorNumber building")
      .populate("head", "name email phone")
      .populate("teamLead", "name employeeId email position phone")
      .populate("createdBy", "name");

    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    res.status(200).json({
      success: true,
      data: department,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update department
export const updateDepartment = async (req, res) => {
  try {
    const { name, code, room, floor, description, head, isActive, leverageTime, teamLead } = req.body;

    // Verify room and floor exist if provided
    if (room) {
      const roomExists = await Room.findById(room);
      if (!roomExists) {
        return res.status(400).json({
          success: false,
          message: "Invalid room",
        });
      }
    }

    if (floor) {
      const floorExists = await Floor.findById(floor);
      if (!floorExists) {
        return res.status(400).json({
          success: false,
          message: "Invalid floor",
        });
      }
    }

    const updateData = { name, description, head, isActive, leverageTime, teamLead };
    if (room) updateData.room = room;
    if (floor) updateData.floor = floor;
    if (code) updateData.code = code.toUpperCase();

    const department = await Department.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate("room", "name roomNumber code")
      .populate("floor", "name floorNumber")
      .populate("head", "name email")
      .populate("teamLead", "name employeeId email position");

    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Department updated successfully",
      data: department,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete department
export const deleteDepartment = async (req, res) => {
  try {
    const department = await Department.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Department deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
