import Resource from "../Model/Resource.js";
import User from "../Model/User.js";

// Get all resources with filtering
export const getAllResources = async (req, res) => {
  try {
    const userType = req.user.userType;
    let query = { isActive: true };

    // If user is employee (team lead), filter by department
    if (userType === "employee") {
      query.department = req.user.department;
    } else if (req.query.department) {
      query.department = req.query.department;
    }

    // Additional filters
    if (req.query.status) {
      query.status = req.query.status;
    }
    if (req.query.type) {
      query.type = req.query.type;
    }

    const resources = await Resource.find(query)
      .populate("department", "name code")
      .populate("assignedTo", "name employeeId email")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: resources.length,
      data: resources,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get resource by ID
export const getResourceById = async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id)
      .populate("department", "name code")
      .populate("assignedTo", "name employeeId email position")
      .populate("createdBy", "name email")
      .populate("modifiedBy", "name email");

    if (!resource) {
      return res.status(404).json({
        success: false,
        message: "Resource not found",
      });
    }

    res.status(200).json({
      success: true,
      data: resource,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Create new resource
export const createResource = async (req, res) => {
  try {
    const resourceData = {
      ...req.body,
      createdBy: req.user._id,
    };

    const resource = await Resource.create(resourceData);

    const populatedResource = await Resource.findById(resource._id)
      .populate("department", "name code")
      .populate("assignedTo", "name employeeId email")
      .populate("createdBy", "name email");

    res.status(201).json({
      success: true,
      message: "Resource created successfully",
      data: populatedResource,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update resource
export const updateResource = async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);

    if (!resource) {
      return res.status(404).json({
        success: false,
        message: "Resource not found",
      });
    }

    const updateData = {
      ...req.body,
      modifiedBy: req.user._id,
    };

    const updatedResource = await Resource.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate("department", "name code")
      .populate("assignedTo", "name employeeId email")
      .populate("createdBy", "name email")
      .populate("modifiedBy", "name email");

    res.status(200).json({
      success: true,
      message: "Resource updated successfully",
      data: updatedResource,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete resource (soft delete)
export const deleteResource = async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);

    if (!resource) {
      return res.status(404).json({
        success: false,
        message: "Resource not found",
      });
    }

    resource.isActive = false;
    await resource.save();

    res.status(200).json({
      success: true,
      message: "Resource deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get resource statistics
export const getResourceStats = async (req, res) => {
  try {
    let query = { isActive: true };

    // Filter by department for team leads
    if (req.user.userType === "employee") {
      query.department = req.user.department;
    }

    const resources = await Resource.find(query);

    const stats = {
      total: resources.length,
      active: resources.filter((r) => r.status === "Active").length,
      expired: resources.filter((r) => r.status === "Expired").length,
      pending: resources.filter((r) => r.status === "Pending").length,
      totalCost: resources.reduce((sum, r) => sum + (r.cost || 0), 0),
      byType: {},
      expiringThisMonth: 0,
    };

    // Count by type
    resources.forEach((resource) => {
      stats.byType[resource.type] = (stats.byType[resource.type] || 0) + 1;
    });

    // Count expiring this month
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    stats.expiringThisMonth = resources.filter((r) => {
      if (!r.expiryDate) return false;
      const expiry = new Date(r.expiryDate);
      return expiry >= now && expiry <= endOfMonth;
    }).length;

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
