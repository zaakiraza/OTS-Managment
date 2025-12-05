import Room from "../Model/Room.js";
import Floor from "../Model/Floor.js";
import Department from "../Model/Department.js";

// Create room
export const createRoom = async (req, res) => {
  try {
    const { floor, roomNumber, name, code, roomType, capacity, area, description } = req.body;

    // Verify floor exists
    const floorExists = await Floor.findById(floor);
    if (!floorExists) {
      return res.status(400).json({
        success: false,
        message: "Invalid floor",
      });
    }

    // Check if room number already exists on this floor
    const existingRoom = await Room.findOne({ floor, roomNumber });
    if (existingRoom) {
      return res.status(400).json({
        success: false,
        message: "Room number already exists on this floor",
      });
    }

    // Check if code already exists
    const existingCode = await Room.findOne({ code });
    if (existingCode) {
      return res.status(400).json({
        success: false,
        message: "Room code already exists",
      });
    }

    const room = await Room.create({
      floor,
      roomNumber,
      name,
      code,
      roomType,
      capacity,
      area,
      description,
      createdBy: req.user._id,
    });

    const populatedRoom = await Room.findById(room._id)
      .populate({
        path: "floor",
        select: "name floorNumber building",
        populate: {
          path: "building",
          select: "name code campus",
          populate: {
            path: "campus",
            select: "name code city",
          },
        },
      })
      .populate("createdBy", "name");

    res.status(201).json({
      success: true,
      message: "Room created successfully",
      data: populatedRoom,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all rooms
export const getAllRooms = async (req, res) => {
  try {
    const { floor, roomType, isActive } = req.query;
    const filter = {};

    if (floor) filter.floor = floor;
    if (roomType) filter.roomType = roomType;
    if (isActive !== undefined) filter.isActive = isActive === "true";

    const rooms = await Room.find(filter)
      .populate({
        path: "floor",
        select: "name floorNumber building",
        populate: {
          path: "building",
          select: "name code",
        },
      })
      .populate("createdBy", "name")
      .sort({ floor: 1, roomNumber: 1 });

    res.status(200).json({
      success: true,
      count: rooms.length,
      data: rooms,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get room by ID
export const getRoomById = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id)
      .populate({
        path: "floor",
        select: "name floorNumber building",
        populate: {
          path: "building",
          select: "name code campus",
          populate: {
            path: "campus",
            select: "name code city",
          },
        },
      })
      .populate("createdBy", "name");

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    // Get departments count
    const departmentsCount = await Department.countDocuments({ room: req.params.id });

    res.status(200).json({
      success: true,
      data: { ...room.toObject(), departmentsCount },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update room
export const updateRoom = async (req, res) => {
  try {
    const { floor, roomNumber, name, code, roomType, capacity, area, description, isActive } = req.body;

    // If floor is being updated, verify it exists
    if (floor) {
      const floorExists = await Floor.findById(floor);
      if (!floorExists) {
        return res.status(400).json({
          success: false,
          message: "Invalid floor",
        });
      }
    }

    // Check if room number already exists for another room on the same floor
    if (floor && roomNumber) {
      const existingRoom = await Room.findOne({
        floor,
        roomNumber,
        _id: { $ne: req.params.id },
      });

      if (existingRoom) {
        return res.status(400).json({
          success: false,
          message: "Room number already exists on this floor",
        });
      }
    }

    const room = await Room.findByIdAndUpdate(
      req.params.id,
      { floor, roomNumber, name, code, roomType, capacity, area, description, isActive },
      { new: true, runValidators: true }
    ).populate({
      path: "floor",
      select: "name floorNumber building",
      populate: {
        path: "building",
        select: "name code",
      },
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Room updated successfully",
      data: room,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete room
export const deleteRoom = async (req, res) => {
  try {
    // Check if room has departments
    const departmentsCount = await Department.countDocuments({ room: req.params.id });

    if (departmentsCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete room with existing departments. Delete departments first.",
      });
    }

    const room = await Room.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Room deactivated successfully",
      data: room,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
