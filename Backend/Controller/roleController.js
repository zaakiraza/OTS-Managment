import Role from "../Model/Role.js";
import { logRoleAction } from "../Utils/auditLogger.js";

// Create a new role
export const createRole = async (req, res) => {
  try {
    const { name, description, permissions } = req.body;

    const existingRole = await Role.findOne({ name });
    if (existingRole) {
      return res.status(400).json({
        success: false,
        message: "Role already exists",
      });
    }

    const role = await Role.create({
      name,
      description,
      permissions,
    });

    // Audit log
    await logRoleAction(req, "CREATE", role, {
      after: { name: role.name, permissions: role.permissions }
    });

    res.status(201).json({
      success: true,
      message: "Role created successfully",
      data: role,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all roles
export const getAllRoles = async (req, res) => {
  try {
    const roles = await Role.find({ isActive: true });

    res.status(200).json({
      success: true,
      data: roles,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get role by ID
export const getRoleById = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    res.status(200).json({
      success: true,
      data: role,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update role
export const updateRole = async (req, res) => {
  try {
    const { description, permissions, isActive } = req.body;

    // Get original role for audit
    const originalRole = await Role.findById(req.params.id);

    const role = await Role.findByIdAndUpdate(
      req.params.id,
      { description, permissions, isActive },
      { new: true, runValidators: true }
    );

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    // Audit log
    await logRoleAction(req, "UPDATE", role, {
      before: { name: originalRole?.name, permissions: originalRole?.permissions },
      after: { name: role.name, permissions: role.permissions }
    });

    res.status(200).json({
      success: true,
      message: "Role updated successfully",
      data: role,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete role (soft delete)
export const deleteRole = async (req, res) => {
  try {
    // Get original role for audit
    const originalRole = await Role.findById(req.params.id);

    const role = await Role.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    // Audit log
    await logRoleAction(req, "DELETE", role, {
      before: { name: originalRole?.name, isActive: true },
      after: { isActive: false }
    });

    res.status(200).json({
      success: true,
      message: "Role deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
