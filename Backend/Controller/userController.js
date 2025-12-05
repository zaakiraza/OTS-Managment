import User from "../Model/User.js";
import Role from "../Model/Role.js";

// Create a new user
export const createUser = async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;

    // Check if user with email already exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    // Verify role exists
    const roleExists = await Role.findById(role);
    if (!roleExists) {
      return res.status(400).json({
        success: false,
        message: "Invalid role",
      });
    }

    // Generate userId based on role
    const rolePrefix = roleExists.name.substring(0, 4).toLowerCase();
    
    // Find the last user with this role prefix
    const lastUser = await User.findOne({
      userId: { $regex: `^${rolePrefix}` },
    })
      .sort({ userId: -1 })
      .limit(1);

    let newUserId;
    if (lastUser) {
      // Extract number from last userId and increment
      const lastNumber = parseInt(lastUser.userId.replace(rolePrefix, ""));
      newUserId = `${rolePrefix}${lastNumber + 1}`;
    } else {
      // First user with this role
      newUserId = `${rolePrefix}1`;
    }

    const user = await User.create({
      name,
      userId: newUserId,
      email,
      phone,
      password,
      role,
    });

    // Remove password from response
    const userResponse = await User.findById(user._id).populate(
      "role",
      "name description"
    );

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: userResponse,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all users
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ isActive: true }).populate(
      "role",
      "name description"
    );

    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get user by ID
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate(
      "role",
      "name description"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update user
export const updateUser = async (req, res) => {
  try {
    const { name, phone, role, isActive, email, password } = req.body;

    // If role is being updated, verify it exists
    if (role) {
      const roleExists = await Role.findById(role);
      if (!roleExists) {
        return res.status(400).json({
          success: false,
          message: "Invalid role",
        });
      }
    }

    // Check if email is being updated and if it already exists for another user
    if (email) {
      const existingUser = await User.findOne({ 
        email, 
        _id: { $ne: req.params.id } 
      });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Email already exists",
        });
      }
    }

    // Build update object
    const updateData = {};
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (role) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (email) updateData.email = email;
    
    // Hash password if provided
    if (password) {
      const bcrypt = await import("bcrypt");
      updateData.password = await bcrypt.hash(password, 10);
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate("role", "name description");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete user (soft delete)
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
