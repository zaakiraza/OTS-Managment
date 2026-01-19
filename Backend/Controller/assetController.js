import Asset from "../Model/Asset.js";
import AssetAssignment from "../Model/AssetAssignment.js";
import Employee from "../Model/Employee.js";
import { logAssetAction, logImportAction } from "../Utils/auditLogger.js";
import { createNotification } from "./notificationController.js";

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
      .populate({
        path: "assignedTo",
        select: "employeeId name email department",
        populate: {
          path: "department",
          select: "name"
        }
      })
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
    // Clean up the location object - remove any extra fields
    const locationData = req.body.location ? {
      building: req.body.location.building || "",
      floor: req.body.location.floor || "",
    } : undefined;

    const assetData = {
      ...req.body,
      location: locationData,
      createdBy: req.user._id,
    };

    const asset = await Asset.create(assetData);

    // Audit log
    await logAssetAction(req, "CREATE", asset, {
      after: { name: asset.name, category: asset.category, status: asset.status }
    });

    res.status(201).json({
      success: true,
      message: "Asset created successfully",
      data: asset,
    });
  } catch (error) {
    console.error("Asset creation error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Bulk create assets (import from Excel/CSV)
export const bulkCreateAssets = async (req, res) => {
  try {
    const assetsData = req.body;
    
    if (!Array.isArray(assetsData) || assetsData.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No assets data provided",
      });
    }

    const results = {
      created: 0,
      errors: [],
    };

    // Process each asset
    for (let i = 0; i < assetsData.length; i++) {
      const assetData = assetsData[i];
      
      try {
        // Clean up location data
        const locationData = assetData.location ? {
          building: assetData.location.building || "",
          floor: assetData.location.floor || "",
        } : undefined;

        // Create asset
        const asset = await Asset.create({
          name: assetData.name,
          category: assetData.category,
          serialNumber: assetData.serialNumber || null,
          macAddress: assetData.macAddress || null,
          condition: assetData.condition || "Good",
          status: assetData.status || "Available",
          purchasePrice: assetData.purchasePrice || null,
          issueDate: assetData.issueDate || new Date(),
          location: locationData,
          notes: assetData.notes || "",
          createdBy: req.user._id,
        });

        results.created++;
      } catch (error) {
        results.errors.push({
          row: i + 1,
          name: assetData.name,
          error: error.message,
        });
      }
    }

    // Audit log for bulk import
    await logImportAction(req, "Asset", `Bulk imported ${results.created} assets`, {
      after: { created: results.created, errors: results.errors.length }
    });

    res.status(201).json({
      success: true,
      message: `Successfully imported ${results.created} assets`,
      data: results,
    });
  } catch (error) {
    console.error("Bulk asset creation error:", error);
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

    // Audit log
    await logAssetAction(req, "UPDATE", updatedAsset, {
      before: { name: asset.name, status: asset.status, condition: asset.condition },
      after: { name: updatedAsset.name, status: updatedAsset.status, condition: updatedAsset.condition }
    });

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

    // Audit log
    await logAssetAction(req, "DELETE", asset, {
      before: { name: asset.name, isActive: true },
      after: { isActive: false }
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

    // Audit log
    await logAssetAction(req, "ASSIGN", asset, {
      after: { assignedTo: employee.name, employeeId: employee.employeeId }
    });

    // Send notification to employee
    try {
      await createNotification({
        recipient: employeeId,
        type: "asset_assigned",
        title: "Asset Assigned",
        message: `You have been assigned ${asset.name} (${asset.assetId})`,
        data: {
          referenceId: asset._id,
          referenceType: "Asset",
          extra: { assetId: asset.assetId, assetName: asset.name },
        },
        sender: req.user._id,
      });
    } catch (notifError) {
      console.error("Error creating asset notification:", notifError);
    }

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

    // Audit log
    await logAssetAction(req, "UNASSIGN", asset, {
      before: { assignedTo: populatedAssignment.employee?.name },
      after: { status: asset.status, condition: conditionAtReturn }
    });

    // Notify employee about asset return confirmation
    try {
      if (populatedAssignment.employee) {
        await createNotification({
          recipient: populatedAssignment.employee._id,
          type: "asset_returned",
          title: "Asset Returned",
          message: `Your return of ${asset.name} (${asset.assetId}) has been processed`,
          data: {
            referenceId: asset._id,
            referenceType: "Asset",
            extra: { assetId: asset.assetId, assetName: asset.name, condition: conditionAtReturn },
          },
          sender: req.user._id,
        });
      }
    } catch (notifError) {
      console.error("Error creating asset return notification:", notifError);
    }

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
