import Asset from "../Model/Asset.js";
import AssetAssignment from "../Model/AssetAssignment.js";
import Employee from "../Model/Employee.js";

// Get all assets
export const getAllAssets = async (req, res) => {
  try {
    const { status, category, assignedTo, search } = req.query;
    const filter = { isActive: true };

    if (status) filter.status = status;
    if (category) filter.category = category;
    if (assignedTo) filter.assignedTo = assignedTo;
    
    if (search) {
      filter.$or = [
        { assetId: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
      ];
    }

    const assets = await Asset.find(filter)
      .populate("assignedTo", "employeeId name email department")
      .populate("createdBy", "name")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: assets.length,
      data: assets,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get asset by ID
export const getAssetById = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id)
      .populate("assignedTo", "employeeId name email department position")
      .populate("createdBy", "name")
      .populate("modifiedBy", "name");

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: "Asset not found",
      });
    }

    res.status(200).json({
      success: true,
      data: asset,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Create new asset
export const createAsset = async (req, res) => {
  try {
    const assetData = {
      ...req.body,
      createdBy: req.user._id,
    };

    const asset = await Asset.create(assetData);

    res.status(201).json({
      success: true,
      message: "Asset created successfully",
      data: asset,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update asset
export const updateAsset = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: "Asset not found",
      });
    }

    const updatedAsset = await Asset.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        modifiedBy: req.user._id,
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Asset updated successfully",
      data: updatedAsset,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete asset (soft delete)
export const deleteAsset = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: "Asset not found",
      });
    }

    await Asset.findByIdAndUpdate(req.params.id, {
      isActive: false,
      modifiedBy: req.user._id,
    });

    res.status(200).json({
      success: true,
      message: "Asset deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Assign asset to employee
export const assignAsset = async (req, res) => {
  try {
    const { assetId, employeeId, conditionAtAssignment, notes } = req.body;

    const asset = await Asset.findById(assetId);
    if (!asset) {
      return res.status(404).json({
        success: false,
        message: "Asset not found",
      });
    }

    if (asset.status === "Assigned") {
      return res.status(400).json({
        success: false,
        message: "Asset is already assigned",
      });
    }

    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Create assignment record
    const assignment = await AssetAssignment.create({
      asset: assetId,
      employee: employeeId,
      assignedBy: req.user._id,
      conditionAtAssignment: conditionAtAssignment || asset.condition,
      notes,
      status: "Active",
    });

    // Update asset
    asset.status = "Assigned";
    asset.assignedTo = employeeId;
    asset.assignedDate = new Date();
    asset.condition = conditionAtAssignment || asset.condition;
    asset.modifiedBy = req.user._id;
    await asset.save();

    const populatedAssignment = await AssetAssignment.findById(assignment._id)
      .populate("asset")
      .populate("employee", "employeeId name email")
      .populate("assignedBy", "name");

    res.status(200).json({
      success: true,
      message: "Asset assigned successfully",
      data: populatedAssignment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Return asset from employee
export const returnAsset = async (req, res) => {
  try {
    const { assignmentId, conditionAtReturn, returnNotes, status } = req.body;

    const assignment = await AssetAssignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found",
      });
    }

    if (assignment.status !== "Active") {
      return res.status(400).json({
        success: false,
        message: "Assignment is not active",
      });
    }

    // Update assignment
    assignment.returnDate = new Date();
    assignment.returnedBy = req.user._id;
    assignment.conditionAtReturn = conditionAtReturn;
    assignment.returnNotes = returnNotes;
    assignment.status = status || "Returned";
    await assignment.save();

    // Update asset
    const asset = await Asset.findById(assignment.asset);
    asset.status = status === "Damaged" ? "Damaged" : "Available";
    asset.assignedTo = null;
    asset.assignedDate = null;
    asset.condition = conditionAtReturn;
    asset.modifiedBy = req.user._id;
    await asset.save();

    const populatedAssignment = await AssetAssignment.findById(assignment._id)
      .populate("asset")
      .populate("employee", "employeeId name email")
      .populate("returnedBy", "name");

    res.status(200).json({
      success: true,
      message: "Asset returned successfully",
      data: populatedAssignment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get asset assignment history
export const getAssetHistory = async (req, res) => {
  try {
    const { assetId } = req.params;

    const history = await AssetAssignment.find({ asset: assetId })
      .populate("employee", "employeeId name email")
      .populate("assignedBy", "name")
      .populate("returnedBy", "name")
      .sort({ assignedDate: -1 });

    res.status(200).json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get employee assets
export const getEmployeeAssets = async (req, res) => {
  try {
    const { employeeId } = req.params;

    const assets = await Asset.find({
      assignedTo: employeeId,
      isActive: true,
    }).populate("createdBy", "name");

    res.status(200).json({
      success: true,
      count: assets.length,
      data: assets,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get asset statistics
export const getAssetStats = async (req, res) => {
  try {
    const totalAssets = await Asset.countDocuments({ isActive: true });
    const available = await Asset.countDocuments({ status: "Available", isActive: true });
    const assigned = await Asset.countDocuments({ status: "Assigned", isActive: true });
    const underRepair = await Asset.countDocuments({ status: "Under Repair", isActive: true });
    const damaged = await Asset.countDocuments({ status: "Damaged", isActive: true });

    const categoryBreakdown = await Asset.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const statusBreakdown = await Asset.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalAssets,
        available,
        assigned,
        underRepair,
        damaged,
        categoryBreakdown,
        statusBreakdown,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
